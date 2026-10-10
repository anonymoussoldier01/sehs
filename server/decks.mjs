// Study decks: auto-generated from the collection + admin-authored (DB).
// Every auto card links back to its source resource. No invented content.
import { pretty } from './templates.mjs';

function sampleBy(groupOf, docs, perGroup, groups) {
  const buckets = new Map();
  for (const d of docs) {
    const g = groupOf(d);
    if (!g) continue;
    if (!buckets.has(g)) buckets.set(g, []);
    if (buckets.get(g).length < perGroup) buckets.get(g).push(d);
  }
  const keys = [...buckets.keys()].sort();
  const pick = groups ? keys.slice(0, groups) : keys;
  return pick.flatMap(k => buckets.get(k));
}

export function autoDecks(index, rowMap) {
  const docs = index.docs.filter(d => rowMap.has(d.rec.id) && d.rec.contentType !== 'folder' && d.rec.category !== 'folder');
  const card = (d, back) => ({
    front: d.displayTitle,
    back,
    resourceId: d.rec.id,
  });
  const decks = [];
  const provDocs = sampleBy(
    d => (d.rec.tags || []).find(t => ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse'].includes(t)),
    docs, 4, 8);
  if (provDocs.length >= 8) {
    decks.push({
      id: 'auto-provider', source: 'auto',
      title: 'Provider recognition',
      description: 'Given a paper title, name the provider that made it.',
      cards: provDocs.map(d => {
        const p = (d.rec.tags || []).find(t => ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse'].includes(t));
        return card(d, pretty(p));
      }),
    });
  }
  const subjDocs = sampleBy(d => (d.rec.subjects || [])[0], docs, 5, 6);
  if (subjDocs.length >= 8) {
    decks.push({
      id: 'auto-subject', source: 'auto',
      title: 'Subject recognition',
      description: 'Given a resource title, name the subject it belongs to.',
      cards: subjDocs.map(d => card(d, pretty((d.rec.subjects || [])[0] || d.rec.category))),
    });
  }
  const paperDocs = docs.filter(d => d.rec.category === 'practice-test').slice(0, 30);
  if (paperDocs.length >= 8) {
    decks.push({
      id: 'auto-practice', source: 'auto',
      title: 'Practice paper roundup',
      description: 'Know what each practice paper covers before you open it.',
      cards: paperDocs.map(d => {
        const subj = ((d.rec.subjects || [])[0] || d.rec.category || '').replace(/-/g, ' ');
        const prov = (d.rec.tags || []).find(t => ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse'].includes(t));
        return card(d, `${pretty(subj)}${prov ? ' · ' + pretty(prov) : ''}`);
      }),
    });
  }
  return decks.map(d => ({ ...d, count: d.cards.length }));
}

export function adminDecks(db) {
  return db.prepare('SELECT * FROM decks ORDER BY updated_at DESC').all().map(r => ({
    id: 'db-' + r.public_id, source: 'admin', title: r.title, description: r.description,
    count: db.prepare('SELECT COUNT(*) n FROM deck_cards WHERE deck_id = ?').get(r.id).n,
  }));
}

export function deckCards(db, index, rowMap, id) {
  if (id === 'auto-provider' || id === 'auto-subject' || id === 'auto-practice') {
    const full = autoDecks(index, rowMap).find(d => d.id === id);
    return full ? { ...full } : null;
  }
  const m = String(id).match(/^db-([0-9a-f]{32})$/);
  if (!m) return null;
  const r = db.prepare('SELECT * FROM decks WHERE public_id = ?').get(m[1]);
  if (!r) return null;
  const cards = db.prepare('SELECT front, back FROM deck_cards WHERE deck_id = ? ORDER BY position, id').all(r.id);
  return { id: 'db-' + r.public_id, source: 'admin', title: r.title, description: r.description, count: cards.length, cards: cards.map(c => ({ front: c.front, back: c.back, resourceId: null })) };
}
