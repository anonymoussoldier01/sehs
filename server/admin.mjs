// Admin backend: role-gated JSON API + server-rendered pages. No client trust.
import crypto from 'node:crypto';
import { getMeta, setMeta } from './db.mjs';
import { hashPassword, verifyPassword, tokenHash } from './crypto.mjs';
import { publicView } from './content.mjs';
import { layout, esc, pretty } from './templates.mjs';

export function requireAdmin(session) {
  return !!session && !session.fresh && session.role === 'admin';
}
export function adminMissing(res, sendJson) {
  return sendJson(res, 404, { ok: false, error: 'Not found.' });
}

const FILE_TYPES = ['pdf', 'docx', 'image', 'archive', 'webpage', 'code', 'other'];
const ACCESS = ['public', 'members'];
const STATUS = ['available', 'unavailable', 'needs_verification'];
const CATS = ['exam-prep', 'maths', 'english', 'reading', 'writing', 'verbal-reasoning', 'numerical-reasoning', 'quantitative', 'past-paper', 'practice-test', 'study-guide', 'reference', 'tutorial', 'tool', 'document', 'other'];

function cleanStr(v, max) {
  if (v === undefined || v === null) return undefined;
  return String(v).slice(0, max);
}
function cleanTags(v) {
  if (!Array.isArray(v)) return undefined;
  const out = [];
  const seen = new Set();
  for (const t of v) {
    const s = String(t).toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
    if (!s || s.length < 2 || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}
function validateResource(b, partial) {
  const e = [];
  const req = (k, cond, msg) => { if (!partial || b[k] !== undefined) { if (!cond) e.push(`${k}: ${msg}`); } };
  req('title', typeof b.title === 'string' && b.title.trim().length >= 2 && b.title.length <= 200, '2–200 chars');
  req('category', CATS.includes(b.category), 'unknown category');
  req('fileType', FILE_TYPES.includes(b.fileType), 'unknown file type');
  req('accessLevel', ACCESS.includes(b.accessLevel), 'public|members');
  req('status', STATUS.includes(b.status), 'unknown status');
  if (b.year !== undefined && b.year !== '' && !/^(19|20)\d{2}$/.test(String(b.year))) e.push('year: YYYY or empty');
  return e;
}
function toRow(b, full) {
  const tags = cleanTags(b.tags || []);
  return {
    title: cleanStr(b.title, 200)?.trim(),
    description: cleanStr(b.description, 2000) || '',
    subject: cleanStr(b.subject, 100) || '',
    category: b.category,
    provider: cleanStr(b.provider, 60)?.toLowerCase() || '',
    file_type: b.fileType,
    year: /^(19|20)\d{2}$/.test(String(b.year || '')) ? String(b.year) : '',
    tags: JSON.stringify(tags),
    answers_included: tags.includes('answers') || !!b.answersIncluded ? 1 : 0,
    audience: cleanStr(b.audience, 80) || '',
    access_level: b.accessLevel,
    status: b.status,
    visibility: b.visibility === undefined ? 1 : (b.visibility ? 1 : 0),
    featured: b.featured ? 1 : 0,
    ...(full ? {} : {}),
  };
}

// ---- retention purge ----------------------------------------------------------
export function runPurge(db) {
  const days = Math.min(365, Math.max(1, Number(getMeta(db, 'retention_days') || 30)));
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const info = db.prepare('DELETE FROM events WHERE day < ?').run(cutoff);
  setMeta(db, 'last_purge', new Date().toISOString());
  return { days, cutoff, deleted: info.changes };
}
export function maybePurge(db) {
  const last = getMeta(db, 'last_purge');
  if (!last || Date.now() - Date.parse(last) > 24 * 3600 * 1000) {
    try { return runPurge(db); } catch { return null; }
  }
  return null;
}

// ---- stats ----------------------------------------------------------------------
export function adminStats(db) {
  const total = db.prepare('SELECT COUNT(*) n FROM resources').get().n;
  const members = db.prepare("SELECT COUNT(*) n FROM resources WHERE access_level = 'members'").get().n;
  const sessions = db.prepare('SELECT COUNT(*) n FROM sessions WHERE expires_at > ?').get(new Date().toISOString()).n;
  const today = new Date().toISOString().slice(0, 10);
  const opensToday = db.prepare("SELECT COUNT(*) n FROM events WHERE type = 'open' AND day = ?").get(today).n;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const o = db.prepare("SELECT COALESCE(SUM(count),0) s FROM daily_aggregates WHERE day = ? AND kind = 'resource'").get(d).s;
    const q = db.prepare("SELECT COALESCE(SUM(count),0) s FROM daily_aggregates WHERE day = ? AND kind = 'query'").get(d).s;
    days.push({ day: d.slice(5), opens: o, queries: q });
  }
  const topQueries = db.prepare("SELECT key, SUM(count) c FROM daily_aggregates WHERE kind = 'query' GROUP BY key ORDER BY c DESC LIMIT 10").all();
  const topRes = db.prepare(`SELECT a.key AS id, SUM(a.count) AS c, r.title AS title
    FROM daily_aggregates a LEFT JOIN resources r ON r.public_id = a.key
    WHERE a.kind = 'resource' GROUP BY a.key ORDER BY c DESC LIMIT 10`).all();
  const zeroRows = db.prepare("SELECT data FROM events WHERE type = 'search_zero' ORDER BY id DESC LIMIT 200").all();
  const zeroC = new Map();
  for (const r of zeroRows) {
    try {
      const q = (JSON.parse(r.data).q || '').toLowerCase();
      if (q) zeroC.set(q, (zeroC.get(q) || 0) + 1);
    } catch { /* noop */ }
  }
  const zeroQueries = [...zeroC.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([key, count]) => ({ key, count }));
  const maxDay = Math.max(1, ...days.map(d => Math.max(d.opens, d.queries)));
  let aiToday = 0, aiModes = [], aiCached = 0;
  try {
    aiToday = db.prepare("SELECT COALESCE(SUM(count),0) s FROM daily_aggregates WHERE day = ? AND kind = 'ai'").get(today).s;
    aiModes = db.prepare("SELECT key, SUM(count) c FROM daily_aggregates WHERE kind = 'ai' GROUP BY key ORDER BY c DESC LIMIT 12").all();
    aiCached = db.prepare('SELECT COUNT(*) n FROM ai_cache').get().n;
  } catch { /* ai tables predate schema — dashboard shows zeros */ }
  return { total, members, sessions, opensToday, days, maxDay, topQueries, topRes, zeroQueries, aiToday, aiModes, aiCached };
}

// ---- pages -------------------------------------------------------------------------
function adminNav(active) {
  const items = [['/admin', 'Dashboard'], ['/admin/resources', 'Resources'], ['/admin/triage', 'Triage'], ['/admin/audit', 'Audit & sessions'], ['/admin/settings', 'Settings']];
  return `<nav class="topnav" aria-label="Admin" style="margin-bottom:16px">${items.map(([h, l]) =>
    `<a href="${h}"${active === h ? ' class="on" aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
}

export function adminDashboard(ctx) {
  maybePurge(ctx.db);
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <h1 style="font-family:var(--disp)">Admin dashboard</h1>
    ${adminNav('/admin')}
    <div class="stat-cards" id="dash-stats"><div class="sk"><i style="height:20px;width:50%"></i></div></div>
    <section class="disc-section"><div class="disc-head"><h2>Last 14 days</h2></div>
      <div class="disc-tile" id="dash-chart"><p style="color:var(--mut)">Loading…</p></div></section>
    <div class="disc-sub">
      <div class="disc-tile"><h3>Top queries</h3><div id="dash-queries"><p style="color:var(--mut)">Loading…</p></div></div>
      <div class="disc-tile"><h3>Top resources</h3><div id="dash-top"></div></div>
    </div>
    <section class="disc-section" style="margin-top:16px"><div class="disc-head"><h2>Zero-result queries (content gaps)</h2></div>
      <div class="disc-tile" id="dash-zero"><p style="color:var(--mut)">Loading…</p></div></section>
    <section class="disc-section"><div class="disc-head"><h2>✦ AI usage</h2></div>
      <div class="disc-tile" id="dash-ai"><p style="color:var(--mut)">Loading…</p></div></section>
    <section class="disc-section"><div class="disc-head"><h2>Server health</h2></div>
      <div class="disc-tile" id="dash-health"><p style="color:var(--mut)">Loading…</p></div></section>
  </div>
  <script src="/admin.js" defer></script>`;
  return layout({ title: 'Admin dashboard', body, session: ctx.session });
}

export function adminResources(ctx, sp) {
  const q = (sp.get('q') || '').slice(0, 120);
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <h1 style="font-family:var(--disp)">Resources</h1>
    ${adminNav('/admin/resources')}
    <form id="res-search" class="search-wrap" style="max-width:520px;margin-bottom:16px">
      <div class="searchbox"><input name="q" type="search" value="${esc(q)}" placeholder="Search titles, providers…" aria-label="Search resources"></div>
    </form>
    <div class="table-wrap"><table class="grid-table"><thead><tr><th>Title</th><th>Category</th><th>Access</th><th>Status</th><th>Visible</th><th>Actions</th></tr></thead><tbody id="res-rows"><tr><td colspan="6">Loading…</td></tr></tbody></table></div>
    <p style="color:var(--mut);font-size:13px" id="res-page"></p>
    <div class="disc-tile" style="margin-top:16px"><h3>Add resource</h3>
      <form id="res-add" style="display:grid;gap:8px;max-width:560px">
        <input name="title" required minlength="2" maxlength="200" placeholder="Title" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <input name="provider" maxlength="60" placeholder="Provider (e.g. acer)" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select name="category" aria-label="Category">${CATS.map(c => `<option>${c}</option>`).join('')}</select>
          <select name="accessLevel" aria-label="Access"><option value="public">public</option><option value="members">members</option></select>
        </div>
        <div><button class="btn small" type="submit">Add</button></div>
      </form></div>
    <div class="disc-tile" style="margin-top:16px"><h3>Bulk import (JSON array, max 200)</h3>
      <p style="color:var(--mut);font-size:13px">Each item needs at least a title. Same validation as single adds.</p>
      <textarea id="bulk-text" rows="4" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit" placeholder='[{"title":"…","provider":"acer","category":"maths"}]'></textarea>
      <div style="margin-top:8px"><button class="btn small" id="bulk-btn">Import</button> <span id="bulk-msg" style="font-size:13px"></span></div></div>
  </div>
  <div class="modal-backdrop" id="edit-modal" hidden><div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
    <button class="icon-btn modal-x" id="edit-x" aria-label="Close">✕</button>
    <h2 id="edit-title">Edit resource</h2>
    <form id="res-edit" style="display:grid;gap:8px">
      <input type="hidden" name="id">
      <label>Title<input name="title" required maxlength="200" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"></label>
      <label>Description<textarea name="description" rows="3" maxlength="2000" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"></textarea></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label>Category<select name="category">${CATS.map(c => `<option>${c}</option>`).join('')}</select></label>
        <label>Access<select name="accessLevel"><option value="public">public</option><option value="members">members</option></select></label>
        <label>Status<select name="status"><option value="available">available</option><option value="unavailable">unavailable</option><option value="needs_verification">needs_verification</option></select></label>
      </div>
      <label>Provider<input name="provider" maxlength="60" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"></label>
      <label>Tags (comma separated)<input name="tags" maxlength="400" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"></label>
      <label class="check-row"><input type="checkbox" name="visibility"> <span>Visible</span></label>
      <label class="check-row"><input type="checkbox" name="featured"> <span>Featured</span></label>
      <div><button class="btn small" type="submit">Save</button> <button class="btn small secondary" type="button" id="res-delete">Delete</button></div>
    </form>
  </div></div>
  <script src="/admin.js" defer></script>`;
  return layout({ title: 'Admin resources', body, session: ctx.session });
}

export function adminAudit(ctx, sp) {
  const type = (sp.get('type') || '').slice(0, 30);
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <h1 style="font-family:var(--disp)">Audit &amp; sessions</h1>
    ${adminNav('/admin/audit')}
    <h2 style="font-size:16px">Active sessions <span id="sess-n"></span></h2>
    <div class="table-wrap"><table class="grid-table"><thead><tr><th>Role</th><th>Last seen</th><th>IP hash</th><th>Client</th><th></th></tr></thead><tbody id="sess-rows"><tr><td colspan="5">Loading…</td></tr></tbody></table></div>
    <div style="margin:12px 0"><button class="btn small secondary" id="revoke-all">Revoke all admin sessions</button>
    <button class="btn small secondary" id="audit-csv">Export audit CSV</button></div>
    <h2 style="font-size:16px;margin-top:24px">Event log</h2>
    <form id="audit-filter" style="margin-bottom:12px;display:flex;gap:8px">
      <select id="audit-type" aria-label="Event type">
        <option value="">All types</option>
        ${['open', 'unlock', 'unlock_fail', 'lockout', 'terms_accept', 'report', 'request', 'search_zero', 'admin'].map(t => `<option value="${t}"${type === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
    </form>
    <div class="table-wrap"><table class="grid-table"><thead><tr><th>Time</th><th>Type</th><th>Resource</th><th>Detail</th></tr></thead><tbody id="audit-rows"><tr><td colspan="4">Loading…</td></tr></tbody></table></div>
    <p style="color:var(--mut);font-size:13px" id="audit-page"></p>
  </div>
  <script src="/admin.js" defer></script>`;
  return layout({ title: 'Admin audit', body, session: ctx.session });
}

export function adminTriage(ctx) {
  const reports = ctx.db.prepare(`SELECT r.*, res.title AS rtitle, res.public_id AS rpid FROM reports r
    LEFT JOIN resources res ON res.id = r.resource_id WHERE r.status = 'open' ORDER BY r.id DESC LIMIT 100`).all();
  const requests = ctx.db.prepare(`SELECT * FROM requests WHERE status = 'open' ORDER BY id DESC LIMIT 100`).all();
  const repRows = reports.map(r => `<tr><td>#${r.id}</td><td>${r.rtitle && r.rpid ? `<a href="/r/${esc(r.rpid)}">${esc(r.rtitle.slice(0, 50))}</a>` : '—'}</td><td>${esc(r.reason)}</td><td>${esc((r.detail || '').slice(0, 80))}</td><td>${esc(r.created_at.slice(0, 16).replace('T', ' '))}</td><td style="white-space:nowrap"><button class="btn small secondary" data-triage="report:${r.id}:accepted">Accept</button> <button class="btn small secondary" data-triage="report:${r.id}:rejected">Reject</button></td></tr>`).join('');
  const reqRows = requests.map(r => `<tr><td>#${r.id}</td><td>${esc(r.title.slice(0, 60))}</td><td>${esc((r.detail || '').slice(0, 80))}</td><td>${esc(r.created_at.slice(0, 16).replace('T', ' '))}</td><td style="white-space:nowrap"><button class="btn small secondary" data-triage="request:${r.id}:accepted">Accept</button> <button class="btn small secondary" data-triage="request:${r.id}:rejected">Reject</button></td></tr>`).join('');
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <h1 style="font-family:var(--disp)">Triage queue</h1>
    ${adminNav('/admin/triage')}
    <h2 style="font-size:16px">Broken-link reports (${reports.length})</h2>
    <div class="table-wrap"><table class="grid-table"><thead><tr><th>ID</th><th>Resource</th><th>Reason</th><th>Detail</th><th>When</th><th></th></tr></thead><tbody>${repRows || '<tr><td colspan="6">Queue clear. 🎉</td></tr>'}</tbody></table></div>
    <h2 style="font-size:16px;margin-top:24px">Resource requests (${requests.length})</h2>
    <div class="table-wrap"><table class="grid-table"><thead><tr><th>ID</th><th>Title</th><th>Detail</th><th>When</th><th></th></tr></thead><tbody>${reqRows || '<tr><td colspan="5">Queue clear. 🎉</td></tr>'}</tbody></table></div>
    <p style="color:var(--mut);font-size:13px">Accepting a broken-link report marks the resource <em>needs verification</em>.</p>
  </div>
  <script src="/admin.js" defer></script>`;
  return layout({ title: 'Admin triage', body, session: ctx.session });
}

export function adminSettings(ctx) {  const days = Number(getMeta(ctx.db, 'retention_days') || 30);
  const lastPurge = getMeta(ctx.db, 'last_purge') || 'never';
  const termsV = Number(getMeta(ctx.db, 'terms_version') || 1);
  const terms = ctx.db.prepare('SELECT version, summary_md, body_md FROM terms WHERE version = ?').get(termsV) || { version: termsV, summary_md: '', body_md: '' };
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:760px" id="main">
    <h1 style="font-family:var(--disp)">Settings</h1>
    ${adminNav('/admin/settings')}
    <div class="disc-tile"><h3>Passwords</h3>
      <p style="color:var(--mut);font-size:13px">Changing a password instantly revokes all sessions of that role (including other devices). New password: 16+ characters.</p>
      <form id="pw-form" style="display:grid;gap:8px;max-width:420px">
        <input type="hidden" name="role" value="admin">
        <input name="current" type="password" required placeholder="Current admin password" autocomplete="current-password" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <input name="next" type="password" required minlength="16" placeholder="New password (16+ chars)" autocomplete="new-password" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <div><button class="btn small" type="submit">Rotate password</button> <span id="pw-msg" style="font-size:13px"></span></div>
      </form></div>
    <div class="disc-tile" style="margin-top:16px"><h3>Terms &amp; Conditions (v${terms.version})</h3>
      <p style="color:var(--mut);font-size:13px">Saving creates a new version and asks every user to re-accept on their next open.</p>
      <form id="terms-form" style="display:grid;gap:8px">
        <textarea name="summary" rows="2" maxlength="600" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">${esc(terms.summary_md)}</textarea>
        <textarea name="body" rows="10" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">${esc(terms.body_md)}</textarea>
        <div><button class="btn small" type="submit">Publish new version</button> <span id="terms-msg" style="font-size:13px"></span></div>
      </form></div>
    <div class="disc-tile" style="margin-top:16px"><h3>Analytics retention</h3>
      <form id="ret-form" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label>Keep raw events <input name="days" type="number" min="7" max="365" value="${days}" style="width:80px;padding:7px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"> days</label>
        <button class="btn small" type="submit">Save</button>
        <button class="btn small secondary" type="button" id="purge-btn">Purge now</button>
        <span style="font-size:13px;color:var(--mut)">Last purge: ${esc(lastPurge)}</span>
      </form></div>
    <div class="disc-tile" style="margin-top:16px"><h3>Announcements</h3>
      <div id="ann-list"><p style="color:var(--mut)">Loading…</p></div>
      <form id="ann-form" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <input id="ann-body" required maxlength="300" placeholder="Banner text…" style="flex:1;min-width:200px;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <button class="btn small" type="submit">Publish</button>
      </form></div>
    <div class="disc-tile" style="margin-top:16px"><h3>Backup &amp; health</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn small secondary" href="/api/admin/backup">Download database backup</a>
        <button class="btn small secondary" id="health-btn">Check health</button>
      </div>
      <div id="health-out" style="margin-top:8px;font-size:13px;color:var(--mut)"></div></div>
  </div>
  <script src="/admin.js" defer></script>`;
  return layout({ title: 'Admin settings', body, session: ctx.session });
}

// ---- admin API (all requireAdmin at the router) --------------------------------------
export function apiAdminStats(db) {
  const s = adminStats(db);
  return { ok: true, ...s, days: s.days };
}
export function apiResourceUpdate(db, id, body, rebuild) {
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(id));
  if (!row) return { status: 404, body: { ok: false, error: 'Not found.' } };
  const errs = validateResource(body, true);
  if (errs.length) return { status: 400, body: { ok: false, error: errs.join('; ') } };
  const sets = [];
  const vals = [];
  const map = { title: 'title', description: 'description', subject: 'subject', category: 'category', provider: 'provider', fileType: 'file_type', year: 'year', audience: 'audience', accessLevel: 'access_level', status: 'status', visibility: 'visibility', featured: 'featured' };
  for (const [k, col] of Object.entries(map)) {
    if (body[k] === undefined) continue;
    let v = body[k];
    if (k === 'title') v = String(v).trim().slice(0, 200);
    if (k === 'description') v = String(v).slice(0, 2000);
    if (k === 'subject') v = String(v).slice(0, 100);
    if (k === 'provider') v = String(v).toLowerCase().slice(0, 60);
    if (k === 'year') v = /^(19|20)\d{2}$/.test(String(v)) ? String(v) : '';
    if (k === 'audience') v = String(v).slice(0, 80);
    if (k === 'visibility' || k === 'featured') v = v ? 1 : 0;
    sets.push(`${col} = ?`);
    vals.push(v);
  }
  if (body.tags !== undefined) {
    const tags = cleanTags(body.tags);
    sets.push('tags = ?');
    vals.push(JSON.stringify(tags));
    sets.push('answers_included = ?');
    vals.push(tags.includes('answers') || body.answersIncluded ? 1 : 0);
  } else if (body.answersIncluded !== undefined) {
    sets.push('answers_included = ?');
    vals.push(body.answersIncluded ? 1 : 0);
  }
  if (!sets.length) return { status: 400, body: { ok: false, error: 'Nothing to update.' } };
  sets.push('updated_at = ?');
  vals.push(new Date().toISOString());
  vals.push(Number(id));
  db.prepare(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  rebuild();
  const updated = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(id));
  return { status: 200, body: { ok: true, resource: publicView(updated) } };
}
export function apiResourceCreate(db, body, rebuild) {
  const full = { title: '', description: '', subject: '', category: 'other', provider: '', fileType: 'other', year: '', tags: [], accessLevel: 'public', status: 'available', visibility: true, featured: false, audience: '', ...body };
  const errs = validateResource(full, false);
  if (errs.length) return { status: 400, body: { ok: false, error: errs.join('; ') } };
  const r = toRow(full, true);
  const info = db.prepare(`INSERT INTO resources(public_id, title, description, subject, category, provider, file_type, year, tags, answers_included, audience, access_level, status, visibility, featured, size_bytes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`)
    .run(cryptoId(), r.title, r.description, r.subject, r.category, r.provider, r.file_type, r.year,
      r.tags, r.answers_included, r.audience, r.access_level, r.status, r.visibility, r.featured,
      new Date().toISOString(), new Date().toISOString());
  rebuild();
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(info.lastInsertRowid));
  return { status: 201, body: { ok: true, resource: publicView(row) } };
}
function cryptoId() {
  return crypto.randomBytes(16).toString('hex');
}
export function apiResourceDelete(db, id, rebuild) {
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(id));
  if (!row) return { status: 404, body: { ok: false, error: 'Not found.' } };
  db.prepare('DELETE FROM resources WHERE id = ?').run(Number(id));
  rebuild();
  return { status: 200, body: { ok: true } };
}
export function apiBulkImport(db, body, rebuild) {
  const items = Array.isArray(body.resources) ? body.resources.slice(0, 200) : null;
  if (!items) return { status: 400, body: { ok: false, error: 'Provide resources: [...up to 200].' } };
  let added = 0;
  const errors = [];
  for (let i = 0; i < items.length; i++) {
    const b = items[i] || {};
    const full = { title: '', description: '', subject: '', category: 'other', provider: '', fileType: 'other', year: '', tags: [], accessLevel: 'public', status: 'available', visibility: true, featured: false, audience: '', ...b };
    const errs = validateResource(full, false);
    if (errs.length) { errors.push(`#${i}: ${errs.join('; ')}`); continue; }
    const r = toRow(full, true);
    db.prepare(`INSERT INTO resources(public_id, title, description, subject, category, provider, file_type, year, tags, answers_included, audience, access_level, status, visibility, featured, size_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`)
      .run(cryptoId(), r.title, r.description, r.subject, r.category, r.provider, r.file_type, r.year,
        r.tags, r.answers_included, r.audience, r.access_level, r.status, r.visibility, r.featured,
        new Date().toISOString(), new Date().toISOString());
    added++;
  }
  rebuild();
  return { status: 200, body: { ok: true, added, errors: errors.slice(0, 20) } };
}
