// Seeds native SEHS decks from data/native/*.json (idempotent, server-only).
// Usage: node scripts/seed-native.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/db.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const NATIVE = path.join(ROOT, 'data', 'native');

const pidFor = (name) => crypto.createHash('sha256').update('native:' + name).digest('hex').slice(0, 32);
const nowIso = () => new Date().toISOString();

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

async function upsertDeck(db, key, title, description, cards) {
  const pid = pidFor(key);
  const now = nowIso();
  const existing = await db.prepare('SELECT * FROM decks WHERE public_id = ?').get(pid);
  let deckId;
  if (!existing) {
    const info = await db.prepare('INSERT INTO decks(public_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', { returning: 'id' }).run(pid, title, description.slice(0, 500), now, now);
    deckId = Number(info.lastInsertRowid);
  } else {
    deckId = existing.id;
    await db.prepare('UPDATE decks SET title = ?, description = ?, updated_at = ? WHERE id = ?').run(title, description.slice(0, 500), now, deckId);
    await db.prepare('DELETE FROM deck_cards WHERE deck_id = ?').run(deckId);
  }
  const ins = db.prepare('INSERT INTO deck_cards(deck_id, front, back, position) VALUES (?, ?, ?, ?)');
  let pos = 0, added = 0;
  for (const c of cards.slice(0, 2000)) {
    const f = String(c.front || '').trim().slice(0, 500);
    const b = String(c.back || '').trim().slice(0, 2000);
    if (!f || !b) continue;
    await ins.run(deckId, f, b, pos++);
    added++;
  }
  return { pid, added };
}

async function main() {
  const db = await openDatabase();
  try {
    const out = [];
    const banks = [
      ['vocab', 'SEHS Vocab Foundation', 'High-frequency ACER-style words with synonyms and sentences.'],
      ['verbal', 'Verbal Reasoning Builder', 'Analogies, synonyms, odd-one-out, codes, deductions.'],
      ['quant', 'Quantitative Reasoning Builder', 'Series, arithmetic, Venn, spatial.'],
      ['maths', 'Maths Core (Year 8)', 'Fractions, %, algebra, geometry, BODMAS.'],
      ['grammar', 'Grammar & Sentences', 'Spelling, punctuation, sentence variety.'],
    ];
    for (const [key, title, desc] of banks) {
      const p = path.join(NATIVE, key + '.json');
      if (!fs.existsSync(p)) { console.log(`skip ${key}: missing`); continue; }
      const j = loadJson(p);
      const r = await upsertDeck(db, key, j.title || title, j.description || desc, j.cards || []);
      out.push(`${key}: ${r.added} cards (db-${r.pid.slice(0, 8)}…)`);
    }
    console.log('seed-native done:');
    out.forEach(l => console.log('  ' + l));
  } finally { await db.close(); }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(e => { console.error('seed-native:', e.message); process.exit(1); });
