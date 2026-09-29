// One-time migration: links.json + drive sizes → SQLite (new 128-bit public IDs).
// Usage: node scripts/migrate.mjs [--reset]
// Passwords: from SEHS_VIEWER_PASSWORD / SEHS_ADMIN_PASSWORD env, else generated once.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, setMeta, getMeta } from '../server/db.mjs';
import { hashPassword, generatePasswordwords } from '../server/crypto.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const RESET = process.argv.includes('--reset');

const TERMS_V1_SUMMARY = `Personal study use only. Do not redistribute or re-upload these resources. Respect copyright and provider terms. Resources are provided as-is with no availability guarantee. Access is logged for security; abuse may lose access.`;
const TERMS_V1_BODY = `# Terms & Conditions — SEHS Study Directory (v1)

**Last updated:** 2026-09-29. By opening resources on this site you agree to the following.

## 1. Personal study use only
Resources are provided for your own study and exam preparation. You may download copies for personal use.

## 2. No redistribution
Do not re-upload, re-share, republish, sell, or distribute these resources or their links, in whole or in part, on any platform.

## 3. Copyright
Materials remain the property of their respective owners and providers. If you are a rights holder and believe material should not be listed, contact the administrator.

## 4. No warranty
Resources are provided as-is. Availability, accuracy, and fitness for any purpose are not guaranteed. Links may change or break.

## 5. Fair use & security
Access is logged (resource, time, session outcome) to keep the collection safe. Automated scraping, bulk downloading, credential sharing, or attempts to bypass access controls may result in loss of access.

## 6. Privacy
We collect the minimum needed to operate access control: session data, access events, and (if you accept analytics) anonymised usage statistics. Raw analytics are auto-purged after 30 days. There is no third-party tracking or advertising.

## 7. Changes
These terms may be updated; the current version is shown before you accept. Continued use after an update constitutes acceptance of the new version.
`;

function fail(msg) { console.error('migrate:', msg); process.exit(1); }

const linksPath = path.join(ROOT, 'data', 'links.json');
if (!fs.existsSync(linksPath)) fail('data/links.json missing — run npm run ingest:local first');
const links = JSON.parse(fs.readFileSync(linksPath, 'utf8'));
if (!Array.isArray(links) || !links.length) fail('links.json empty');

let sizes = new Map();
try {
  const df = JSON.parse(fs.readFileSync(path.join(ROOT, 'source-data', 'drive-files.json'), 'utf8'));
  for (const r of df.records || []) if (r.driveId && r.size) sizes.set(r.driveId, Number(r.size));
} catch { /* sizes optional */ }

const dbPath = process.env.APP_DB || path.join(ROOT, 'data', 'app.db');
if (RESET && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
const db = openDb(dbPath);

const existing = db.prepare('SELECT COUNT(*) AS n FROM resources').get().n;
if (existing > 0 && !RESET) fail(`${existing} resources already in DB. Re-run with --reset to rebuild.`);

const PROVIDERS = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'vssa', 'deepti', 'mornington', 'whitman', 'capricorn'];
const now = new Date().toISOString();
const idMap = [];
const insRes = db.prepare(`INSERT INTO resources
  (public_id, title, description, subject, category, provider, file_type, year, tags, answers_included, audience, access_level, status, visibility, featured, size_bytes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', 'available', 1, 0, ?, ?, ?)`);
const insSrc = db.prepare('INSERT INTO resource_sources(resource_id, storage_provider, provider_file_id) VALUES (?, ?, ?)');
const usedIds = new Set();

db.exec('BEGIN');
try {
  for (const r of links) {
    let pid;
    do { pid = crypto.randomBytes(16).toString('hex'); } while (usedIds.has(pid));
    usedIds.add(pid);
    const tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
    const subjects = Array.isArray(r.subjects) ? r.subjects.map(String) : [];
    const provider = tags.find(t => PROVIDERS.includes(t)) || '';
    const year = typeof r.dateModified === 'string' && /^\d{4}/.test(r.dateModified) ? r.dateModified.slice(0, 4) : '';
    const info = insRes.run(
      pid, String(r.title || r.url), String(r.description || ''), subjects[0] || '',
      String(r.category || 'other'), provider, String(r.contentType || 'other'), year,
      JSON.stringify(tags), tags.includes('answers') ? 1 : 0, String(r.audience || ''),
      r.driveId && sizes.has(r.driveId) ? sizes.get(r.driveId) : null, now, now);
    const fileId = String(r.driveId || '');
    if (fileId) insSrc.run(Number(info.lastInsertRowid), 'drive', fileId);
    idMap.push({ oldId: r.id, publicId: pid, url: r.url });
  }
  // terms v1
  db.prepare(`INSERT OR IGNORE INTO terms(version, body_md, summary_md, created_at, created_by)
    VALUES (1, ?, ?, ?, 'migration')`).run(TERMS_V1_BODY, TERMS_V1_SUMMARY, now);
  setMeta(db, 'schema_version', '1');
  setMeta(db, 'migrated_at', now);
  setMeta(db, 'terms_version', '1');
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
console.log(`migrated ${idMap.length} resources → ${dbPath}`);

// id map: server-only (state/ is gitignored)
fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'state', 'id-map.json'), JSON.stringify({ createdAt: now, map: idMap }, null, 1));
console.log(`id map: state/id-map.json (server-only, never commit)`);

// passwords: admin only (viewer role retired — everything is public)
function ensurePassword(role, envName) {
  const row = db.prepare('SELECT role FROM passwords WHERE role = ?').get(role);
  if (row) { console.log(`password [${role}]: already set (unchanged)`); return null; }
  const pw = process.env[envName] || generatePasswordwords(5);
  const fromEnv = Boolean(process.env[envName]);
  const { hash, salt } = hashPassword(pw);
  db.prepare('INSERT INTO passwords(role, hash, salt, created_at) VALUES (?, ?, ?, ?)')
    .run(role, hash, salt, now);
  return { pw, fromEnv };
}
db.prepare(`DELETE FROM passwords WHERE role = 'viewer'`).run();
db.prepare(`DELETE FROM sessions WHERE role != 'admin'`).run();
const flipped = db.prepare(`UPDATE resources SET access_level = 'public' WHERE access_level = 'members'`).run();
if (flipped.changes) console.log(`access tiers collapsed: ${flipped.changes} members-only → public`);
const a = ensurePassword('admin', 'SEHS_ADMIN_PASSWORD');
for (const [role, r] of [['admin', a]]) {
  if (!r) continue;
  if (r.fromEnv) {
    console.log(`password [${role}]: set from SEHS_ADMIN_PASSWORD`);
  } else {
    console.log('');
    console.log('================================================================');
    console.log(`  GENERATED ${role.toUpperCase()} PASSWORD (shown ONCE — save it now):`);
    console.log(`    ${r.pw}`);
    console.log('================================================================');
    console.log('');
  }
}
console.log('done. Start the server with: npm run server');
