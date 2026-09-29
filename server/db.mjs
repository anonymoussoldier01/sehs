// SQLite layer (node:sqlite, zero deps). File-backed DB with full schema.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');

export function dbPath() {
  return process.env.APP_DB || path.join(ROOT, 'data', 'app.db');
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passwords (
  role TEXT PRIMARY KEY,           -- 'viewer' | 'admin'
  hash BLOB NOT NULL,
  salt BLOB NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash BLOB PRIMARY KEY,
  role TEXT NOT NULL,              -- 'anon' | 'viewer' | 'admin'
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  ua_family TEXT NOT NULL DEFAULT '',
  terms_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,  -- 128-bit random hex, the only id clients see
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  provider TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT 'other',
  year TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  answers_included INTEGER NOT NULL DEFAULT 0,
  audience TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'public',  -- public | members
  status TEXT NOT NULL DEFAULT 'available',     -- available | unavailable | needs_verification
  visibility INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_verified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_resources_public ON resources(public_id);
CREATE INDEX IF NOT EXISTS idx_resources_cat ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_access ON resources(access_level, visibility);
CREATE TABLE IF NOT EXISTS resource_sources (
  resource_id INTEGER PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
  storage_provider TEXT NOT NULL DEFAULT 'drive',
  provider_file_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS grants (
  token TEXT PRIMARY KEY,          -- single-use random token
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  session_hash BLOB,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS terms (
  version INTEGER PRIMARY KEY,
  body_md TEXT NOT NULL,
  summary_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system'
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,               -- YYYY-MM-DD for cheap purges
  type TEXT NOT NULL,              -- search|open|unlock|unlock_fail|lockout|terms_accept|consent|purge|admin
  session_hash BLOB,
  resource_id INTEGER,
  data TEXT NOT NULL DEFAULT '{}', -- JSON, no raw IPs / no secrets
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE TABLE IF NOT EXISTS daily_aggregates (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,              -- query|resource|tier
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, key)
);
`;

export function openDb(p = dbPath()) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const db = new DatabaseSync(p);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function getMeta(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
export function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
