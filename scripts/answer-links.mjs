// Answer-key link candidates — heuristic matching with confidence scores.
// Auto-link ONLY above 0.95 (exact stem match + answers signal); everything else
// is flagged for manual review. Never modifies records; prints a report.
// Usage: node scripts/answer-links.mjs [--out state/answer-links.json]
import fs from 'node:fs';

const outIdx = process.argv.indexOf('--out');
const out = outIdx > -1 ? process.argv[outIdx + 1] : 'state/answer-links.json';
const links = JSON.parse(fs.readFileSync(new URL('../data/links.json', import.meta.url), 'utf8'));

const KEY_RE = /\b(answers?|solutions?|marking-?scheme|mark-?scheme|answer-?key|with-?answers)\b/gi;
function stem(title) {
  return String(title || '').toLowerCase().replace(KEY_RE, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function isKey(r) {
  return (r.tags || []).includes('answers') || KEY_RE.test(String(r.title || ''));
}

const byStem = new Map();
for (const r of links) {
  const s = stem(r.title);
  if (!s) continue;
  if (!byStem.has(s)) byStem.set(s, []);
  byStem.get(s).push(r);
}

const auto = [];
const review = [];
for (const [s, group] of byStem) {
  if (group.length < 2) continue;
  const papers = group.filter((r) => !isKey(r));
  const keys = group.filter((r) => isKey(r));
  if (!papers.length || !keys.length) continue;
  for (const p of papers) {
    for (const k of keys) {
      const sameProvider = (p.tags || []).some((t) => (k.tags || []).includes(t));
      const conf = k.tags?.includes('answers') && p.category === k.category ? 0.96 : sameProvider ? 0.8 : 0.6;
      const entry = { paper: p.id, paperTitle: p.title, key: k.id, keyTitle: k.title, confidence: conf };
      if (conf >= 0.95) auto.push(entry);
      else review.push(entry);
    }
  }
}

console.log(`answer-links: stems=${byStem.size} auto-linkable=${auto.length} needs-review=${review.length}`);
for (const e of review.slice(0, 20)) console.log(`  review ${e.confidence.toFixed(2)} "${e.paperTitle.slice(0, 60)}" ↔ "${e.keyTitle.slice(0, 60)}"`);
fs.mkdirSync('state', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), auto, review }, null, 2));
console.log(`report: ${out} (records unchanged)`);
