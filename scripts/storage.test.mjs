// Storage migration test: seeded legacy v1 dataset -> v2.
// Run: node scripts/storage.test.mjs
import assert from 'node:assert/strict';

// Minimal localStorage mock for Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const seed = async (obj) => {
  store.clear();
  for (const [k, v] of Object.entries(obj)) localStorage.setItem(k, JSON.stringify(v));
};

// Legacy v1: folders without id/colour/tags, best-only mocks, no schema key,
// plus one corrupt key (sehs-saved as object) to prove graceful fallback.
await seed({
  'sehs-saved': { not: 'an-array' },
  'sehs-lists': [{ name: 'Weak spots', items: ['a', 'b'] }],
  'sehs-mocks': { mock1: { score: 8, total: 10, seed: 's1', at: '2026-01-01' } },
  'sehs-target-school': 'nossal',
  'sehs-name': 'Test',
});

const { migrate, buildBackup, restoreBackup, schemaVersion, validators } = await import(
  '../client/src/lib/storage.js'
);

const r1 = migrate();
assert.equal(r1.version, 2, 'migrates to v2');
assert.equal(schemaVersion(), 2, 'schema stamp written');
assert.ok(localStorage.getItem('sehs-backup-v1'), 'v1 snapshot kept');

// Corrupt saved resets gracefully (never crashes, never keeps bad shape).
assert.equal(validators['sehs-saved'](JSON.parse(localStorage.getItem('sehs-saved') || 'null')), true);

// Folders upgraded with stable identity, items preserved.
const lists = JSON.parse(localStorage.getItem('sehs-lists'));
assert.equal(lists.length, 1);
assert.ok(lists[0].id, 'folder gains id');
assert.deepEqual(lists[0].items, ['a', 'b']);

// Best-only seeds append-only history, best intact.
const hist = JSON.parse(localStorage.getItem('sehs-mock-history'));
assert.ok(Array.isArray(hist.mock1) && hist.mock1[0].score === 8, 'history seeded from best');
assert.equal(JSON.parse(localStorage.getItem('sehs-mocks')).mock1.score, 8, 'best kept');

// Idempotent second run.
const r2 = migrate();
assert.equal(r2.migrated, false, 'second migrate is no-op');

// Backup/restore round-trip never drops newer on-device work.
const backup = buildBackup();
assert.equal(backup.app, 'sehs-study');
await seed({ 'sehs-saved': ['new-id'] });
restoreBackup(backup);
const saved = JSON.parse(localStorage.getItem('sehs-saved'));
assert.ok(saved.includes('new-id'), 'restore merges, keeps newer device work');

console.log('storage.test: 8 checks passed (migration + validation + backup/restore)');
