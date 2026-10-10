// Migration: links.json + drive sizes → database (new 128-bit public IDs).
// Works on both backends (SQLite local, Postgres on Vercel) via the async DB interface.
// Usage: node scripts/migrate.mjs [--reset]
// Passwords: from SEHS_ADMIN_PASSWORD env, else generated once.
// Exports migrateDb(db, { reset }) for server boot-seeding.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase, setMeta, dbPath } from '../server/db.mjs';
import { hashPassword, generatePasswordwords } from '../server/crypto.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');

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

const PROVIDERS = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'vssa', 'deepti', 'mornington', 'whitman', 'capricorn', 'native'];

export async function migrateDb(db, { reset = false } = {}) {
  const linksPath = path.join(ROOT, 'data', 'links.json');
  if (!fs.existsSync(linksPath)) throw new Error('data/links.json missing — run npm run ingest:local first');
  const links = JSON.parse(fs.readFileSync(linksPath, 'utf8'));
  if (!Array.isArray(links) || !links.length) throw new Error('links.json empty');

  let sizes = new Map();
  try {
    const df = JSON.parse(fs.readFileSync(path.join(ROOT, 'source-data', 'drive-files.json'), 'utf8'));
    for (const r of df.records || []) if (r.driveId && r.size) sizes.set(r.driveId, Number(r.size));
  } catch { /* sizes optional */ }

  const existing = (await db.prepare('SELECT COUNT(*) AS n FROM resources').get()).n;
  if (existing > 0 && !reset) {
    // idempotent top-up: collapse tiers + ensure admin password only
    await db.prepare(`UPDATE resources SET access_level = 'public' WHERE access_level = 'members'`).run();
    await db.prepare(`DELETE FROM passwords WHERE role = 'viewer'`).run();
    await db.prepare(`DELETE FROM sessions WHERE role != 'admin'`).run();
    return { migrated: 0, skipped: true };
  }
  if (reset) {
    // Postgres has no file to delete: wipe tables in FK-safe order instead.
    for (const t of ['deck_cards', 'decks', 'grants', 'resource_sources', 'resources', 'events', 'daily_aggregates', 'reports', 'requests', 'announcements', 'sessions', 'passwords', 'terms']) {
      try { await db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table may predate schema */ }
    }
  }

  const now = new Date().toISOString();
  const idMap = [];
  const insRes = db.prepare(`INSERT INTO resources
    (public_id, title, description, subject, category, provider, file_type, year, tags, answers_included, audience, access_level, status, visibility, featured, size_bytes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', 'available', 1, 0, ?, ?, ?)`, { returning: 'id' });
  const insSrc = db.prepare('INSERT INTO resource_sources(resource_id, storage_provider, provider_file_id) VALUES (?, ?, ?)');
  const usedIds = new Set();

  await db.exec('BEGIN');
  try {
    for (const r of links) {
      let pid;
      do { pid = crypto.randomBytes(16).toString('hex'); } while (usedIds.has(pid));
      usedIds.add(pid);
      const tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
      const subjects = Array.isArray(r.subjects) ? r.subjects.map(String) : [];
      const provider = tags.find(t => PROVIDERS.includes(t)) || '';
      const year = typeof r.dateModified === 'string' && /^\d{4}/.test(r.dateModified) ? r.dateModified.slice(0, 4) : '';
      const info = await insRes.run(
        pid, String(r.title || r.url), String(r.description || ''), subjects[0] || '',
        String(r.category || 'other'), provider, String(r.contentType || 'other'), year,
        JSON.stringify(tags), tags.includes('answers') ? 1 : 0, String(r.audience || ''),
        r.driveId && sizes.has(r.driveId) ? sizes.get(r.driveId) : null, now, now);
      const fileId = String(r.driveId || '');
      if (fileId) await insSrc.run(Number(info.lastInsertRowid), 'drive', fileId);
      idMap.push({ oldId: r.id, publicId: pid, url: r.url });
    }
    // terms v1 (ON CONFLICT works on both SQLite and Postgres)
    await db.prepare(`INSERT INTO terms(version, body_md, summary_md, created_at, created_by)
      VALUES (1, ?, ?, ?, 'migration') ON CONFLICT(version) DO NOTHING`).run(TERMS_V1_BODY, TERMS_V1_SUMMARY, now);
    await setMeta(db, 'schema_version', '1');
    await setMeta(db, 'migrated_at', now);
    await setMeta(db, 'terms_version', '1');
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return { migrated: idMap.length, idMap, now };
}

async function ensurePassword(db, now) {
  const row = await db.prepare('SELECT role FROM passwords WHERE role = ?').get('admin');
  if (row) { console.log('password [admin]: already set (unchanged)'); return; }
  const pw = process.env.SEHS_ADMIN_PASSWORD || generatePasswordwords(5);
  const fromEnv = Boolean(process.env.SEHS_ADMIN_PASSWORD);
  const { hash, salt } = hashPassword(pw);
  await db.prepare('INSERT INTO passwords(role, hash, salt, created_at) VALUES (?, ?, ?, ?)')
    .run('admin', hash, salt, now);
  if (fromEnv) {
    console.log('password [admin]: set from SEHS_ADMIN_PASSWORD');
  } else {
    console.log('');
    console.log('================================================================');
    console.log('  GENERATED ADMIN PASSWORD (shown ONCE, save it now):');
    console.log(`    ${pw}`);
    console.log('================================================================');
    console.log('');
  }
}

async function main() {
  const RESET = process.argv.includes('--reset');
  if (RESET && !process.env.DATABASE_URL) {
    const p = dbPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const db = await openDatabase();
  try {
    const { migrated, skipped, idMap, now } = await migrateDb(db, { reset: RESET });
    if (skipped) {
      console.log('DB already seeded; tiers collapsed, viewer role removed.');
    } else {
      console.log(`migrated ${migrated} resources`);
      try {
        fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'state', 'id-map.json'), JSON.stringify({ createdAt: now, map: idMap }, null, 1));
        console.log('id map: state/id-map.json (server-only, never commit)');
      } catch { /* serverless: ephemeral fs, skip */ }
    }
    await ensurePassword(db, new Date().toISOString());
    console.log('done. Start the server with: npm run server');
  } finally {
    await db.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(e => { console.error('migrate:', e.message); process.exit(1); });
