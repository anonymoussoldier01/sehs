// SEHS platform server: static UI + pages + JSON API + access gateway.
// Runs two ways: `node server.mjs` (local, long-lived) and `api/index.js`
// (Vercel serverless). All database access is async via the unified interface
// (SQLite locally, Postgres when DATABASE_URL is set).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase, openDb, getMeta, setMeta, dbPath } from './server/db.mjs';
import {
  hashPassword, verifyPassword, newToken, tokenHash,
  rateLimiter, lockoutTracker, ipHash, uaFamily,
} from './server/crypto.mjs';
import { buildIndexes, forRole, loadRows, publicView } from './server/content.mjs';
import { autoDecks, adminDecks, deckCards } from './server/decks.mjs';
import { search, suggest } from './search.js';
import { layout, esc } from './server/templates.mjs';
import { landing, searchPage, resourcePage, taxonomyPage, aboutPage, unlockPage, savedPage, sharedListPage, studyHubPage, studyDeckPage, requestPage, parseSearchParams, examGuidePage, mocksPage, mockRunnerPage, writingPage, drillsPage, readingPage } from './server/pages.mjs';
import {
  adminMissing, apiAdminStats, adminDashboard, adminResources, adminAudit, adminTriage, adminSettings,
  apiResourceUpdate, apiResourceCreate, apiResourceDelete, apiBulkImport, runPurge,
} from './server/admin.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir);
const DIST = path.join(ROOT, 'client', 'dist');
const DIST_INDEX = path.join(DIST, 'index.html');
const distOn = () => {
  try {
    return fs.statSync(DIST_INDEX).isFile();
  } catch {
    return false;
  }
};
// React SPA routes (served from client/dist when built, legacy MPA otherwise).
// /admin*, /open/*, /feed.xml and /api/* always stay on the server.
const SPA_RE = /^\/(search|subjects|providers|about|terms|privacy|saved|request|study|exam-guide|mocks|writing|reading|drills|unlock|list|design|whats-new|r)(\/|$)/;
function distFile(p) {
  try {
    const f = path.join(DIST, decodeURIComponent(p));
    if (!f.startsWith(DIST)) return null;
    return fs.statSync(f).isFile() ? f : null;
  } catch {
    return null;
  }
}
const PORT = Number(process.env.PORT || 8080);
const SECURE = process.env.APP_SECURE === '1' || Boolean(process.env.VERCEL);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.avif': 'image/avif' };
function sendFile(res, f) {
  secureHeaders(res);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}

// Lazy async boot shared by long-lived and serverless runtimes.
let db = null;
let indexes = null;
let initPromise = null;
function validateEnv() {
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required on Vercel (Vercel Postgres / Neon).');
  }
}
async function ensureSeeded() {
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM resources').get()).n;
  if (n > 0) return;
  const pw = process.env.SEHS_ADMIN_PASSWORD;
  // Seeding a production DB without a known admin password would lock everyone out.
  if (!pw) throw new Error('Refusing to seed: SEHS_ADMIN_PASSWORD is not set.');
  const { hashPassword } = await import('./server/crypto.mjs');
  const { hash, salt } = hashPassword(pw);
  await db.prepare('INSERT INTO passwords(role, hash, salt, created_at) VALUES (?, ?, ?, ?)')
    .run('admin', hash, salt, new Date().toISOString());
  console.log('seeded fresh database (resources + admin password from env)');
}
async function ready() {
  if (indexes) return;
  if (!initPromise) {
    initPromise = (async () => {
      validateEnv();
      // Local dev uses the synchronous SQLite handle: every call site in
      // server/content/pages/admin/decks is sync-style, and `await v` on a
      // plain value is a no-op, so sync works for awaited callers too.
      // Only the Postgres (Vercel) branch uses the async interface.
      if (process.env.DATABASE_URL) {
        db = await openDatabase();
      } else {
        db = openDb();
      }
      await ensureSeeded();
      indexes = await buildIndexes(db);
    })().catch((e) => { initPromise = null; throw e; });
  }
  await initPromise;
}
export async function rebuildIndexes() { indexes = await buildIndexes(db); }

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
    "frame-src 'self' https://drive.google.com; " +
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
async function saltForIp() {
  const month = nowIso().slice(0, 7);
  if (await getMeta(db, 'ip_salt_month') !== month) {
    await setMeta(db, 'ip_salt', crypto.randomBytes(16).toString('hex'));
    await setMeta(db, 'ip_salt_month', month);
  }
  return getMeta(db, 'ip_salt');
}
async function logEvent(type, { sessionHash = null, resourceId = null, data = {} } = {}) {
  try {
    const now = nowIso();
    await db.prepare('INSERT INTO events(day, type, session_hash, resource_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(now.slice(0, 10), type, sessionHash, resourceId, JSON.stringify(data), now);
  } catch { /* logging must never break requests */ }
}
async function bumpAggregate(day, kind, key) {
  try {
    await db.prepare(`INSERT INTO daily_aggregates(day, kind, key, count) VALUES (?, ?, ?, 1)
      ON CONFLICT(day, kind, key) DO UPDATE SET count = count + 1`).run(day, kind, String(key).slice(0, 200));
  } catch { /* noop */ }
}

// ---- admin auth (per-tab bearer token) ------------------------------------------
// The admin password exchanges for a random 256-bit bearer token kept in the
// browser tab's sessionStorage and sent as an Authorization header. Admin
// requests never rely on ambient credentials, so CSRF is impossible by
// construction. Token dies with the tab (sessionStorage) and expires
// server-side in 12h.
const ADMIN_TTL_SEC = 12 * 3600;
function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer ([A-Za-z0-9_-]{43,44})$/);
  return m ? m[1] : null;
}
async function getAdmin(req) {
  const tok = bearerToken(req);
  if (!tok) return null;
  const row = await db.prepare("SELECT * FROM sessions WHERE token_hash = ? AND role = 'admin'").get(tokenHash(tok));
  if (!row || row.expires_at <= nowIso()) return null;
  if (Date.now() - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
    await db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
  }
  return { ...row, token: tok };
}

// ---- rate limits ---------------------------------------------------------------
const rlApi = rateLimiter({ capacity: 120, refillPerSec: 2 });      // 120 burst, 2/s sustained per IP
const rlUnlock = rateLimiter({ capacity: 10, refillPerSec: 10 / 60 });
const rlAccess = rateLimiter({ capacity: 30, refillPerSec: 0.5 });
const rlSuggest = rateLimiter({ capacity: 60, refillPerSec: 1 });
const rlReport = rateLimiter({ capacity: 5, refillPerSec: 5 / 3600 }); // 5 per hour per IP
const rlAi = rateLimiter({ capacity: 3, refillPerSec: 3 / 60 }); // ~1 AI request per 20s per IP
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
  // Serverless runtimes (Vercel) pre-parse JSON bodies into req.body and the
  // raw stream is already consumed — reuse it instead of hanging on 'end'.
  if (req.body !== undefined && req.body !== null) {
    const s = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(s, 'utf8') > maxBytes) return Promise.reject(new Error('payload too large'));
    return Promise.resolve(s);
  }
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
async function currentTermsVersion() {
  return Number(await getMeta(db, 'terms_version') || 1);
}
async function apiTerms(_req, res) {
  const v = await currentTermsVersion();
  const row = await db.prepare('SELECT version, body_md, summary_md FROM terms WHERE version = ?').get(v);
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
  const row = await db.prepare('SELECT * FROM passwords WHERE role = ?').get('admin');
  if (!row || !verifyPassword(pw, row.hash, row.salt)) {
    const e = unlockLockouts.recordFail(ip);
    logEvent('unlock_fail', { data: { which: 'admin', fails: e.fails } });
    return sendJson(res, 401, { ok: false, error: 'Incorrect password. Please try again.' });
  }
  unlockLockouts.recordSuccess(ip);
  const token = newToken();
  const now = nowIso();
  await db.prepare(`INSERT INTO sessions(token_hash, role, created_at, expires_at, last_seen_at, ip_hash, ua_family, terms_version)
    VALUES (?, 'admin', ?, ?, ?, ?, ?, 0)`)
    .run(tokenHash(token), now, new Date(Date.now() + ADMIN_TTL_SEC * 1000).toISOString(),
      now, ipHash(ip, await saltForIp()), uaFamily(req.headers['user-agent']));
  logEvent('unlock', { data: { which: 'admin' } });
  // purge expired sessions/grants opportunistically
  try {
    await db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);
    await db.prepare(`DELETE FROM grants WHERE expires_at < ?`).run(new Date(Date.now() - 7 * 86400000).toISOString());
  } catch { /* noop */ }
  // Token returned in body (never a cookie): the tab keeps it in sessionStorage.
  return sendJson(res, 200, { ok: true, role: 'admin', token, expiresIn: ADMIN_TTL_SEC });
}

async function apiLogout(req, res) {
  const admin = await getAdmin(req);
  if (admin) {
    try { await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(admin.token)); } catch { /* noop */ }
  }
  return sendJson(res, 200, { ok: true });
}

async function findResource(publicId) {
  if (!/^[0-9a-f]{32}$/.test(publicId || '')) return null;
  return await db.prepare('SELECT * FROM resources WHERE public_id = ?').get(publicId) || null;
}
// Uniform missing response: same shape whether the id never existed, is hidden, or is tier-gated.
function apiMissing(res) {
  return sendJson(res, 404, { ok: false, error: 'Resource not found.' });
}

async function apiAccess(req, res, ip, publicId) {
  const rl = rlAccess.allow('a:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Too many requests. Slow down.' });
  const row = await findResource(publicId);
  // Files-only: folders never resolve. Uniform 404 otherwise.
  if (!row || !row.visibility || row.file_type === 'folder' || row.category === 'folder') {
    logEvent('open_denied', { data: {} });
    return apiMissing(res);
  }
  if (row.status === 'unavailable') {
    logEvent('open_denied', { resourceId: row.id, data: { reason: 'unavailable' } });
    return sendJson(res, 410, { ok: false, error: 'This resource is temporarily unavailable.' });
  }
  const token = newToken(24);
  const now = nowIso();
  await db.prepare(`INSERT INTO grants(token, resource_id, session_hash, created_at, expires_at, used_at)
    VALUES (?, ?, NULL, ?, ?, NULL)`)
    .run(token, row.id, now, new Date(Date.now() + 15 * 60 * 1000).toISOString());
  logEvent('open', { resourceId: row.id, data: {} });
  bumpAggregate(now.slice(0, 10), 'resource', row.public_id);
  return sendJson(res, 200, { ok: true, openUrl: `/open/${token}` });
}

// In-site preview: same guarantees as opens (single-use 15-min grant, logged,
// uniform 404s, IDs never shipped) but lands on Drive's /preview endpoint so
// PDFs read inside an iframe on the resource page.
async function apiPreview(req, res, ip, publicId) {
  const rl = rlAccess.allow('p:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Too many requests. Slow down.' });
  const row = await findResource(publicId);
  if (!row || !row.visibility || row.file_type === 'folder' || row.category === 'folder') {
    logEvent('open_denied', { data: {} });
    return apiMissing(res);
  }
  if (row.status === 'unavailable') {
    logEvent('open_denied', { resourceId: row.id, data: { reason: 'unavailable' } });
    return sendJson(res, 410, { ok: false, error: 'This resource is temporarily unavailable.' });
  }
  const token = newToken(24);
  const now = nowIso();
  await db.prepare(`INSERT INTO grants(token, resource_id, session_hash, created_at, expires_at, used_at)
    VALUES (?, ?, NULL, ?, ?, NULL)`)
    .run(token, row.id, now, new Date(Date.now() + 15 * 60 * 1000).toISOString());
  logEvent('preview', { resourceId: row.id, data: {} });
  return sendJson(res, 200, { ok: true, embedUrl: `/embed/${token}` });
}

async function embedGrant(_req, res, token) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return apiMissing(res);
  const g = await db.prepare('SELECT * FROM grants WHERE token = ?').get(token);
  const now = nowIso();
  if (!g || g.used_at || g.expires_at < now) return apiMissing(res);
  const row = await db.prepare('SELECT * FROM resources WHERE id = ?').get(g.resource_id);
  if (!row || !row.visibility || row.file_type === 'folder' || row.category === 'folder') return apiMissing(res);
  const src = await db.prepare('SELECT * FROM resource_sources WHERE resource_id = ?').get(row.id);
  await db.prepare('UPDATE grants SET used_at = ? WHERE token = ?').run(now, token);
  logEvent('preview_redeemed', { resourceId: row.id, data: {} });
  if (!src || !src.provider_file_id) return apiMissing(res);
  const dest = `https://drive.google.com/file/d/${src.provider_file_id}/preview`;
  secureHeaders(res);
  res.writeHead(302, { Location: dest });
  res.end();
}

async function openGrant(_req, res, token) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return apiMissing(res);
  const g = await db.prepare('SELECT * FROM grants WHERE token = ?').get(token);
  const now = nowIso();
  if (!g || g.used_at || g.expires_at < now) return apiMissing(res);
  const row = await db.prepare('SELECT * FROM resources WHERE id = ?').get(g.resource_id);
  if (!row || !row.visibility || row.file_type === 'folder' || row.category === 'folder') return apiMissing(res);
  const src = await db.prepare('SELECT * FROM resource_sources WHERE resource_id = ?').get(row.id);
  await db.prepare('UPDATE grants SET used_at = ? WHERE token = ?').run(now, token);
  logEvent('open_redeemed', { resourceId: row.id, data: {} });
  if (!src || !src.provider_file_id) return apiMissing(res);
  const dest = `https://drive.google.com/file/d/${src.provider_file_id}/view`;
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
async function apiTrending(_req, res) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const rows = await db.prepare(`SELECT key, SUM(count) c FROM daily_aggregates
    WHERE kind = 'resource' AND day >= ? GROUP BY key ORDER BY c DESC LIMIT 8`).all(since);
  const index = forRole(indexes);
  const docById = new Map(index.docs.map(d => [d.rec.id, d]));
  const items = [];
  for (const r of rows) {
    const row = await db.prepare(`SELECT * FROM resources WHERE public_id = ? AND visibility = 1 AND file_type != 'folder' AND category != 'folder'`).get(r.key);
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
async function apiByIds(_req, res, sp) {  const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(s => /^[0-9a-f]{32}$/.test(s)).slice(0, 100);
  if (!ids.length) return sendJson(res, 200, { ok: true, results: [] });
  const where = `visibility = 1 AND file_type != 'folder' AND category != 'folder'`;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.prepare(`SELECT * FROM resources WHERE ${where} AND public_id IN (${placeholders})`).all(...ids);
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

// ---- native SEHS banks (static JSON, no DB, same privacy: localStorage only) ----
const nativeCache = new Map();
function nativeJson(name) {
  if (nativeCache.has(name)) return nativeCache.get(name);
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'native', name), 'utf8'));
    nativeCache.set(name, j);
    return j;
  } catch { return null; }
}
function shuffled(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// Short answer for MCQ options: first clause of a flashcard back
// ("2/3. ÷6" → "2/3", "Play. part-to-whole" → "Play").
function shortAns(back) {
  const t = String(back || '').trim();
  const head = t.split(/(?<=[.!?])\s+/)[0] || t;
  return head.slice(0, 90).trim();
}
function buildBankMcqs(cards, n, strand) {
  const pool = shuffled([...(cards || [])]);
  const out = [];
  for (const c of pool) {
    if (out.length >= n) break;
    if (!c || !c.front || !c.back) continue;
    const correct = shortAns(c.back);
    // skip degenerate items: empty/short answers, or answer == question
    if (!correct || correct.length < 2) continue;
    if (correct.toLowerCase() === String(c.front).trim().toLowerCase().slice(0, 90)) continue;
    const distract = [];
    for (const d of shuffled([...pool])) {
      if (d === c || !d.back) continue;
      const s = shortAns(d.back);
      if (!s || s.length < 2) continue;
      if (s && s.toLowerCase() !== correct.toLowerCase() &&
        !distract.some(x => x.toLowerCase() === s.toLowerCase())) distract.push(s);
      if (distract.length >= 3) break;
    }
    if (distract.length < 3) continue;
    const options = shuffled([correct, ...distract]);
    out.push({
      strand,
      stem: String(c.front).slice(0, 300),
      options, answer: options.indexOf(correct),
      explain: String(c.back).slice(0, 300),
    });
  }
  return out;
}
// Assemble a full-length mock from the flashcard + passage banks.
// Static `questions` stay as a fallback; every attempt gets a fresh set,
// which also makes retakes meaningful.
function assembleMock(mock) {
  if (!mock.plan) return mock;
  const qs = [];
  for (const p of mock.plan) {
    if (p.bank === 'reading') {
      const rj = nativeJson('reading.json');
      for (const ps of shuffled([...(rj?.passages || [])]).slice(0, p.n)) {
        for (const q of (ps.questions || [])) {
          if (!q || !Array.isArray(q.options) || q.options.length !== 4) continue;
          qs.push({
            strand: 'reading', stem: q.stem, options: q.options,
            answer: q.answer, explain: q.explain,
            passage: { title: ps.title, text: ps.text },
          });
        }
      }
      continue;
    }
    const bj = nativeJson(p.bank + '.json');
    qs.push(...buildBankMcqs(bj?.cards, p.n, p.bank));
  }
  return { ...mock, questions: shuffled(qs) };
}
function planTotal(m) {
  if (!m.plan) return (m.questions || []).length;
  return m.plan.reduce((a, p) => a + (p.bank === 'reading' ? p.n * 4 : p.n), 0);
}
// Native flashcard banks as studiable decks (data/native/*.json).
// These are curated built-in content — no Drive IDs involved.
const BANK_DECKS = [
  ['bank-verbal', 'verbal.json', 'Verbal reasoning builder', 'Analogies, synonyms, codes and deductions.'],
  ['bank-quant', 'quant.json', 'Quantitative reasoning builder', 'Series, matrices, arithmetic and logic.'],
  ['bank-maths', 'maths.json', 'Year-8 maths facts', 'Fractions, percent, algebra, angles, BODMAS.'],
  ['bank-vocab', 'vocab.json', 'Vocabulary tiers', 'High-value words in context.'],
  ['bank-grammar', 'grammar.json', 'Grammar + spelling fixes', 'The errors that cost marks.'],
];
function bankDecks() {
  return BANK_DECKS.map(([id, file, title, description]) => {
    const bj = nativeJson(file);
    const cards = bj?.cards || [];
    return { id, source: 'bank', title, description, count: cards.length };
  });
}
function bankDeckCards(id) {
  const found = BANK_DECKS.find(([bid]) => bid === id);
  if (!found) return null;
  const bj = nativeJson(found[1]);
  const cards = (bj?.cards || []).slice(0, 200).map(c => ({
    front: String(c.front || '').slice(0, 500),
    back: String(c.back || '').slice(0, 2000),
    resourceId: null,
  })).filter(c => c.front && c.back);
  if (!cards.length) return null;
  return { id, source: 'bank', title: found[2], description: found[3], count: cards.length, cards };
}
function apiMocks(_req, res) {
  const j = nativeJson('mocks.json');
  if (!j) return sendJson(res, 500, { ok: false, error: 'unavailable' });
  return sendJson(res, 200, { ok: true, mocks: j.mocks.map(m => ({ id: m.id, title: m.title, minutes: m.minutes, strands: m.strands, count: planTotal(m) })) });
}
function apiMockById(_req, res, id) {
  const j = nativeJson('mocks.json');
  const m = j?.mocks.find(x => x.id === String(id).slice(0, 40));
  if (!m) return sendJson(res, 404, { ok: false, error: 'Not found.' });
  return sendJson(res, 200, { ok: true, mock: assembleMock(m) });
}
function apiWriting(_req, res) {
  const j = nativeJson('writing.json');
  if (!j) return sendJson(res, 500, { ok: false, error: 'unavailable' });
  return sendJson(res, 200, { ok: true, prompts: j.prompts });
}
function apiReading(_req, res) {
  const j = nativeJson('reading.json');
  if (!j) return sendJson(res, 500, { ok: false, error: 'unavailable' });
  return sendJson(res, 200, { ok: true, passages: j.passages });
}
function apiGuides(_req, res) {
  const j = nativeJson('guides.json');
  if (!j) return sendJson(res, 500, { ok: false, error: 'unavailable' });
  return sendJson(res, 200, { ok: true, guides: j });
}
function apiNativeStats(_req, res) {
  const counts = {};
  for (const [name, kind] of [['vocab.json', 'cards'], ['verbal.json', 'cards'], ['quant.json', 'cards'], ['maths.json', 'cards'], ['grammar.json', 'cards'], ['writing.json', 'prompts'], ['reading.json', 'passages'], ['mocks.json', 'mocks']]) {
    const j = nativeJson(name);
    counts[name.replace('.json', '')] = j ? (j[kind] || []).length : 0;
  }
  return sendJson(res, 200, { ok: true, counts });
}

// ---- free AI tutor (Pollinations anonymous tier: no key, no signup) ----
// Server-side proxy so the browser never talks to a third party directly
// (CSP stays `connect-src 'self'`) and one shared upstream quota is guarded:
// per-IP cooldown + 16s shared throttle + persistent identical-prompt cache.
// Privacy: prompt CONTENT is never logged — only mode + lengths in aggregate.
import { aiText, aiCacheGet, aiCacheSet, aiCacheKey, extractJson } from './server/ai.mjs';
const AI_SYSTEM = {
  tutor: 'You are a friendly SEHS selective-entry tutor for Victorian Year 8 students (ACER exam: maths, quantitative reasoning, reading, verbal reasoning, writing). Explain simply in short steps. Never write a student\'s essay for them — coach instead. Under 150 words.',
  writing: 'You are an SEHS writing coach. The student wrote a timed response (persuasive or creative). Give: 1 strength, 2 fixes (ideas/structure, sentences/vocab, spelling/punctuation), and one example rewrite of a weak sentence if shown. Under 150 words. Do not rewrite the whole piece.',
  explain: 'You are an SEHS tutor. Explain why the correct MCQ answer is right and what trap the wrong options set, in 2-4 short sentences at Year-8 level.',
};
const AI_MAXLEN = { tutor: 800, writing: 3200, explain: 800 };

function aiBusy(res, retryAfter = 16) {
  return sendJson(res, 429, { ok: false, error: 'Shared AI is busy — try again in a few seconds.', retryAfter });
}

async function apiAiChat(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const mode = String(body.mode || '');
  if (!AI_SYSTEM[mode]) return sendJson(res, 400, { ok: false, error: 'Unknown AI mode.' });
  const input = String(body.input || '').trim().slice(0, AI_MAXLEN[mode]);
  if (input.length < 2) return sendJson(res, 400, { ok: false, error: 'Write a little more first.' });
  const key = aiCacheKey('chat:' + mode, input);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    logEvent('ai', { data: { mode, cached: true } });
    return sendJson(res, 200, { ok: true, text: hit, cached: true });
  }
  try {
    const r = await aiText(
      [{ role: 'system', content: AI_SYSTEM[mode] }, { role: 'user', content: input }],
      { maxTokens: 400, temperature: 0.7, maxChars: 1500 });
    await aiCacheSet(db, key, 'chat:' + mode, r.text);
    logEvent('ai', { data: { mode, inLen: input.length, via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', mode);
    return sendJson(res, 200, { ok: true, text: r.text });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI is unavailable right now — the offline tools below still work.' });
  }
}

// ---- AI grading: writing vs the 8-criteria rubric (JSON, heuristic-backed) ----
const GRADE_CRITERIA = ['ideas', 'structure', 'devices', 'vocabulary', 'sentences', 'spelling'];
function heuristicGrade(kind, essay) {
  const words = (essay.match(/\S+/g) || []).length;
  const sentences = essay.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 1);
  const paras = essay.split(/\n\s*\n/).filter(p => p.trim().length > 10);
  const avgLen = sentences.length ? words / sentences.length : 0;
  const uniqOpeners = new Set(sentences.map(s => (s.match(/^[A-Za-z']+/) || [''])[0].toLowerCase())).size;
  const scores = {
    ideas: words >= 250 ? 4 : words >= 150 ? 3 : words >= 60 ? 2 : 1,
    structure: paras.length >= 4 ? 4 : paras.length >= 2 ? 3 : 2,
    devices: /(because|for example|however|first|finally|imagine|picture)/i.test(essay) ? 3 : 2,
    vocabulary: uniqOpeners >= 8 ? 4 : uniqOpeners >= 5 ? 3 : 2,
    sentences: avgLen >= 8 && avgLen <= 25 && sentences.length >= 5 ? 4 : sentences.length >= 3 ? 3 : 2,
    spelling: 3,
  };
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 6);
  return { scores, overall, words, sentences: sentences.length, paras: paras.length, source: 'auto-checks' };
}

async function apiAiGrade(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const kind = body.kind === 'creative' ? 'creative' : 'persuasive';
  const essay = String(body.essay || '').trim().slice(0, 3200);
  if ((essay.match(/\S+/g) || []).length < 30) return sendJson(res, 400, { ok: false, error: 'Write at least ~30 words first.' });
  const auto = heuristicGrade(kind, essay);
  const key = aiCacheKey('grade:' + kind, essay);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    try {
      const j = JSON.parse(hit);
      logEvent('ai', { data: { mode: 'grade', cached: true } });
      return sendJson(res, 200, { ok: true, auto, ai: j, cached: true });
    } catch { /* stale entry — regenerate */ }
  }
  try {
    const r = await aiText([
      { role: 'system', content: `You are an SEHS writing marker. Grade this Year-8 ${kind} response (target 250-350 words, ~20 min). Reply with ONLY valid JSON: {"scores":{"ideas":1-5,"structure":1-5,"devices":1-5,"vocabulary":1-5,"sentences":1-5,"spelling":1-5},"overall":1-5,"strength":"one line","fix1":"one line","fix2":"one line"}. No other text.` },
      { role: 'user', content: essay },
    ], { maxTokens: 500, temperature: 0.4, maxChars: 1200, json: true });
    const j = extractJson(r.text);
    if (!j || typeof j !== 'object' || !j.scores) throw { status: 'down' };
    for (const c of GRADE_CRITERIA) j.scores[c] = Math.min(5, Math.max(1, Number(j.scores[c]) || 3));
    j.overall = Math.min(5, Math.max(1, Number(j.overall) || 3));
    await aiCacheSet(db, key, 'grade:' + kind, JSON.stringify(j));
    logEvent('ai', { data: { mode: 'grade', inLen: essay.length, via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'grade');
    return sendJson(res, 200, { ok: true, auto, ai: j });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    // AI down: heuristic grade still answers.
    logEvent('ai', { data: { mode: 'grade', fallback: true } });
    return sendJson(res, 200, { ok: true, auto, ai: null, note: 'AI marker was busy — showing automatic checks only.' });
  }
}

// ---- AI question generation: validated MCQ sets per strand ----
const GEN_STRANDS = ['verbal', 'quant', 'maths', 'reading', 'vocab', 'grammar'];
const GEN_BRIEF = {
  verbal: 'verbal reasoning (analogy, synonym, odd-one-out, code, or deduction)',
  quant: 'quantitative reasoning (number series, matrix, arithmetic, or Venn logic)',
  maths: 'Year-8 maths (fraction, percent, algebra, angle, or BODMAS)',
  reading: 'reading comprehension inference from a 2-sentence micro-passage you invent',
  vocab: 'vocabulary-in-context (word meaning via a sentence)',
  grammar: 'grammar (spelling, punctuation, or sentence fix)',
};
function cleanGenSet(arr) {
  const out = [];
  for (const q of (Array.isArray(arr) ? arr : [])) {
    if (!q || typeof q.stem !== 'string') continue;
    const options = Array.isArray(q.options) ? q.options.map(String).filter(s => s.trim()).slice(0, 4) : [];
    const answer = Number(q.answer);
    const explain = String(q.explain || '').slice(0, 300);
    if (!q.stem.trim() || options.length !== 4 || !(answer >= 0 && answer < 4) || !explain.trim()) continue;
    out.push({ stem: q.stem.trim().slice(0, 300), options, answer, explain });
    if (out.length >= 10) break;
  }
  return out;
}

async function apiAiQuestions(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const strand = String(body.strand || '');
  if (!GEN_STRANDS.includes(strand)) return sendJson(res, 400, { ok: false, error: 'Unknown strand.' });
  const topic = String(body.topic || '').trim().slice(0, 120) || 'mixed practice';
  const n = Math.min(8, Math.max(3, Number(body.n) || 5));
  const key = aiCacheKey('gen:' + strand, topic + '|' + n);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    try {
      const arr = cleanGenSet(JSON.parse(hit));
      if (arr.length >= 3) {
        logEvent('ai', { data: { mode: 'gen', cached: true } });
        return sendJson(res, 200, { ok: true, strand, questions: arr, cached: true });
      }
    } catch { /* regenerate */ }
  }
  try {
    const r = await aiText([
      { role: 'system', content: `Write ${n} SEHS ${GEN_BRIEF[strand]} multiple-choice questions on "${topic}" for Year-8 level. Reply with ONLY a valid JSON array, no other text. Each item: {"stem":"...","options":["a","b","c","d"],"answer":0-3,"explain":"one line why"}. Vary correct positions.` },
      { role: 'user', content: `Topic: ${topic}. ${n} questions.` },
    ], { maxTokens: 900, temperature: 0.8, maxChars: 4000, json: true });
    const arr = cleanGenSet(extractJson(r.text));
    if (arr.length < 3) throw { status: 'down' };
    await aiCacheSet(db, key, 'gen:' + strand, JSON.stringify(arr));
    logEvent('ai', { data: { mode: 'gen', strand, via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'gen-' + strand);
    return sendJson(res, 200, { ok: true, strand, questions: arr });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI question writer is unavailable — try the built-in banks and drills instead.' });
  }
}

// ---- AI flashcards: topic → cards saved by the browser into personal decks ----
async function apiAiFlashcards(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const topic = String(body.topic || '').trim().slice(0, 120);
  if (topic.length < 3) return sendJson(res, 400, { ok: false, error: 'Name a topic (3+ characters).' });
  const key = aiCacheKey('cards', topic);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    try {
      const arr = JSON.parse(hit);
      if (Array.isArray(arr) && arr.length >= 4) {
        logEvent('ai', { data: { mode: 'cards', cached: true } });
        return sendJson(res, 200, { ok: true, topic, cards: arr, cached: true });
      }
    } catch { /* regenerate */ }
  }
  try {
    const r = await aiText([
      { role: 'system', content: `Make 10 flashcards for SEHS Year-8 study of "${topic}". Reply with ONLY a valid JSON array, no other text. Each item: {"front":"short prompt","back":"answer + one-line note"}. Keep fronts under 120 characters.` },
      { role: 'user', content: `Topic: ${topic}` },
    ], { maxTokens: 900, temperature: 0.7, maxChars: 4000, json: true });
    let arr = extractJson(r.text);
    if (!Array.isArray(arr)) arr = [];
    arr = arr.filter(c => c && typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim())
      .slice(0, 12).map(c => ({ front: c.front.trim().slice(0, 200), back: c.back.trim().slice(0, 500) }));
    if (arr.length < 4) throw { status: 'down' };
    await aiCacheSet(db, key, 'cards', JSON.stringify(arr));
    logEvent('ai', { data: { mode: 'cards', via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'cards');
    return sendJson(res, 200, { ok: true, topic, cards: arr });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI card writer is unavailable — try the built-in decks instead.' });
  }
}

// ---- AI reading passage: genre-rotated passage + questions ----
const PASSAGE_GENRES = ['fiction', 'nonfiction', 'opinion', 'poetry', 'informational'];
function cleanPassageQs(arr) {
  const out = [];
  for (const q of (Array.isArray(arr) ? arr : [])) {
    if (!q || typeof q.stem !== 'string') continue;
    const options = Array.isArray(q.options) ? q.options.map(String).filter(s => s.trim()).slice(0, 4) : [];
    const answer = Number(q.answer);
    const explain = String(q.explain || '').slice(0, 300);
    if (!q.stem.trim() || options.length !== 4 || !(answer >= 0 && answer < 4) || !explain.trim()) continue;
    out.push({ stem: q.stem.trim().slice(0, 300), options, answer, explain });
    if (out.length >= 5) break;
  }
  return out;
}
async function apiAiPassage(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const genre = PASSAGE_GENRES.includes(body.genre) ? body.genre : PASSAGE_GENRES[Math.floor(Math.random() * PASSAGE_GENRES.length)];
  const seed = String(body.seed || '').trim().slice(0, 60) || 'everyday life';
  const key = aiCacheKey('passage', genre + '|' + seed);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    try {
      const j = JSON.parse(hit);
      if (j && j.text && Array.isArray(j.questions) && j.questions.length >= 3) {
        logEvent('ai', { data: { mode: 'passage', cached: true } });
        return sendJson(res, 200, { ok: true, genre, passage: j, cached: true });
      }
    } catch { /* regenerate */ }
  }
  try {
    const r = await aiText([
      { role: 'system', content: `Write a Year-8 reading-comprehension exercise: a ${genre} passage (300-450 words, about "${seed}") then 4 multiple-choice questions (main idea, inference, vocab-in-context, tone/purpose) with exact-phrase evidence. Reply with ONLY valid JSON, no other text: {"title":"...","text":"...","questions":[{"stem":"...","options":["a","b","c","d"],"answer":0-3,"explain":"..."}]}. Vary correct positions.` },
      { role: 'user', content: `Genre: ${genre}. Theme: ${seed}.` },
    ], { maxTokens: 1400, temperature: 0.8, maxChars: 6000, json: true });
    const j = extractJson(r.text);
    const questions = cleanPassageQs(j && j.questions);
    const text = String((j && (j.text || j.passage)) || '').trim().slice(0, 4000);
    if (!text || questions.length < 3) throw { status: 'down' };
    const out = { title: String((j && j.title) || 'Practice passage').slice(0, 120), text, questions };
    await aiCacheSet(db, key, 'passage', JSON.stringify(out));
    logEvent('ai', { data: { mode: 'passage', genre, via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'passage');
    return sendJson(res, 200, { ok: true, genre, passage: out });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI passage writer is unavailable — try the built-in passages instead.' });
  }
}

// ---- AI writing prompt: unlimited persuasive/creative prompts ----
async function apiAiPrompt(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const kind = body.kind === 'creative' ? 'creative' : 'persuasive';
  const theme = String(body.theme || '').trim().slice(0, 80) || 'school life';
  const key = aiCacheKey('prompt:' + kind, theme);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    try {
      const j = JSON.parse(hit);
      if (j && j.prompt) {
        logEvent('ai', { data: { mode: 'prompt', cached: true } });
        return sendJson(res, 200, { ok: true, kind, prompt: j, cached: true });
      }
    } catch { /* regenerate */ }
  }
  try {
    const r = await aiText([
      { role: 'system', content: `Create one SEHS exam-style ${kind} writing prompt for a Year-8 student (theme: "${theme}"). Reply with ONLY valid JSON, no other text: {"prompt":"the prompt in one line","stimulus":"one-sentence stimulus","plan":["step 1","step 2","step 3","step 4"]}.` },
      { role: 'user', content: `Kind: ${kind}. Theme: ${theme}.` },
    ], { maxTokens: 300, temperature: 0.9, maxChars: 1000, json: true });
    const j = extractJson(r.text);
    if (!j || !j.prompt) throw { status: 'down' };
    const out = {
      prompt: String(j.prompt).slice(0, 200),
      stimulus: String(j.stimulus || '').slice(0, 300),
      plan: Array.isArray(j.plan) ? j.plan.map(String).filter(Boolean).slice(0, 5) : [],
    };
    await aiCacheSet(db, key, 'prompt:' + kind, JSON.stringify(out));
    logEvent('ai', { data: { mode: 'prompt', via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'prompt');
    return sendJson(res, 200, { ok: true, kind, prompt: out });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI prompt writer is unavailable — try the built-in prompts instead.' });
  }
}

// ---- AI study plan: week-by-week schedule from local stats (counts only) ----
async function apiAiPlan(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const weeks = Math.min(16, Math.max(2, Number(body.weeks) || 8));
  const weak = (Array.isArray(body.weak) ? body.weak : []).map(String).filter(s => /^[a-z-]{2,30}$/.test(s)).slice(0, 6);
  const strong = (Array.isArray(body.strong) ? body.strong : []).map(String).filter(s => /^[a-z-]{2,30}$/.test(s)).slice(0, 6);
  const mins = Math.min(180, Math.max(15, Number(body.minsPerDay) || 45));
  const key = aiCacheKey('plan', weeks + '|' + weak.join(',') + '|' + strong.join(',') + '|' + mins);
  const hit = await aiCacheGet(db, key);
  if (hit) {
    logEvent('ai', { data: { mode: 'plan', cached: true } });
    return sendJson(res, 200, { ok: true, plan: hit, cached: true });
  }
  try {
    const r = await aiText([
      { role: 'system', content: `You are an SEHS study planner. The student has ${weeks} weeks until the ACER exam, ${mins} min/day. Weak strands: ${weak.join(', ') || 'unknown'}. Strong strands: ${strong.join(', ') || 'unknown'}. Write a practical week-by-week plan naming concrete activities (timed blocks 60/55/40, VR/QR builders, vocab tiers, writing 2x/week, full mocks in final weeks, taper week). Plain text, short lines, under 1200 characters. No preamble.` },
      { role: 'user', content: `Plan for ${weeks} weeks, ${mins} min/day.` },
    ], { maxTokens: 700, temperature: 0.6, maxChars: 2500 });
    await aiCacheSet(db, key, 'plan', r.text);
    logEvent('ai', { data: { mode: 'plan', via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'plan');
    return sendJson(res, 200, { ok: true, plan: r.text });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI planner is unavailable — follow the 12-week plan in the exam guide instead.' });
  }
}

// ---- AI variants: fresh questions targeting the student's own misses ----
async function apiAiVariants(req, res, ip) {
  if (process.env.AI_ENABLED === '0') return sendJson(res, 503, { ok: false, error: 'AI is disabled on this server.' });
  const rl = rlAi.allow('ai:' + ip);
  if (!rl.ok) return sendJson(res, 429, { ok: false, error: 'Slow down — one AI request per ~20 seconds.', retryAfter: rl.retryAfter });
  let body;
  try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
  const misses = (Array.isArray(body.misses) ? body.misses : []).slice(0, 5).map(m => ({
    stem: String((m && m.stem) || '').slice(0, 200),
    strand: String((m && m.strand) || '').slice(0, 20),
  })).filter(m => m.stem.length > 3);
  if (!misses.length) return sendJson(res, 400, { ok: false, error: 'Send 1-5 missed questions to vary.' });
  const key = aiCacheKey('variants', JSON.stringify(misses));
  const hit = await aiCacheGet(db, key);
  if (hit) {
    try {
      const arr = cleanGenSet(JSON.parse(hit));
      if (arr.length >= 1) {
        logEvent('ai', { data: { mode: 'variants', cached: true } });
        return sendJson(res, 200, { ok: true, questions: arr, cached: true });
      }
    } catch { /* regenerate */ }
  }
  const brief = misses.map((m, i) => `${i + 1}. [${m.strand}] ${m.stem}`).join('\n');
  try {
    const r = await aiText([
      { role: 'system', content: `The student missed these SEHS questions. Write ONE fresh variant per miss testing the SAME skill with different numbers/words (never repeat stems). Reply with ONLY a valid JSON array, no other text. Each item: {"stem":"...","options":["a","b","c","d"],"answer":0-3,"explain":"one line"}. Vary correct positions.` },
      { role: 'user', content: brief },
    ], { maxTokens: 800, temperature: 0.8, maxChars: 3500, json: true });
    const arr = cleanGenSet(extractJson(r.text));
    if (!arr.length) throw { status: 'down' };
    await aiCacheSet(db, key, 'variants', JSON.stringify(arr));
    logEvent('ai', { data: { mode: 'variants', via: r.via } });
    bumpAggregate(nowIso().slice(0, 10), 'ai', 'variants');
    return sendJson(res, 200, { ok: true, questions: arr });
  } catch (e) {
    if (e && e.status === 'busy') return aiBusy(res);
    return sendJson(res, 502, { ok: false, error: 'AI variant writer is unavailable — retry the built-in decks instead.' });
  }
}

// ---- router ----------------------------------------------------------------------
// Request handler shared by the long-lived server and serverless runtimes
// (Vercel `api/index.js`). Keep it stateless across invocations: module-level
// `db`/`indexes` are a warm-start cache only, rebuilt via ready() when empty.
export async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://x');
  const ip = clientIp(req);
  try {
    await ready();
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
        const total = (await db.prepare(`SELECT COUNT(*) AS n FROM resources WHERE visibility = 1 AND file_type != 'folder' AND category != 'folder'`).get()).n;
        return sendJson(res, 200, { ok: true, publicResources: total });
      }
      if (url.pathname === '/api/me') {
        const admin = await getAdmin(req);
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
      if (url.pathname === '/api/announcement' && req.method === 'GET') {
        const row = await db.prepare('SELECT body FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 1').get();
        return sendJson(res, 200, { ok: true, body: row?.body || null });
      }
      if (url.pathname === '/api/new' && req.method === 'GET') {
        const rows = await db.prepare(`SELECT * FROM resources WHERE visibility = 1 AND file_type != 'folder' AND category != 'folder' ORDER BY id DESC LIMIT 6`).all();
        const index = forRole(indexes);
        const docById = new Map(index.docs.map(d => [d.rec.id, d]));
        return sendJson(res, 200, {
          ok: true,
          results: rows.map(row => {
            const d = docById.get(row.public_id);
            return { ...publicView(row), displayTitle: d ? d.displayTitle : row.title };
          }),
        });
      }
      if (url.pathname === '/api/reports' && req.method === 'POST') {
        if (!rlReport.allow('rep:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many reports. Try again later.' });
        let body;
        try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
        const reasons = ['broken', 'wrong-details', 'other'];
        const reason = reasons.includes(body.reason) ? body.reason : 'other';
        const detail = String(body.detail || '').slice(0, 500);
        const rid = String(body.resourceId || '');
        let resourceId = null;
        if (/^[0-9a-f]{32}$/.test(rid)) {
          const row = await db.prepare('SELECT id FROM resources WHERE public_id = ?').get(rid);
          if (!row) return sendJson(res, 400, { ok: false, error: 'Unknown resource.' });
          resourceId = row.id;
        }
        await db.prepare('INSERT INTO reports(resource_id, reason, detail, ip_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(resourceId, reason, detail, ipHash(ip, await saltForIp()), 'open', nowIso());
        logEvent('report', { resourceId, data: { reason } });
        return sendJson(res, 201, { ok: true });
      }
      if (url.pathname === '/api/requests' && req.method === 'POST') {
        if (!rlReport.allow('req:' + ip).ok) return sendJson(res, 429, { ok: false, error: 'Too many requests. Try again later.' });
        let body;
        try { body = JSON.parse(await readBody(req, 10 * 1024)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
        const title = String(body.title || '').trim().slice(0, 200);
        if (title.length < 4) return sendJson(res, 400, { ok: false, error: 'Describe what you need (4+ characters).' });
        await db.prepare('INSERT INTO requests(title, detail, ip_hash, status, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(title, String(body.detail || '').slice(0, 1000), ipHash(ip, await saltForIp()), 'open', nowIso());
        logEvent('request', { data: {} });
        return sendJson(res, 201, { ok: true });
      }
      if (url.pathname === '/api/decks' && req.method === 'GET') {
        const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
        return sendJson(res, 200, {
          ok: true,
          decks: [...bankDecks(), ...autoDecks(forRole(indexes), rowMap), ...await adminDecks(db)]
            .map(d => ({ id: d.id, source: d.source, title: d.title, description: d.description, count: d.count })),
        });
      }
      if (url.pathname === '/api/mocks' && req.method === 'GET') return apiMocks(req, res);
      if (url.pathname === '/api/writing' && req.method === 'GET') return apiWriting(req, res);
      if (url.pathname === '/api/reading' && req.method === 'GET') return apiReading(req, res);
      if (url.pathname === '/api/guides' && req.method === 'GET') return apiGuides(req, res);
      if (url.pathname === '/api/native-stats' && req.method === 'GET') return apiNativeStats(req, res);
      if (url.pathname === '/api/ai/chat' && req.method === 'POST') return apiAiChat(req, res, ip);
      if (url.pathname === '/api/ai/grade' && req.method === 'POST') return apiAiGrade(req, res, ip);
      if (url.pathname === '/api/ai/questions' && req.method === 'POST') return apiAiQuestions(req, res, ip);
      if (url.pathname === '/api/ai/flashcards' && req.method === 'POST') return apiAiFlashcards(req, res, ip);
      if (url.pathname === '/api/ai/passage' && req.method === 'POST') return apiAiPassage(req, res, ip);
      if (url.pathname === '/api/ai/prompt' && req.method === 'POST') return apiAiPrompt(req, res, ip);
      if (url.pathname === '/api/ai/plan' && req.method === 'POST') return apiAiPlan(req, res, ip);
      if (url.pathname === '/api/ai/variants' && req.method === 'POST') return apiAiVariants(req, res, ip);
      const dm = url.pathname.match(/^\/api\/decks\/([A-Za-z0-9-]{1,40})$/);
      if (dm && req.method === 'GET') {
        if (dm[1].startsWith('bank-')) {
          const deck = bankDeckCards(dm[1]);
          if (!deck) return sendJson(res, 404, { ok: false, error: 'Not found.' });
          return sendJson(res, 200, { ok: true, deck });
        }
        const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
        const deck = await deckCards(db, forRole(indexes), rowMap, dm[1]);
        if (!deck) return sendJson(res, 404, { ok: false, error: 'Not found.' });
        if (deck.cards.length > 200) deck.cards = deck.cards.slice(0, 200);
        return sendJson(res, 200, { ok: true, deck });
      }
      if (url.pathname === '/api/unlock' && req.method === 'POST') return apiUnlock(req, res, ip);
      if (url.pathname === '/api/logout' && req.method === 'POST') return apiLogout(req, res);
      if (url.pathname === '/api/terms' && req.method === 'GET') return apiTerms(req, res);
      const mmm = url.pathname.match(/^\/api\/mocks\/([A-Za-z0-9-]{1,40})$/);
      if (mmm && req.method === 'GET') return apiMockById(req, res, mmm[1]);
      const m = url.pathname.match(/^\/api\/access\/([A-Za-z0-9_-]{1,64})$/);
      if (m && req.method === 'POST') return apiAccess(req, res, ip, m[1]);
      const pm = url.pathname.match(/^\/api\/preview\/([A-Za-z0-9_-]{1,64})$/);
      if (pm && req.method === 'POST') return apiPreview(req, res, ip, pm[1]);
      // ---- admin API (bearer-gated, uniform 404 otherwise) ----
      if (url.pathname.startsWith('/api/admin/')) {
        const admin = await getAdmin(req);
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
        if (url.pathname === '/api/admin/resources' && req.method === 'GET') {
          const u = new URL(req.url, 'http://x').searchParams;
          const q = (u.get('q') || '').slice(0, 120).toLowerCase();
          const page = Math.max(1, Number(u.get('page')) || 1);
          const per = 25;
          const like = `%${q}%`;
          const where = q ? `WHERE (lower(title) LIKE ? OR lower(provider) LIKE ? OR lower(category) LIKE ?)` : '';
          const args = q ? [like, like, like] : [];
          const total = db.prepare(`SELECT COUNT(*) n FROM resources ${where}`).get(...args).n;
          const pages = Math.max(1, Math.ceil(total / per));
          const rows = db.prepare(`SELECT * FROM resources ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, per, (Math.min(page, pages) - 1) * per);
          return sendJson(res, 200, {
            ok: true, total, page: Math.min(page, pages), pages,
            items: rows.map(r => ({ ...publicView(r), _id: r.id, accessLevel: r.access_level, visibility: !!r.visibility })),
          });
        }
        if (url.pathname === '/api/admin/events' && req.method === 'GET') {
          const u = new URL(req.url, 'http://x').searchParams;
          const type = (u.get('type') || '').slice(0, 30);
          const page = Math.max(1, Number(u.get('page')) || 1);
          const per = 50;
          const where = type ? `WHERE type = ?` : '';
          const args = type ? [type] : [];
          const total = db.prepare(`SELECT COUNT(*) n FROM events ${where}`).get(...args).n;
          const pages = Math.max(1, Math.ceil(total / per));
          const rows = db.prepare(`SELECT e.id, e.created_at, e.type, e.resource_id, e.data, r.title AS rtitle
            FROM events e LEFT JOIN resources r ON r.id = e.resource_id
            ${where} ORDER BY e.id DESC LIMIT ? OFFSET ?`).all(...args, per, (Math.min(page, pages) - 1) * per);
          return sendJson(res, 200, {
            ok: true, total, page: Math.min(page, pages), pages,
            items: rows.map(e => ({ id: e.id, at: e.created_at, type: e.type, resource: e.rtitle ? String(e.rtitle).slice(0, 60) : null, data: (() => { try { return JSON.parse(e.data || '{}'); } catch { return {}; } })() })),
          });
        }
        if (url.pathname === '/api/admin/sessions' && req.method === 'GET') {
          const rows = db.prepare(`SELECT rowid, role, created_at, expires_at, last_seen_at, ip_hash, ua_family FROM sessions WHERE expires_at > ? ORDER BY last_seen_at DESC LIMIT 100`).all(nowIso());
          return sendJson(res, 200, { ok: true, sessions: rows.map(s => ({ rowid: s.rowid, role: s.role, created: s.created_at, expires: s.expires_at, seen: s.last_seen_at, ip: String(s.ip_hash).slice(0, 12) + '…', ua: s.ua_family })) });
        }
        if (url.pathname === '/api/admin/terms' && req.method === 'GET') {
          const v = Number(getMeta(db, 'terms_version') || 1);
          const row = db.prepare('SELECT version, summary_md, body_md FROM terms WHERE version = ?').get(v);
          return sendJson(res, 200, { ok: true, version: v, summary: row?.summary_md || '', body: row?.body_md || '' });
        }
        if (url.pathname === '/api/admin/announcements' && req.method === 'GET') {
          const rows = db.prepare('SELECT id, body, active, created_at FROM announcements ORDER BY id DESC LIMIT 50').all();
          return sendJson(res, 200, { ok: true, items: rows });
        }
        if (url.pathname === '/api/admin/announcements' && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const text = String(body.body || '').trim().slice(0, 300);
          if (text.length < 2) return sendJson(res, 400, { ok: false, error: 'Text needs 2+ characters.' });
          db.prepare('INSERT INTO announcements(body, active, created_at) VALUES (?, 1, ?)').run(text, nowIso());
          logEvent('admin', { data: { action: 'announce' } });
          return sendJson(res, 201, { ok: true });
        }
        const anm = url.pathname.match(/^\/api\/admin\/announcements\/(\d+)$/);
        if (anm) {
          if (req.method === 'PATCH') {
            let body;
            try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
            db.prepare('UPDATE announcements SET active = ? WHERE id = ?').run(body.active ? 1 : 0, Number(anm[1]));
            return sendJson(res, 200, { ok: true });
          }
          if (req.method === 'DELETE') {
            db.prepare('DELETE FROM announcements WHERE id = ?').run(Number(anm[1]));
            return sendJson(res, 200, { ok: true });
          }
          return adminMissing(res, sendJson);
        }
        if (url.pathname === '/api/admin/backup' && req.method === 'GET') {
          try {
            db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); // consistent snapshot before streaming
            const st = fs.statSync(dbPath());
            secureHeaders(res);
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': st.size,
              'Content-Disposition': `attachment; filename="sehs-backup-${new Date().toISOString().slice(0, 10)}.db"`,
            });
            fs.createReadStream(dbPath()).pipe(res);
            logEvent('admin', { data: { action: 'backup' } });
          } catch { sendJson(res, 500, { ok: false, error: 'unavailable' }); }
          return;
        }
        if (url.pathname === '/api/admin/health' && req.method === 'GET') {          let dbBytes = 0;
          try { dbBytes = fs.statSync(dbPath()).size; } catch { /* noop */ }
          const t0 = Date.now();
          buildIndexes(db);
          return sendJson(res, 200, {
            ok: true,
            dbBytes,
            uptimeSec: Math.round(process.uptime()),
            node: process.version,
            indexRebuildMs: Date.now() - t0,
            retentionDays: Number(getMeta(db, 'retention_days') || 30),
            lastPurge: getMeta(db, 'last_purge') || 'never',
            termsVersion: Number(getMeta(db, 'terms_version') || 1),
          });
        }
        if (url.pathname === '/api/admin/audit.csv' && req.method === 'GET') {
          const rows = db.prepare('SELECT id, created_at, type, resource_id, data FROM events ORDER BY id DESC LIMIT 5000').all();
          const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const csv = 'id,created_at,type,resource_id,data\n' + rows.map(e => [e.id, e.created_at, e.type, e.resource_id || '', e.data || ''].map(q).join(',')).join('\n');
          secureHeaders(res);
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="sehs-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
          });
          res.end(csv);
          return;
        }
        const tm = url.pathname.match(/^\/api\/admin\/triage\/(report|request)\/(\d+)$/);
        if (tm && req.method === 'POST') {
          let body;
          try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid request.' }); }
          const status = body.status === 'accepted' ? 'accepted' : 'rejected';
          const table = tm[1] === 'report' ? 'reports' : 'requests';
          const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(tm[2]));
          if (!row) return adminMissing(res, sendJson);
          db.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).run(status, row.id);
          if (table === 'reports' && status === 'accepted' && row.resource_id) {
            db.prepare(`UPDATE resources SET status = 'needs_verification', updated_at = ? WHERE id = ?`).run(nowIso(), row.resource_id);
            rebuildIndexes();
          }
          logEvent('admin', { data: { action: 'triage', kind: table, status } });
          return sendJson(res, 200, { ok: true });
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
    const eg = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{16,64})$/);
    if (eg && req.method === 'GET') return embedGrant(req, res, eg[1]);

    // React SPA (client/dist) owns these routes once built; otherwise the
    // legacy server-rendered pages below handle them. /admin* stays legacy.
    if (req.method === 'GET' && distOn()) {
      const p = url.pathname;
      if (p === '/' || SPA_RE.test(p)) {
        const f = p === '/' ? DIST_INDEX : distFile(p);
        return sendFile(res, f || DIST_INDEX);
      }
      if (p.startsWith('/assets/')) {
        const f = distFile(p);
        if (f) return sendFile(res, f);
      }
      // Unknown app paths render the SPA's designed 404 page with a real 404
      // status (no soft-404s). Never swallow API, admin, grants, feeds, or files.
      const base = p.slice(p.lastIndexOf('/') + 1);
      const reserved = p.startsWith('/api/') || p.startsWith('/admin') || p.startsWith('/open/') ||
        p.startsWith('/embed/') || p === '/feed.xml' || p === '/robots.txt' || p === '/sitemap.xml';
      if (!reserved && !base.includes('.')) {
        secureHeaders(res);
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(DIST_INDEX).pipe(res);
        return;
      }
    }

    if (req.method !== 'GET') { secureHeaders(res); res.writeHead(405); res.end('method not allowed'); return; }
    // Pages are public; the header shows an Admin link only with a valid bearer session.
    // Page shells carry no sensitive data — all admin data loads via bearer-authed API.
    const admin = await getAdmin(req);
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
    if (url.pathname === '/feed.xml' && req.method === 'GET') {
      const rows = await db.prepare(`SELECT * FROM resources WHERE visibility = 1 AND file_type != 'folder' AND category != 'folder' ORDER BY id DESC LIMIT 30`).all();
      const items = rows.map(r => {
        const t = String(r.title).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        return `<item><title>${t}</title><link>https://sehs.directory/r/${r.public_id}</link><guid>https://sehs.directory/r/${r.public_id}</guid><pubDate>${new Date(r.created_at).toUTCString()}</pubDate></item>`;
      }).join('');
      secureHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>SEHS Study Directory — new arrivals</title><link>https://sehs.directory/</link><description>Recently added study resources.</description>${items}</channel></rss>`);
      return;
    }
    if (url.pathname === '/request') return html(200, requestPage(ctx));
    const lm = url.pathname.match(/^\/list\/([A-Za-z0-9-_]{1,1400})$/);
    if (lm) {
      let ids = [];
      try {
        const raw = Buffer.from(lm[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) ids = arr.filter(s => /^[0-9a-f]{32}$/.test(s)).slice(0, 100);
      } catch { /* invalid share code → empty list */ }
      return html(200, sharedListPage(ctx, ids));
    }
    if (url.pathname === '/study') return html(200, studyHubPage(ctx));
    const sm = url.pathname.match(/^\/study\/([A-Za-z0-9-]{1,40})$/);
    if (sm) return html(200, studyDeckPage(ctx, sm[1]));
    if (url.pathname === '/exam-guide') return html(200, examGuidePage(ctx));
    if (url.pathname === '/mocks') return html(200, mocksPage(ctx));
    const mm = url.pathname.match(/^\/mocks\/([A-Za-z0-9-]{1,40})$/);
    if (mm) return html(200, mockRunnerPage(ctx, mm[1]));
    if (url.pathname === '/writing') return html(200, writingPage(ctx));
    if (url.pathname === '/reading') return html(200, readingPage(ctx));
    if (url.pathname === '/drills') return html(200, drillsPage(ctx));
    if (url.pathname === '/unlock') return html(200, unlockPage(ctx));
    // Admin pages serve inert shells to everyone; ALL data loads through
    // bearer-authed /api/admin/* calls (navigation requests can't carry headers).
    if (url.pathname === '/admin') return html(200, adminDashboard({ db, indexes, session: null }));
    if (url.pathname === '/admin/resources') return html(200, adminResources({ db, indexes, session: null }, url.searchParams));
    if (url.pathname === '/admin/audit') return html(200, adminAudit({ db, indexes, session: null }, url.searchParams));
    if (url.pathname === '/admin/triage') return html(200, adminTriage({ db, indexes, session: null }));
    if (url.pathname === '/admin/settings') return html(200, adminSettings({ db, indexes, session: null }));
    return serveStatic(url.pathname, res);
  } catch (e) {
    try { sendJson(res, 500, { ok: false, error: 'unavailable' }); } catch { /* closed */ }
  }
}

const server = http.createServer(handleRequest);

// Only listen when run directly (`node server.mjs`). Serverless entries
// (api/index.js) import handleRequest without starting a listener.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`sehs http://localhost:${PORT}`));
}
