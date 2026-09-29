// SEHS platform server (zero deps). Serves static UI + JSON API + pages.
// P0: static + health/stats. Pages, auth, and access flow land in P1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './server/db.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir);
const PORT = Number(process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const db = openDb();

function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // No HSTS on plain http (dev); enabled when behind TLS via APP_SECURE=1
  if (process.env.APP_SECURE === '1') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP: same-origin only + Google Fonts (already used by UI). No inline scripts allowed going forward.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; " +
    "frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
}

function sendJson(res, code, obj, extraHeaders = {}) {
  secureHeaders(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // Never serve server internals, state, or raw datasets
  const blocked = ['/server/', '/state/', '/data/links.json', '/data/app.db', '/source-data/drive-files.json', '/.env'];
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

// Public collection counts only — no urls, no ids, no metadata rows.
function apiStats(_req, res) {
  try {
    const total = db.prepare("SELECT COUNT(*) AS n FROM resources WHERE visibility = 1 AND access_level = 'public'").get().n;
    sendJson(res, 200, { ok: true, publicResources: total });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: 'unavailable' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
    if (url.pathname === '/api/stats') return apiStats(req, res);
    if (req.method !== 'GET') { secureHeaders(res); res.writeHead(405); res.end('method not allowed'); return; }
    return serveStatic(req, res);
  } catch (e) {
    // Never leak internals
    try { sendJson(res, 500, { ok: false, error: 'unavailable' }); } catch { /* closed */ }
  }
});

server.listen(PORT, () => console.log(`sehs http://localhost:${PORT}`));
