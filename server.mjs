// SEHS platform server (zero deps): static UI + pages + JSON API + access gateway.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, getMeta, setMeta } from './server/db.mjs';
import {
  hashPassword, verifyPassword, newToken, tokenHash,
  rateLimiter, lockoutTracker, ipHash, uaFamily,
} from './server/crypto.mjs';
import { buildIndexes, forRole, loadRows, publicView } from './server/content.mjs';
import { autoDecks, adminDecks, deckCards } from './server/decks.mjs';
import { search, suggest } from './search.js';
import { layout, esc } from './server/templates.mjs';
import { landing, searchPage, resourcePage, taxonomyPage, aboutPage, unlockPage, savedPage, studyHubPage, studyDeckPage, parseSearchParams } from './server/pages.mjs';
import {
  adminMissing, apiAdminStats, adminDashboard, adminResources, adminAudit, adminSettings,
  apiResourceUpdate, apiResourceCreate, apiResourceDelete, apiBulkImport, runPurge,
} from './server/admin.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir);
const PORT = Number(process.env.PORT || 8080);
const SECURE = process.env.APP_SECURE === '1';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const db = openDb();
let indexes = buildIndexes(db);
export function rebuildIndexes() { indexes = buildIndexes(db); }

// ---- helpers ---------------------------------------------------------------
const nowIso = () => new Date().toISOString();
function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; " +
    "frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
}
function sendJson(res, code, obj, extra = {}) {
  secureHeaders(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(obj));
}
function sendHtml(res, code, html) {
  secureHeaders(res);
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}
function clientIp(req) {  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0] : req.socket.remoteAddress) || 'unknown';
  return ip.trim().slice(0, 80);
}
function saltForIp() {
  const month = nowIso().slice(0, 7);
  if (getMeta(db, 'ip_salt_month') !== month) {
    setMeta(db, 'ip_salt', crypto.randomBytes(16).toString('hex'));
    setMeta(db, 'ip_salt_month', month);
  }
  return getMeta(db, 'ip_salt');
}
function logEvent(type, { sessionHash = null, resourceId = null, data = {} } = {}) {
  try {
    const now = nowIso();
    db.prepare('INSERT INTO events(day, type, session_hash, resource_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(now.slice(0, 10), type, sessionHash, resourceId, JSON.stringify(data), now);
  } catch { /* logging must never break requests */ }
}
function bumpAggregate(day, kind, key) {
  try {
    db.prepare(`INSERT INTO daily_aggregates(day, kind, key, count) VALUES (?, ?, ?, 1)
      ON CONFLICT(day, kind, key) DO UPDATE SET count = count + 1`).run(day, kind, String(key).slice(0, 200));
  } catch { /* noop */ }
}

// ---- admin auth (bearer token, NO cookies) ------------------------------------------
// The admin password exchanges for a random 256-bit bearer token kept in the
// browser tab's sessionStorage and sent as an Authorization header. No cookies
// are ever set: no ambient credentials means CSRF is impossible by construction.
// Token dies with the tab (sessionStorage) and expires server-side in 12h.
const ADMIN_TTL_SEC = 12 * 3600;
function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer ([A-Za-z0-9_-]{43,44})$/);
  return m ? m[1] : null;
}
function getAdmin(req) {
  const tok = bearerToken(req);
  if (!tok) return null;
  const row = db.prepare("SELECT * FROM sessions WHERE token_hash = ? AND role = 'admin'").get(tokenHash(tok));
  if (!row || row.expires_at <= nowIso()) return null;
  if (Date.now() - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
  }
  return { ...row, token: tok };
}

// ---- rate limits ---------------------------------------------------------------
const rlApi = rateLimiter({ capacity: 120, refillPerSec: 2 });      // 120 burst, 2/s sustained per IP
const rlUnlock = rateLimiter({ capacity: 10, refillPerSec: 10 / 60 });
const rlAccess = rateLimiter({ capacity: 30, refillPerSec: 0.5 });
const rlSuggest = rateLimiter({ capacity: 60, refillPerSec: 1 });
const unlockLockouts = lockoutTracker({});

// ---- static ----------------------------------------------------------------------
function serveStatic(p, res) {
  if (p === '/') p = '/index.html';
  const blocked = ['/server/', '/state/', '/data/links.json', '/data/app.db', '/source-data/drive-files.json', '/.env', '/scripts/'];
  if (blocked.some(b => p === b || p.startsWith(b.endsWith('/') ? b : b + '/')) || p.includes('..')) {
    secureHeaders(res); res.writeHead(404); res.end('not found'); return;
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { secureHeaders(res); res.writeHead(404); res.end('not found'); return; }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { secureHeaders(res); res.writeHead(404); res.end('not found'); return; }
    secureHeaders(res);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
}

function readBody(req, maxBytes = 100 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > maxBytes) { req.destroy(); reject(new Error('payload too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---- terms (public text; acceptance is per-tab client state, see gate.js) --------
function currentTermsVersion() {
  return Number(getMeta(db, 'terms_version') || 1);
}
function apiTerms(_req, res) {
  const v = currentTermsVersion();
  const row = db.prepare('SELECT version, body_md, summary_md FROM terms WHERE version = ?').get(v);
  if (!row) return sendJson(res, 500, { ok: false, error: 'unavailable' });
  return sendJson(res, 200, { version: row.version, summary: row.summary_md, body: row.body_md });
}

// ---- API handlers ------------------------------------------------------------------
async function apiUnlock(req, res, ip) {
  if (!rlUnlock.allow('u:' + ip).ok) {
    logEvent('lockout', { data: { endpoint: 'unlock' } });
    return sendJson(res, 429, { ok: false, error: 'Too many attempts. Try again shortly.' });
  }
  const locked = unlockLockouts.locked(ip);
  if (locked) return sendJson(res, 429, { ok: false, error: 'Locked out.', retryAfter: locked });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const pw = String(body.password || '');
  if (!pw || pw.length > 500) {
    unlockLockouts.recordFail(ip);
    logEvent('unlock_fail', { data: { which: 'admin' } });
    return sendJson(res, 401, { ok: false, error: 'Incorrect password. Please try again.' });
  }
  const row = db.prepare('SELECT * FROM passwords WHERE role = ?').get('admin');
  if (!row || !verifyPassword(pw, row.hash, row.salt)) {
    const e = unlockLockouts.recordFail(ip);
    logEvent('unlock_fail', { data: { which: 'admin', fails: e.fails } });
    return sendJson(res, 401, { ok: false, error: 'Incorrect password. Please try again.' });
  }
  unlockLockouts.recordSuccess(ip);
  const token = newToken();
  const now = nowIso();
  db.prepare(`INSERT INTO sessions(token_hash, role, created_at, expires_at, last_seen_at, ip_hash, ua_family, terms_version)
    VALUES (?, 'admin', ?, ?, ?, ?, ?, 0)`)
    .run(tokenHash(token), now, new Date(Date.now() + ADMIN_TTL_SEC * 1000).toISOString(),
      now, ipHash(ip, saltForIp()), uaFamily(req.headers['user-agent']));
  logEvent('unlock', { data: { which: 'admin' } });
  // purge expired sessions/grants opportunistically
  try {
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);
    db.prepare(`DELETE FROM grants WHERE expires_at < ?`).run(new Date(Date.now() - 7 * 86400000).toISOString());
  } catch { /* noop */ }
  // Token returned in body (never a cookie): the tab keeps it in sessionStorage.
  return sendJson(res, 200, { ok: true, role: 'admin', token, expiresIn: ADMIN_TTL_SEC });
}

function apiLogout(req, res) {
  const admin = getAdmin(req);
  if (admin) {
    try { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(admin.token)); } catch { /* noop */ }
  }
  return sendJson(res, 200, { ok: true });
}

function findResource(publicId) {
  if (!/^[0-9a-f]{32}$/.test(publicId || '')) return null;
  return db.prepare('SELECT * FROM resources WHERE public_id = ?').get(publicId) || null;
}
// Uniform missing response: same shape whether the id never existed, is hidden, or is tier-gated.
function apiMissing(res) {
  return sendJson(res, 404, { ok: false, error: 'Resource not found.' });
}

async function apiAccess(req, res, ip, publicId) {
  const rl = rlAccess.allow('a:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Too many requests. Slow down.' });
  const row = findResource(publicId);
  // Everything is public; only visibility/status gate access. Uniform 404 otherwise.
  if (!row || !row.visibility) {
    logEvent('open_denied', { data: {} });
    return apiMissing(res);
  }
  if (row.status === 'unavailable') {
    logEvent('open_denied', { resourceId: row.id, data: { reason: 'unavailable' } });
    return sendJson(res, 410, { ok: false, error: 'This resource is temporarily unavailable.' });
  }
  const token = newToken(24);
  const now = nowIso();
  db.prepare(`INSERT INTO grants(token, resource_id, session_hash, created_at, expires_at, used_at)
    VALUES (?, ?, NULL, ?, ?, NULL)`)
    .run(token, row.id, now, new Date(Date.now() + 15 * 60 * 1000).toISOString());
  logEvent('open', { resourceId: row.id, data: {} });
  bumpAggregate(now.slice(0, 10), 'resource', row.public_id);
  return sendJson(res, 200, { ok: true, openUrl: `/open/${token}` });
}

function openGrant(_req, res, token) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return apiMissing(res);
  const g = db.prepare('SELECT * FROM grants WHERE token = ?').get(token);
  const now = nowIso();
  if (!g || g.used_at || g.expires_at < now) return apiMissing(res);
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(g.resource_id);
  if (!row || !row.visibility) return apiMissing(res);
  const src = db.prepare('SELECT * FROM resource_sources WHERE resource_id = ?').get(row.id);
  db.prepare('UPDATE grants SET used_at = ? WHERE token = ?').run(now, token);
  logEvent('open_redeemed', { resourceId: row.id, data: {} });
  if (!src || !src.provider_file_id) return apiMissing(res);
  const dest = row.category === 'folder'
    ? `https://drive.google.com/drive/folders/${src.provider_file_id}`
    : `https://drive.google.com/file/d/${src.provider_file_id}/view`;
  // Pre-lockdown: files are still link-shared; redirect works and is logged.
  // Post-lockdown (service account): this becomes a Drive API-mediated fetch.
  secureHeaders(res);
  res.writeHead(302, { Location: dest });
  res.end();
}

function apiSearch(_req, res, sp) {
  const index = forRole(indexes);
  const p = parseSearchParams(sp);
  const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
  const filter = (rec) => {
    if (p.cat.length && !p.cat.includes(rec.category)) return false;
    if (p.provider.length && !(rec.tags || []).some(t => p.provider.includes(t))) return false;
    return true;
  };
  const t0 = Date.now();
  let res2 = search(index, p.q, { filter });
  // on-device affinity re-ranking (tie-break only): ?aff=subject:3,provider:2
  const aff = parseAffinity(sp.get('aff'));
  let arr = res2.results.filter(x => {    const type = index.docs.find(d => d.rec.id === x.rec.id)?.type || '';
    x._type = type;
    if (p.type.length && !p.type.includes(type)) return false;
    if (p.year && (x.rec._year || '') !== p.year) return false;
    if (p.aud.length && !p.aud.includes(x.rec._audience || 'general')) return false;
    if (p.answers && !(x.rec.tags || []).includes('answers')) return false;
    if (aff.size) {
      let b = 0;
      for (const s of (x.rec.subjects || [])) b += aff.get('s:' + String(s).toLowerCase()) || 0;
      for (const t of (x.rec.tags || [])) b += aff.get('t:' + String(t).toLowerCase()) || 0;
      x.affBoost = Math.min(3, b * 0.15);
    }
    return true;
  });
  const affOn = aff.size > 0;
  if (p.sort === 'title-az') arr.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  else if (p.sort === 'title-za') arr.sort((a, b) => b.displayTitle.localeCompare(a.displayTitle));
  else if (p.sort === 'newest') arr.sort((a, b) => String(b.rec.dateModified || '').localeCompare(String(a.rec.dateModified || '')) || b.score - a.score);
  else if (p.sort === 'type') arr.sort((a, b) => String(a._type).localeCompare(String(b._type)) || a.displayTitle.localeCompare(b.displayTitle));
  else if (p.sort === 'answers') arr.sort((a, b) => (((b.rec.tags || []).includes('answers')) - ((a.rec.tags || []).includes('answers'))) || b.score - a.score);
  else if (affOn) arr.sort((a, b) => (b.score + (b.affBoost || 0)) - (a.score + (a.affBoost || 0)));
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / p.per));
  const page = Math.min(p.page, pages);
  const items = arr.slice((page - 1) * p.per, page * p.per).map(x => {
    const row = rowMap.get(x.rec.id);
    if (!row) return null;
    return { ...publicView(row), displayTitle: x.displayTitle, score: Math.round(x.score * 10) / 10 };
  }).filter(Boolean);
  if (p.q.trim()) {
    bumpAggregate(nowIso().slice(0, 10), 'query', p.q.trim().toLowerCase().slice(0, 120));
    if (total === 0) logEvent('search_zero', { data: { q: p.q.trim().slice(0, 120) } });
  }
  return sendJson(res, 200, {
    ok: true, total, page, pages, per: p.per, mode: res2.mode, corrected: res2.corrected,
    dropped: res2.dropped || [], related: res2.related || [], tuned: affOn,
    ms: Date.now() - t0, results: items,
  });
}

// ?aff=s:mathematics:3,t:acer:2 — validated, capped affinity vector (tie-break only)
function parseAffinity(raw) {
  const m = new Map();
  if (!raw) return m;
  for (const part of String(raw).slice(0, 400).split(',')) {
    const mm = part.match(/^([st]):([a-z0-9-]{2,30}):(\d{1,2})$/);
    if (mm) m.set(`${mm[1]}:${mm[2]}`, Math.min(10, Number(mm[3])));
    if (m.size >= 12) break;
  }
  return m;
}

// Trending: top-opened resources, last 7 days (anonymous aggregates only).
function apiTrending(_req, res) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT key, SUM(count) c FROM daily_aggregates
    WHERE kind = 'resource' AND day >= ? GROUP BY key ORDER BY c DESC LIMIT 8`).all(since);
  const index = forRole(indexes);
  const docById = new Map(index.docs.map(d => [d.rec.id, d]));
  const items = [];
  for (const r of rows) {
    const row = db.prepare('SELECT * FROM resources WHERE public_id = ? AND visibility = 1').get(r.key);
    if (!row) continue;
    const d = docById.get(r.key);
    items.push({ ...publicView(row), displayTitle: d ? d.displayTitle : row.title, opens: r.c });
  }
  return sendJson(res, 200, { ok: true, results: items });
}

function apiSuggest(_req, res, sp) {
  const prefix = (sp.get('prefix') || '').slice(0, 60);
  const out = suggest(forRole(indexes), prefix, 8)
    .map(s => ({ label: s.label, kind: s.kind, count: s.count }));
  return sendJson(res, 200, { ok: true, suggestions: out });
}

// Saved/recents hydration: order-preserving, hard-capped (everything public).
function apiByIds(_req, res, sp) {
  const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(s => /^[0-9a-f]{32}$/.test(s)).slice(0, 100);
  if (!ids.length) return sendJson(res, 200, { ok: true, results: [] });
  const where = `visibility = 1`;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM resources WHERE ${where} AND public_id IN (${placeholders})`).all(...ids);
  const byId = new Map(rows.map(r => [r.public_id, r]));
  const index = forRole(indexes);
  const docById = new Map(index.docs.map(d => [d.rec.id, d]));
  const results = ids.map(id => {
    const row = byId.get(id);
    if (!row) return null;
    const d = docById.get(id);
    return { ...publicView(row), displayTitle: d ? d.displayTitle : row.title };
  }).filter(Boolean);
  return sendJson(res, 200, { ok: true, results });
}

// ---- router ----------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = clientIp(req);
  try {
    // public API with global rate limit
    if (url.pathname.startsWith('/api/')) {
      if (!rlApi.allow('g:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many requests.' });
      // CSRF: state-changing API calls must come from our fetch clients (logout form exempt)
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && url.pathname !== '/api/logout' &&
        req.headers['x-requested-with'] !== 'fetch') {
        return sendJson(res, 403, { ok: false, error: 'Invalid request.' });
      }
      const session = null; // public API is stateless (IP rate limits); admin uses bearer tokens
      if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
      if (url.pathname === '/api/stats') {
        const total = db.prepare(`SELECT COUNT(*) AS n FROM resources WHERE visibility = 1`).get().n;
        return sendJson(res, 200, { ok: true, publicResources: total });
      }
      if (url.pathname === '/api/me') {
        const admin = getAdmin(req);
        return sendJson(res, 200, { ok: true, role: admin ? 'admin' : null });
      }
      if (url.pathname === '/api/search' && req.method === 'GET') return apiSearch(req, res, url.searchParams);
      if (url.pathname === '/api/suggest' && req.method === 'GET') {
        if (!rlSuggest.allow('s:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many requests.' });
        return apiSuggest(req, res, url.searchParams);
      }
      if (url.pathname === '/api/by-ids' && req.method === 'GET') {
        if (!rlSuggest.allow('b:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many requests.' });
        return apiByIds(req, res, url.searchParams);
      }
      if (url.pathname === '/api/trending' && req.method === 'GET') return apiTrending(req, res);
      if (url.pathname === '/api/decks' && req.method === 'GET') {
        const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
        return sendJson(res, 200, {
          ok: true,
          decks: [...autoDecks(forRole(indexes), rowMap), ...adminDecks(db)]
            .map(d => ({ id: d.id, source: d.source, title: d.title, description: d.description, count: d.count })),
        });
      }
      const dm = url.pathname.match(/^\/api\/decks\/([A-Za-z0-9-]{1,40})$/);
      if (dm && req.method === 'GET') {
        const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
        const deck = deckCards(db, forRole(indexes), rowMap, dm[1]);
        if (!deck) return sendJson(res, 404, { ok: false, error: 'Not found.' });
        if (deck.cards.length > 200) deck.cards = deck.cards.slice(0, 200);
        return sendJson(res, 200, { ok: true, deck });
      }
      if (url.pathname === '/api/unlock' && req.method === 'POST') return apiUnlock(req, res, ip);
      if (url.pathname === '/api/logout' && req.method === 'POST') return apiLogout(req, res);
      if (url.pathname === '/api/terms' && req.method === 'GET') return apiTerms(req, res);
      const m = url.pathname.match(/^\/api\/access\/([A-Za-z0-9_-]{1,64})$/);
      if (m && req.method === 'POST') return apiAccess(req, res, ip, m[1]);
      // ---- admin API (bearer-gated, uniform 404 otherwise) ----
      if (url.pathname.startsWith('/api/admin/')) {
        const admin = getAdmin(req);
        if (!admin) return adminMissing(res, sendJson);
        if (url.pathname === '/api/admin/stats' && req.method === 'GET') {
          const s = apiAdminStats(db);
          return sendJson(res, 200, s);
        }
        if (url.pathname === '/api/admin/resources' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const r = apiResourceCreate(db, body, rebuildIndexes);
          return sendJson(res, r.status, r.body);
        }
        if (url.pathname === '/api/admin/resources/bulk' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req, 500 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const r = apiBulkImport(db, body, rebuildIndexes);
          return sendJson(res, r.status, r.body);
        }
        const rm = url.pathname.match(/^\/api\/admin\/resources\/(\d+)$/);
        if (rm) {
          if (req.method === 'GET') {
            const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(rm[1]));
            if (!row) return adminMissing(res, sendJson);
            return sendJson(res, 200, { ok: true, resource: publicView(row) });
          }
          if (req.method === 'PATCH') {
            let body;
            try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
            const r = apiResourceUpdate(db, rm[1], body, rebuildIndexes);
            return sendJson(res, r.status, r.body);
          }
          if (req.method === 'DELETE') {
            const r = apiResourceDelete(db, rm[1], rebuildIndexes);
            return sendJson(res, r.status, r.body);
          }
          return adminMissing(res, sendJson);
        }
        if (url.pathname === '/api/admin/sessions/revoke' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const rid = Number(body.rowid);
          if (!rid) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
          db.prepare('DELETE FROM sessions WHERE rowid = ?').run(rid);
          logEvent('admin', { data: { action: 'revoke_session' } });
          return sendJson(res, 200, { ok: true });
        }
        if (url.pathname === '/api/admin/sessions/revoke-all' && req.method === 'POST') {
          db.prepare(`DELETE FROM sessions WHERE role = 'admin'`).run();
          logEvent('admin', { data: { action: 'revoke_all' } });
          return sendJson(res, 200, { ok: true });
        }
        if (url.pathname === '/api/admin/password' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const role = 'admin'; // single-password system: admin only
          const next = String(body.next || '');
          if (next.length < 16 || next.length > 500) return sendJson(res, 400, { ok: false, error: 'New password must be 16+ characters.' });
          const adminRow = db.prepare('SELECT * FROM passwords WHERE role = ?').get('admin');
          if (!adminRow || !verifyPassword(String(body.current || ''), adminRow.hash, adminRow.salt)) {
            return sendJson(res, 401, { ok: false, error: 'Current admin password is incorrect.' });
          }
          const { hash, salt } = hashPassword(next);
          db.prepare('UPDATE passwords SET hash = ?, salt = ?, rotated_at = ? WHERE role = ?')
            .run(hash, salt, nowIso(), role);
          // revoke all sessions of that role except the caller's own
          db.prepare('DELETE FROM sessions WHERE role = ? AND token_hash != ?')
            .run(role, tokenHash(admin.token));
          logEvent('admin', { data: { action: 'rotate_password', role } });
          return sendJson(res, 200, { ok: true, relogin: false });
        }
        if (url.pathname === '/api/admin/terms' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req, 100 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const summary = String(body.summary || '').slice(0, 600).trim();
          const btext = String(body.body || '').slice(0, 20000).trim();
          if (!summary || !btext) return sendJson(res, 400, { ok: false, error: 'Summary and body are required.' });
          const maxV = db.prepare('SELECT COALESCE(MAX(version),0) v FROM terms').get().v;
          db.prepare('INSERT INTO terms(version, body_md, summary_md, created_at, created_by) VALUES (?, ?, ?, ?, ?)')
            .run(maxV + 1, btext, summary, nowIso(), 'admin');
          setMeta(db, 'terms_version', String(maxV + 1));
          logEvent('admin', { data: { action: 'terms_publish', version: maxV + 1 } });
          return sendJson(res, 200, { ok: true, version: maxV + 1 });
        }
        if (url.pathname === '/api/admin/retention' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const days = Math.min(365, Math.max(7, Number(body.days) || 30));
          setMeta(db, 'retention_days', String(days));
          logEvent('admin', { data: { action: 'retention', days } });
          return sendJson(res, 200, { ok: true, days });
        }
        if (url.pathname === '/api/admin/purge' && req.method === 'POST') {
          const r = runPurge(db);
          logEvent('admin', { data: { action: 'purge', deleted: r.deleted } });
          return sendJson(res, 200, { ok: true, ...r });
        }
        if (url.pathname === '/api/admin/decks' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const title = String(body.title || '').trim().slice(0, 120);
          if (title.length < 2) return sendJson(res, 400, { ok: false, error: 'Title needs 2+ characters.' });
          const pid = crypto.randomBytes(16).toString('hex');
          const now = nowIso();
          const info = db.prepare('INSERT INTO decks(public_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run(pid, title, String(body.description || '').slice(0, 500), now, now);
          logEvent('admin', { data: { action: 'deck_create' } });
          return sendJson(res, 201, { ok: true, id: Number(info.lastInsertRowid), publicId: pid });
        }
        const dkm = url.pathname.match(/^\/api\/admin\/decks\/(\d+)(\/cards)?$/);
        if (dkm) {
          const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(Number(dkm[1]));
          if (!deck) return adminMissing(res, sendJson);
          if (req.method === 'PATCH') {
            let body;
            try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
            const sets = [], vals = [];
            if (body.title !== undefined) {
              const t = String(body.title).trim().slice(0, 120);
              if (t.length < 2) return sendJson(res, 400, { ok: false, error: 'Title needs 2+ characters.' });
              sets.push('title = ?'); vals.push(t);
            }
            if (body.description !== undefined) { sets.push('description = ?'); vals.push(String(body.description).slice(0, 500)); }
            if (!sets.length) return sendJson(res, 400, { ok: false, error: 'Nothing to update.' });
            sets.push('updated_at = ?'); vals.push(nowIso()); vals.push(deck.id);
            db.prepare(`UPDATE decks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
            logEvent('admin', { data: { action: 'deck_update' } });
            return sendJson(res, 200, { ok: true });
          }
          if (req.method === 'DELETE' && !dkm[2]) {
            db.prepare('DELETE FROM decks WHERE id = ?').run(deck.id);
            logEvent('admin', { data: { action: 'deck_delete' } });
            return sendJson(res, 200, { ok: true });
          }
          if (req.method === 'PUT' && dkm[2] === '/cards') {
            let body;
            try { body = JSON.parse(await readBody(req, 500 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
            const cards = Array.isArray(body.cards) ? body.cards.slice(0, 500) : null;
            if (!cards) return sendJson(res, 400, { ok: false, error: 'Provide cards: [...up to 500].' });
            db.exec('BEGIN');
            try {
              db.prepare('DELETE FROM deck_cards WHERE deck_id = ?').run(deck.id);
              const ins = db.prepare('INSERT INTO deck_cards(deck_id, front, back, position) VALUES (?, ?, ?, ?)');
              let pos = 0, added = 0;
              for (const c of cards) {
                const f = String(c.front || '').trim().slice(0, 500);
                const b = String(c.back || '').trim().slice(0, 2000);
                if (!f || !b) continue;
                ins.run(deck.id, f, b, pos++);
                added++;
              }
              db.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(nowIso(), deck.id);
              db.exec('COMMIT');
              logEvent('admin', { data: { action: 'deck_cards', added } });
              return sendJson(res, 200, { ok: true, added });
            } catch (e) {
              db.exec('ROLLBACK');
              return sendJson(res, 500, { ok: false, error: 'unavailable' });
            }
          }
          return adminMissing(res, sendJson);
        }
        return adminMissing(res, sendJson);
      }
      return sendJson(res, 404, { ok: false, error: 'Not found.' });
    }

    // single-use grant redemption (no session needed — the token IS the capability)
    const g = url.pathname.match(/^\/open\/([A-Za-z0-9_-]{16,64})$/);
    if (g && req.method === 'GET') return openGrant(req, res, g[1]);

    if (req.method !== 'GET') { secureHeaders(res); res.writeHead(405); res.end('method not allowed'); return; }
    // Pages are public; the header shows an Admin link only with a valid bearer session.
    // Page shells carry no sensitive data — all admin data loads via bearer-authed API.
    const admin = getAdmin(req);
    const ctx = { db, indexes, session: admin ? { role: 'admin' } : null };
    const html = (code, body) => sendHtml(res, code, body);
    if (url.pathname === '/') return html(200, landing(ctx));
    if (url.pathname === '/search') return html(200, searchPage(ctx, url.searchParams));
    const rm = url.pathname.match(/^\/r\/([A-Za-z0-9_-]{1,64})$/);
    if (rm) {
      const r = resourcePage(ctx, rm[1]);
      return html(r.code, r.html);
    }
    if (url.pathname === '/subjects') return html(200, taxonomyPage(ctx, 'subjects'));
    if (url.pathname === '/providers') return html(200, taxonomyPage(ctx, 'providers'));
    if (url.pathname === '/about') return html(200, aboutPage(ctx));
    if (url.pathname === '/saved') return html(200, savedPage(ctx));
    if (url.pathname === '/study') return html(200, studyHubPage(ctx));
    const sm = url.pathname.match(/^\/study\/([A-Za-z0-9-]{1,40})$/);
    if (sm) return html(200, studyDeckPage(ctx, sm[1]));
    if (url.pathname === '/unlock') return html(200, unlockPage(ctx));
    // Admin pages serve inert shells to everyone; ALL data loads through
    // bearer-authed /api/admin/* calls (navigation requests can't carry headers).
    if (url.pathname === '/admin') return html(200, adminDashboard({ db, indexes, session: null }));
    if (url.pathname === '/admin/resources') return html(200, adminResources({ db, indexes, session: null }, url.searchParams));
    if (url.pathname === '/admin/audit') return html(200, adminAudit({ db, indexes, session: null }, url.searchParams));
    if (url.pathname === '/admin/settings') return html(200, adminSettings({ db, indexes, session: null }));
    return serveStatic(url.pathname, res);
  } catch (e) {
    try { sendJson(res, 500, { ok: false, error: 'unavailable' }); } catch { /* closed */ }
  }
});

server.listen(PORT, () => console.log(`sehs http://localhost:${PORT}`));
