// Postgres backend (pg Pool) with the same async interface as the SQLite shim.
// Single source of truth for the PG schema. Placeholders: callers keep `?`,
// translated to $1..$n here. Rule: NEVER interpolate values into SQL strings.
import pg from 'pg';

export const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passwords (
  role TEXT PRIMARY KEY,
  hash BYTEA NOT NULL,
  salt BYTEA NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  sid SERIAL PRIMARY KEY,
  token_hash BYTEA NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  ua_family TEXT NOT NULL DEFAULT '',
  terms_version INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  provider TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT 'other',
  year TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  answers_included INTEGER NOT NULL DEFAULT 0,
  audience TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'available',
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
  token TEXT PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  session_hash BYTEA,
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
  id SERIAL PRIMARY KEY,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  session_hash BYTEA,
  resource_id INTEGER,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE TABLE IF NOT EXISTS daily_aggregates (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, key)
);
CREATE TABLE IF NOT EXISTS decks (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deck_cards (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON deck_cards(deck_id, position);
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  resource_id INTEGER,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
`;

function toPg(sql) {
  let i = 0;
  return String(sql).replace(/\?/g, () => `$${++i}`);
}

class PgStmt {
  constructor(db, sql, opts = {}) {
    this.db = db;
    this.returning = opts.returning || null;
    const base = toPg(sql);
    this.sql = this.returning && /^\s*insert/i.test(sql) ? `${base} RETURNING ${this.returning}` : base;
  }
  async get(...params) {
    const r = await this.db.query(this.sql, params);
    return r.rows[0] ?? null;
  }
  async all(...params) {
    const r = await this.db.query(this.sql, params);
    return r.rows;
  }
  async run(...params) {
    const r = await this.db.query(this.sql, params);
    const out = { changes: r.rowCount ?? 0 };
    if (this.returning && r.rows[0]) {
      const v = r.rows[0][this.returning];
      out.lastInsertRowid = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
    }
    return out;
  }
}

export class PgDb {
  constructor(pool) {
    this.pool = pool;
    this.txClient = null;
  }
  async query(sql, params) {
    if (this.txClient) return this.txClient.query(sql, params);
    return this.pool.query(sql, params);
  }
  prepare(sql, opts) {
    return new PgStmt(this, sql, opts);
  }
  // exec() handles DDL, raw multi-statement schema, and BEGIN/COMMIT/ROLLBACK
  // transaction pinning (migrate + bulk card replace rely on it).
  async exec(sql) {
    const t = String(sql).trim().toUpperCase();
    if (t === 'BEGIN') {
      if (!this.txClient) {
        this.txClient = await this.pool.connect();
        await this.txClient.query('BEGIN');
      }
      return;
    }
    if (t === 'COMMIT' || t === 'ROLLBACK') {
      if (this.txClient) {
        try { await this.txClient.query(t); } finally { this.txClient.release(); this.txClient = null; }
      }
      return;
    }
    if (t.startsWith('PRAGMA')) return; // sqlite-only no-op
    await this.query(sql, []);
  }
  async close() {
    if (this.txClient) { try { this.txClient.release(); } catch {} this.txClient = null; }
    await this.pool.end();
  }
}

export async function openPostgres(connectionString, { poolFactory = null } = {}) {
  const pool = poolFactory ? poolFactory() : new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString || '') ? false : { rejectUnauthorized: false },
  });
  const db = new PgDb(pool);
  await db.exec(PG_SCHEMA);
  return db;
}
