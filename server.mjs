// SEHS platform server (zero deps): static UI + pages + JSON API + access gateway.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, getMeta, setMeta } from './server/db.mjs';
import {
  hashPassword, verifyPassword, newToken, tokenHash, parseCookies,
  sessionCookie, clearSessionCookie, rateLimiter, lockoutTracker, ipHash, uaFamily,
} from './server/crypto.mjs';
import { buildIndexes, forRole, loadRows, publicView } from './server/content.mjs';
import { search, suggest } from './search.js';
import { layout, esc } from './server/templates.mjs';
import { landing, searchPage, resourcePage, taxonomyPage, aboutPage, unlockPage, savedPage, parseSearchParams } from './server/pages.mjs';

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

// ---- sessions ----------------------------------------------------------------
const ROLE_TTL = { anon: 30 * 86400, viewer: 7 * 86400, admin: 12 * 3600 };
function getSession(req, createAnon = true) {
  const cookies = parseCookies(req.headers.cookie);
  const tok = cookies.sehs_session;
  if (tok) {
    const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash(tok));
    if (row && row.expires_at > nowIso()) {
      if (Date.now() - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
        db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
      }
      return { ...row, token: tok };
    }
  }
  if (!createAnon) return null;
  const token = newToken();
  const now = nowIso();
  const ip = clientIp(req);
  db.prepare(`INSERT INTO sessions(token_hash, role, created_at, expires_at, last_seen_at, ip_hash, ua_family, terms_version)
    VALUES (?, 'anon', ?, ?, ?, ?, ?, 0)`)
    .run(tokenHash(token), now, new Date(Date.now() + ROLE_TTL.anon * 1000).toISOString(),
      now, ipHash(ip, saltForIp()), uaFamily(req.headers['user-agent']));
  return { token, role: 'anon', fresh: true };
}
function setSessionCookie(res, session) {
  const ttl = ROLE_TTL[session.role] || ROLE_TTL.anon;
  res.setHeader('Set-Cookie', sessionCookie(session.token, { maxAgeSec: ttl, secure: SECURE }));
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

// ---- consent + terms ---------------------------------------------------------------
function consentGiven(req) {
  const c = parseCookies(req.headers.cookie).sehs_consent || '';
  return c === 'v1' || c.startsWith('v1|');
}
function consentCookie(secure) {
  const v = `v1|${new Date().toISOString().slice(0, 10)}`;
  const parts = [`sehs_consent=${v}`, 'Path=/', 'SameSite=Lax', 'Max-Age=31536000'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
function clearConsentCookie(secure) {
  const parts = ['sehs_consent=', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
function currentTermsVersion() {
  return Number(getMeta(db, 'terms_version') || 1);
}
async function apiConsent(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req, 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  if (body.accept === true) {
    logEvent('consent', { data: { accept: true } });
    secureHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': consentCookie(SECURE) });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  // withdraw: clear consent + kill session
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sehs_session) {
    try { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(cookies.sehs_session)); } catch { /* noop */ }
  }
  logEvent('consent', { data: { accept: false } });
  secureHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': [clearConsentCookie(SECURE), clearSessionCookie(SECURE)],
  });
  res.end(JSON.stringify({ ok: true, withdrawn: true }));
}
function apiTerms(_req, res) {
  const v = currentTermsVersion();
  const row = db.prepare('SELECT version, body_md, summary_md FROM terms WHERE version = ?').get(v);
  if (!row) return sendJson(res, 500, { ok: false, error: 'unavailable' });
  return sendJson(res, 200, { version: row.version, summary: row.summary_md, body: row.body_md });
}
function apiTermsStatus(_req, res, session) {
  const v = currentTermsVersion();
  const row = session.fresh ? null : db.prepare('SELECT terms_version FROM sessions WHERE token_hash = ?').get(tokenHash(session.token));
  const accepted = !!row && Number(row.terms_version) >= v;
  return sendJson(res, 200, { ok: true, accepted, version: v });
}
function apiTermsAccept(_req, res, session) {
  if (session.fresh) return sendJson(res, 401, { ok: false, error: 'Session required.' });
  const v = currentTermsVersion();
  db.prepare('UPDATE sessions SET terms_version = ?, last_seen_at = ? WHERE token_hash = ?')
    .run(v, nowIso(), tokenHash(session.token));
  logEvent('terms_accept', { data: { version: v } });
  return sendJson(res, 200, { ok: true, version: v });
}
function termsAccepted(session) {
  if (session.fresh) return false;
  const row = db.prepare('SELECT terms_version FROM sessions WHERE token_hash = ?').get(tokenHash(session.token));
  return !!row && Number(row.terms_version) >= currentTermsVersion();
}

// ---- API handlers ------------------------------------------------------------------
async function apiUnlock(req, res, session, ip) {
  if (!consentGiven(req)) return sendJson(res, 403, { ok: false, consentRequired: true, error: 'Please accept cookies first.' });
  if (!rlUnlock.allow('u:' + ip).ok) {
    logEvent('lockout', { data: { endpoint: 'unlock' } });
    return sendJson(res, 429, { ok: false, error: 'Too many attempts. Try again shortly.' });
  }
  const locked = unlockLockouts.locked(ip);
  if (locked) return sendJson(res, 429, { ok: false, error: 'Locked out.', retryAfter: locked });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const which = body.which === 'admin' ? 'admin' : 'viewer';
  const pw = String(body.password || '');
  if (!pw || pw.length > 500) {
    unlockLockouts.recordFail(ip);
    logEvent('unlock_fail', { data: { which } });
    return sendJson(res, 401, { ok: false, error: 'Incorrect password. Please try again.' });
  }
  const row = db.prepare('SELECT * FROM passwords WHERE role = ?').get(which);
  if (!row || !verifyPassword(pw, row.hash, row.salt)) {
    const e = unlockLockouts.recordFail(ip);
    logEvent('unlock_fail', { data: { which, fails: e.fails } });
    return sendJson(res, 401, { ok: false, error: 'Incorrect password. Please try again.' });
  }
  unlockLockouts.recordSuccess(ip);
  const token = newToken();
  const now = nowIso();
  // rotate: one active privileged session per token; drop old sessions of same role+ip? keep simple: insert new
  db.prepare(`INSERT INTO sessions(token_hash, role, created_at, expires_at, last_seen_at, ip_hash, ua_family, terms_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(version),0) - 1 FROM terms))`)
    .run(tokenHash(token), which, now, new Date(Date.now() + ROLE_TTL[which] * 1000).toISOString(),
      now, ipHash(ip, saltForIp()), uaFamily(req.headers['user-agent']));
  logEvent('unlock', { data: { which } });
  // purge expired sessions/grants opportunistically
  try {
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);
    db.prepare(`DELETE FROM grants WHERE expires_at < ?`).run(new Date(Date.now() - 7 * 86400000).toISOString());
  } catch { /* noop */ }
  setSessionCookie(res, { token, role: which });
  return sendJson(res, 200, { ok: true, role: which });
}

function apiLogout(_req, res, session) {
  if (session && !session.fresh) {
    try { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(session.token)); } catch { /* noop */ }
  }
  secureHeaders(res);
  res.writeHead(302, { Location: '/', 'Set-Cookie': clearSessionCookie(SECURE) });
  res.end();
}

function findResource(publicId) {
  if (!/^[0-9a-f]{32}$/.test(publicId || '')) return null;
  return db.prepare('SELECT * FROM resources WHERE public_id = ?').get(publicId) || null;
}
// Uniform missing response: same shape whether the id never existed, is hidden, or is tier-gated.
function apiMissing(res) {
  return sendJson(res, 404, { ok: false, error: 'Resource not found.' });
}

async function apiAccess(_req, res, session, ip, publicId) {
  if (!consentGiven(_req)) return sendJson(res, 403, { ok: false, consentRequired: true, error: 'Please accept cookies first.' });
  if (!termsAccepted(session)) {
    return sendJson(res, 403, { ok: false, termsRequired: true, version: currentTermsVersion(), error: 'Please accept the Terms & Conditions first.' });
  }
  const rl = rlAccess.allow('a:' + (session.token || ip));
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Too many requests. Slow down.' });
  const row = findResource(publicId);
  const role = session.role;
  const allowed = row && !!row.visibility && (row.access_level === 'public' || role === 'viewer' || role === 'admin');
  if (!allowed) {
    logEvent('open_denied', { data: {} });
    return apiMissing(res);
  }
  if (row.status === 'unavailable' && role !== 'admin') {
    logEvent('open_denied', { resourceId: row.id, data: { reason: 'unavailable' } });
    return sendJson(res, 410, { ok: false, error: 'This resource is temporarily unavailable.' });
  }
  // Consent + Terms already enforced above — only authorised sessions reach here.
  const token = newToken(24);  const now = nowIso();
  db.prepare(`INSERT INTO grants(token, resource_id, session_hash, created_at, expires_at, used_at)
    VALUES (?, ?, ?, ?, ?, NULL)`)
    .run(token, row.id, session.fresh ? null : tokenHash(session.token),
      now, new Date(Date.now() + 15 * 60 * 1000).toISOString());
  logEvent('open', { resourceId: row.id, data: { role } });
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

function apiSearch(_req, res, session, sp) {
  const role = session.role;
  const index = forRole(indexes, role);
  const p = parseSearchParams(sp);
  const rowMap = new Map(loadRows(db, role).map(r => [r.public_id, r]));
  const filter = (rec) => {
    if (p.cat.length && !p.cat.includes(rec.category)) return false;
    if (p.provider.length && !(rec.tags || []).some(t => p.provider.includes(t))) return false;
    return true;
  };
  const t0 = Date.now();
  let res2 = search(index, p.q, { filter });
  let arr = res2.results.filter(x => {
    const type = index.docs.find(d => d.rec.id === x.rec.id)?.type || '';
    x._type = type;
    if (p.type.length && !p.type.includes(type)) return false;
    if (p.year && (x.rec._year || '') !== p.year) return false;
    if (p.aud.length && !p.aud.includes(x.rec._audience || 'general')) return false;
    if (p.answers && !(x.rec.tags || []).includes('answers')) return false;
    return true;
  });
  if (p.sort === 'title-az') arr.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  else if (p.sort === 'title-za') arr.sort((a, b) => b.displayTitle.localeCompare(a.displayTitle));
  else if (p.sort === 'newest') arr.sort((a, b) => String(b.rec.dateModified || '').localeCompare(String(a.rec.dateModified || '')) || b.score - a.score);
  else if (p.sort === 'type') arr.sort((a, b) => String(a._type).localeCompare(String(b._type)) || a.displayTitle.localeCompare(b.displayTitle));
  else if (p.sort === 'answers') arr.sort((a, b) => (((b.rec.tags || []).includes('answers')) - ((a.rec.tags || []).includes('answers'))) || b.score - a.score);
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / p.per));
  const page = Math.min(p.page, pages);
  const items = arr.slice((page - 1) * p.per, page * p.per).map(x => {
    const row = rowMap.get(x.rec.id);
    if (!row) return null;
    return { ...publicView(row), displayTitle: x.displayTitle, score: Math.round(x.score * 10) / 10 };
  }).filter(Boolean);
  if (p.q.trim()) bumpAggregate(nowIso().slice(0, 10), 'query', p.q.trim().toLowerCase().slice(0, 120));
  return sendJson(res, 200, {
    ok: true, total, page, pages, per: p.per, mode: res2.mode, corrected: res2.corrected,
    ms: Date.now() - t0, results: items,
  });
}

function apiSuggest(_req, res, session, sp) {
  const prefix = (sp.get('prefix') || '').slice(0, 60);
  const out = suggest(forRole(indexes, session.role), prefix, 8)
    .map(s => ({ label: s.label, kind: s.kind, count: s.count }));
  return sendJson(res, 200, { ok: true, suggestions: out });
}

// Saved/recents hydration: tier-aware, order-preserving, hard-capped.
function apiByIds(_req, res, session, sp) {
  const role = session.role;
  const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(s => /^[0-9a-f]{32}$/.test(s)).slice(0, 100);
  if (!ids.length) return sendJson(res, 200, { ok: true, results: [] });
  const where = role === 'viewer' || role === 'admin' ? `visibility = 1` : `visibility = 1 AND access_level = 'public'`;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM resources WHERE ${where} AND public_id IN (${placeholders})`).all(...ids);
  const byId = new Map(rows.map(r => [r.public_id, r]));
  const index = forRole(indexes, role);
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
      const session = getSession(req);
      if (session.fresh) setSessionCookie(res, session);
      if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
      if (url.pathname === '/api/stats') {
        const role = session.role;
        const where = role === 'viewer' || role === 'admin' ? `visibility = 1` : `visibility = 1 AND access_level = 'public'`;
        const total = db.prepare(`SELECT COUNT(*) AS n FROM resources WHERE ${where}`).get().n;
        return sendJson(res, 200, { ok: true, publicResources: total, role });
      }
      if (url.pathname === '/api/session') return sendJson(res, 200, { ok: true, role: session.role });
      if (url.pathname === '/api/search' && req.method === 'GET') return apiSearch(req, res, session, url.searchParams);
      if (url.pathname === '/api/suggest' && req.method === 'GET') {
        if (!rlSuggest.allow('s:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many requests.' });
        return apiSuggest(req, res, session, url.searchParams);
      }
      if (url.pathname === '/api/by-ids' && req.method === 'GET') {
        if (!rlSuggest.allow('b:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many requests.' });
        return apiByIds(req, res, session, url.searchParams);
      }
      if (url.pathname === '/api/unlock' && req.method === 'POST') return apiUnlock(req, res, session, ip);
      if (url.pathname === '/api/logout') return apiLogout(req, res, session);
      if (url.pathname === '/api/consent' && req.method === 'POST') return apiConsent(req, res);
      if (url.pathname === '/api/terms' && req.method === 'GET') return apiTerms(req, res);
      if (url.pathname === '/api/terms/status' && req.method === 'GET') return apiTermsStatus(req, res, session);
      if (url.pathname === '/api/terms/accept' && req.method === 'POST') return apiTermsAccept(req, res, session);
      const m = url.pathname.match(/^\/api\/access\/([A-Za-z0-9_-]{1,64})$/);
      if (m && req.method === 'POST') return apiAccess(req, res, session, ip, m[1]);
      return sendJson(res, 404, { ok: false, error: 'Not found.' });
    }

    // single-use grant redemption (no session needed — the token IS the capability)
    const g = url.pathname.match(/^\/open\/([A-Za-z0-9_-]{16,64})$/);
    if (g && req.method === 'GET') return openGrant(req, res, g[1]);

    if (req.method !== 'GET') { secureHeaders(res); res.writeHead(405); res.end('method not allowed'); return; }
    const session = getSession(req);
    // set fresh anon cookie on page loads too
    const ctx = { db, indexes, session };
    const needsCookie = session.fresh;
    const html = (code, body) => {
      if (needsCookie) setSessionCookie(res, session);
      sendHtml(res, code, body);
    };
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
    if (url.pathname === '/unlock') return html(200, unlockPage(ctx));
    if (url.pathname === '/admin') {
      if (session.role !== 'admin') { secureHeaders(res); res.writeHead(404); res.end('not found'); return; }
      return html(200, layout({ title: 'Admin', body: '<div class="wrap" style="padding:32px 20px"><h1>Admin</h1><p>Dashboard lands in the next phase.</p></div>', session }));
    }
    return serveStatic(url.pathname, res);
  } catch (e) {
    try { sendJson(res, 500, { ok: false, error: 'unavailable' }); } catch { /* closed */ }
  }
});

server.listen(PORT, () => console.log(`sehs http://localhost:${PORT}`));
