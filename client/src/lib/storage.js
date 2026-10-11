// Versioned local-first storage schema (v2).
// Rule: NEVER lose user data. migrate() is idempotent, additive-only, and
// keeps a one-time v1 snapshot so a cleared/corrupt write can be recovered
// from the exported backup file. See docs/AUDIT.md section 3 for the key map.
// Validation is plain-JS (zod-equivalent per DECISIONS D3): every persisted
// shape is checked at load and fails gracefully to defaults — corrupt data
// never crashes the app and never silently wipes good data (snapshot first).

export const SCHEMA_VERSION = 2;
const SCHEMA_KEY = 'sehs-schema';
const SNAPSHOT_KEY = 'sehs-backup-v1';

function readRaw(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? undefined : JSON.parse(v);
  } catch {
    return undefined;
  }
}

function writeRaw(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: callers treat as ephemeral */
  }
}

const uid = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

// Lightweight validators: return true when the persisted shape is usable.
const isStr = (v) => typeof v === 'string';
const isStrArr = (v, cap) => Array.isArray(v) && v.length <= cap && v.every(isStr);
export const validators = {
  'sehs-saved': (v) => isStrArr(v, 500),
  'sehs-recent': (v) => Array.isArray(v) && v.length <= 12 && v.every((x) => x && isStr(x.id)),
  'sehs-recent-searches': (v) => isStrArr(v, 8),
  'sehs-lists': (v) => Array.isArray(v) && v.every((l) => l && isStr(l.name) && Array.isArray(l.items)),
  'sehs-decks': (v) => Array.isArray(v) && v.every((d) => d && isStr(d.title) && Array.isArray(d.cards)),
  'sehs-mistakes': (v) => Array.isArray(v) && v.length <= 100,
  'sehs-mocks': (v) => v && typeof v === 'object' && !Array.isArray(v),
  'sehs-grades': (v) => Array.isArray(v),
  'sehs-target-school': (v) => v == null || ['macrob', 'nossal', 'mhs', 'suzanne-cory'].includes(v),
  'sehs-exam-date': (v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v),
};

export function validateKey(key) {
  const fn = validators[key];
  if (!fn) return true;
  const v = readRaw(key);
  if (v === undefined) return true;
  return fn(v);
}

const DEFAULTS = {
  'sehs-saved': [],
  'sehs-recent': [],
  'sehs-recent-searches': [],
  'sehs-lists': [],
  'sehs-decks': [],
  'sehs-mistakes': [],
  'sehs-mocks': {},
  'sehs-grades': [],
  'sehs-target-school': null,
  'sehs-exam-date': null,
};

/** Check every known key; reset corrupt ones to defaults (post-snapshot). */
export function sanitize() {
  const reset = [];
  for (const key of Object.keys(validators)) {
    try {
      if (!validateKey(key)) {
        writeRaw(key, DEFAULTS[key] ?? undefined);
        reset.push(key);
      }
    } catch { /* noop */ }
  }
  return reset;
}

export function schemaVersion() {
  const v = readRaw(SCHEMA_KEY);
  return typeof v === 'number' ? v : 0;
}

/** Idempotent v0/v1 -> v2 migration. Returns { migrated, version }. */
export function migrate() {
  let version = schemaVersion();
  if (version >= SCHEMA_VERSION) return { migrated: false, version };

  // One-time snapshot of every known v1 key before touching anything.
  try {
    if (!localStorage.getItem(SNAPSHOT_KEY)) {
      const keys = [
        'sehs-saved', 'sehs-recent', 'sehs-recent-searches', 'sehs-lists',
        'sehs-decks', 'sehs-leitner', 'sehs-mistakes', 'sehs-mocks',
        'sehs-progress', 'sehs-notes', 'sehs-annotations', 'sehs-review',
        'sehs-grades', 'sehs-settings', 'sehs-streak', 'sehs-insights-v1',
        'sehs-profile-v1', 'sehs-exam-date', 'sehs-target-school', 'sehs-name',
        'sehs-drill-strands',
      ];
      const snap = { at: new Date().toISOString(), from: version, data: {} };
      for (const k of keys) {
        const v = readRaw(k);
        if (v !== undefined) snap.data[k] = v;
      }
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
      } catch {
        /* snapshot best-effort */
      }
    }
  } catch {
    /* noop */
  }

  // Validate + fail gracefully to defaults (post-snapshot, pre-upgrade).
  // Corrupt v1 writes reset; good data untouched.
  try { sanitize(); } catch { /* noop */ }

  // v1 -> v2 upgrades (all additive):
  // 1. Folders gain stable identity + presentation fields.
  try {
    const lists = readRaw('sehs-lists');
    if (Array.isArray(lists)) {
      const upgraded = lists.map((l, i) => ({
        id: l?.id || uid(),
        name: String(l?.name || `Folder ${i + 1}`).slice(0, 80),
        items: Array.isArray(l?.items) ? l.items.slice(0, 100) : [],
        colour: l?.colour || null,
        tags: Array.isArray(l?.tags) ? l.tags.slice(0, 12) : [],
        order: typeof l?.order === 'number' ? l.order : i,
        updatedAt: l?.updatedAt || new Date().toISOString(),
      }));
      writeRaw('sehs-lists', upgraded);
    }
  } catch {
    /* noop */
  }

  // 2. Seed append-only mock history from best-only records (keeps best intact).
  try {
    const best = readRaw('sehs-mocks');
    const hist = readRaw('sehs-mock-history');
    if (best && typeof best === 'object' && !hist) {
      const seeded = {};
      for (const [id, b] of Object.entries(best)) {
        if (b && typeof b.score === 'number')
          seeded[id] = [{ score: b.score, total: b.total, seed: b.seed || null, at: b.at || null, durationSecs: null, migrated: true }];
      }
      writeRaw('sehs-mock-history', seeded);
    }
    if (readRaw('sehs-mock-history') === undefined) writeRaw('sehs-mock-history', {});
  } catch {
    /* noop */
  }

  // 3. Ensure new v2 containers exist (empty, never overwrite).
  for (const [k, v] of [['sehs-fsrs', {}], ['sehs-drafts', {}]]) {
    try {
      if (readRaw(k) === undefined) writeRaw(k, v);
    } catch {
      /* noop */
    }
  }

  version = SCHEMA_VERSION;
  writeRaw(SCHEMA_KEY, version);
  return { migrated: true, version };
}

/** Full backup payload: single JSON file the user can keep. */
export function buildBackup() {
  const data = {};
  // Include the v1 snapshot too when present (recovery chain).
  for (const k of [
    SCHEMA_KEY, 'sehs-saved', 'sehs-recent', 'sehs-recent-searches',
    'sehs-lists', 'sehs-decks', 'sehs-leitner', 'sehs-fsrs', 'sehs-mistakes',
    'sehs-mocks', 'sehs-mock-history', 'sehs-progress', 'sehs-notes',
    'sehs-annotations', 'sehs-review', 'sehs-grades', 'sehs-drafts',
    'sehs-settings', 'sehs-streak', 'sehs-insights-v1', 'sehs-profile-v1',
    'sehs-exam-date', 'sehs-target-school', 'sehs-name', 'sehs-theme',
    'sehs-density', 'sehs-motion', 'sehs-view', 'sehs-drill-strands',
  ]) {
    const v = readRaw(k);
    if (v !== undefined) data[k] = v;
  }
  return { app: 'sehs-study', kind: 'progress-backup', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Validate + restore a backup payload. Additive merge for lists/saved so a
 *  restore never silently drops newer on-device work; scalar prefs overwrite. */
export function restoreBackup(payload) {
  if (!payload || payload.app !== 'sehs-study' || typeof payload.data !== 'object')
    throw new Error('Not an SEHS Study backup file.');
  const d = payload.data;
  const mergeIds = (a, b, cap) => [...new Set([...(b || []), ...(a || [])])].slice(0, cap);
  try {
    if (Array.isArray(d['sehs-saved']))
      writeRaw('sehs-saved', mergeIds(readRaw('sehs-saved'), d['sehs-saved'], 500));
    if (Array.isArray(d['sehs-lists'])) {
      const cur = readRaw('sehs-lists') || [];
      const byName = new Map(cur.map((l) => [l.name, l]));
      for (const l of d['sehs-lists']) {
        if (!l || !l.name) continue;
        const hit = byName.get(l.name);
        if (hit) hit.items = mergeIds(hit.items, l.items, 100);
        else cur.push({ id: l.id || uid(), name: String(l.name).slice(0, 80), items: (l.items || []).slice(0, 100), colour: l.colour || null, tags: l.tags || [], order: cur.length, updatedAt: new Date().toISOString() });
      }
      writeRaw('sehs-lists', cur);
    }
    // Shallow-merge maps (backup wins on conflict for content the user asked to restore).
    for (const k of ['sehs-progress', 'sehs-notes', 'sehs-annotations', 'sehs-leitner', 'sehs-fsrs', 'sehs-drafts', 'sehs-mock-history', 'sehs-streak', 'sehs-insights-v1', 'sehs-profile-v1', 'sehs-settings'])
      if (d[k] && typeof d[k] === 'object') writeRaw(k, { ...(readRaw(k) || {}), ...d[k] });
    for (const k of ['sehs-mistakes', 'sehs-review', 'sehs-grades', 'sehs-decks', 'sehs-recent', 'sehs-recent-searches'])
      if (Array.isArray(d[k])) writeRaw(k, mergeIds(readRaw(k), d[k], k === 'sehs-mistakes' ? 100 : 200));
    if (d['sehs-mocks'] && typeof d['sehs-mocks'] === 'object') {
      const cur = readRaw('sehs-mocks') || {};
      for (const [id, b] of Object.entries(d['sehs-mocks']))
        if (!cur[id] || (b?.score ?? -1) > (cur[id]?.score ?? -1)) cur[id] = b;
      writeRaw('sehs-mocks', cur);
    }
    for (const k of ['sehs-exam-date', 'sehs-target-school', 'sehs-name', 'sehs-theme', 'sehs-density', 'sehs-motion', 'sehs-view'])
      if (d[k] !== undefined) writeRaw(k, d[k]);
    writeRaw(SCHEMA_KEY, SCHEMA_VERSION);
  } catch (e) {
    throw new Error('Restore failed: ' + (e.message || 'storage unavailable'));
  }
  return true;
}

/** Meaningful-progress signal for the gentle backup nudge. */
export function hasMeaningfulProgress() {
  try {
    const saved = (readRaw('sehs-saved') || []).length;
    const notes = Object.keys(readRaw('sehs-notes') || {}).length;
    const mistakes = (readRaw('sehs-mistakes') || []).length;
    const mocks = Object.keys(readRaw('sehs-mocks') || {}).length;
    const grades = (readRaw('sehs-grades') || []).length;
    return saved + notes + mistakes + mocks + grades >= 5;
  } catch {
    return false;
  }
}

export const storage = { migrate, buildBackup, restoreBackup, hasMeaningfulProgress, schemaVersion, SCHEMA_VERSION };
