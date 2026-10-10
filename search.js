// SEHS Study Directory — local relevance search engine v2 (zero dependencies).
// BM25-lite rarity scoring + typo-ranked candidates + prefix + field syntax.
// Works in the browser (ES module) and in Node (for tests).
// NEVER mutates the source dataset: builds a derived index, keeps originals.

export const PROVIDERS = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'vssa', 'deepti', 'mornington', 'whitman', 'capricorn', 'native'];
export const TYPES = ['pdf', 'docx', 'doc', 'image', 'archive', 'zip', 'webpage', 'code', 'other'];
export const CATS = ['exam-prep', 'maths', 'english', 'reading', 'writing', 'verbal-reasoning', 'numerical-reasoning', 'quantitative', 'past-paper', 'practice-test', 'study-guide', 'reference', 'tutorial', 'tool', 'document', 'other'];

// Zero-discrimination metadata: present on (nearly) every record.
const STOP_TAGS = new Set(['google-drive', 'drive-folder']);
// Query filler words dropped before matching (unless the whole query is filler).
const STOPWORDS = new Set(['with', 'from', 'for', 'the', 'a', 'an', 'and', 'of', 'in', 'on', 'to']);
// Tokens that must never be stemmed.
const KEEP = new Set(['maths', 'physics', 'news']);
// Canonical equivalences (all variants AND-required after mapping).
const EXPAND = {
  math: ['maths'],
  practise: ['practice'],
  practicepaper: ['practice', 'paper'],
  practicepapers: ['practice', 'paper'],
  practicetest: ['practice', 'test'],
  practicetests: ['practice', 'test'],
  pastpaper: ['past', 'paper'],
  pastpapers: ['past', 'paper'],
  readings: ['reading'],
  writings: ['writing'],
  sciences: ['science'],
  numeracy: ['numerical'],
};
// OR-alternatives: matching ANY variant satisfies the term (first = canonical).
const ALT = {
  exam: ['exam', 'test', 'quiz'], test: ['test', 'exam', 'quiz'], quiz: ['quiz', 'test'],
  exams: ['exam', 'test', 'quiz'], tests: ['test', 'exam', 'quiz'],
  homework: ['homework', 'practice'], practice: ['practice', 'homework'],
  methods: ['methods', 'method', 'mathematical'],
  vr: ['verbal', 'reasoning'], qr: ['quantitative'],
  answer: ['answer', 'solution', 'marking'], answers: ['answer', 'solution', 'marking'],
};
// Concept substitution for study terms absent from the corpus vocabulary:
// "algebra" means maths here even though no record literally says "algebra".
// Keys are post-stem forms; values must exist in the index vocabulary.
const CONCEPT = {
  algebra: ['maths'], geometry: ['maths'], calculus: ['maths'], trigonometry: ['maths'],
  fraction: ['maths'], decimal: ['maths'], probability: ['maths'], statistic: ['maths'],
  physics: ['science'], chemistry: ['science'], biology: ['science'],
  essay: ['writing'], vocabulary: ['english'], vocab: ['english'], grammar: ['english'],
  analogy: ['verbal'], analogies: ['verbal'], synonym: ['verbal'], antonym: ['verbal'],
  passage: ['reading'], prompt: ['writing'], sequence: ['quantitative'], series: ['quantitative'],
  matrix: ['quantitative'], cipher: ['verbal'], codebreaking: ['verbal'],
};

// ---- normalisation -------------------------------------------------------
export function stem(tok) {
  if (KEEP.has(tok) || tok.length <= 3) return tok;
  if (tok.endsWith('ies') && tok.length > 5) return tok.slice(0, -3) + 'y';
  if (tok.endsWith('es') && tok.length > 5) return tok.slice(0, -2);
  if (tok.endsWith('s') && !tok.endsWith('ss')) return tok.slice(0, -1);
  return tok;
}

export function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase()
    .replace(/[~$+*^#@!?;:"'‘’“”()[\]{}<>|\\/=]/g, ' ')
    .replace(/[-_./,]+/g, ' ')
    .replace(/(\d)t(\d)/g, '$1t $2')
    .split(/[^a-z0-9]+/)
    .filter(t => t && t.length > 0)
    .map(stem)
    .filter(Boolean);
}

export function normJoin(text) {
  return tokenize(text).join(' ');
}

// Query text → { tokens, phrase, fieldFilters }. Expansion + stopword removal.
// Supports field:value syntax (provider:acer type:pdf category:maths answers:yes year:2024).
export function normalizeQuery(q) {
  const raw = String(q || '').toLowerCase().trim();
  const out = { tokens: [], phrase: '', fieldFilters: {}, corrected: null };
  if (!raw) return out;
  const fields = {};
  const rest = [];
  for (const part of raw.split(/\s+/)) {
    const m = part.match(/^([a-z]+):(.+)$/);
    if (m && ['provider', 'type', 'category', 'subject', 'answers', 'year'].includes(m[1]) && m[2]) {
      (fields[m[1]] = fields[m[1]] || []).push(m[2]);
    } else rest.push(part);
  }
  out.fieldFilters = fields;
  const joined = rest.join(' ');
  const expanded = EXPAND[joined] ? EXPAND[joined].join(' ') : joined;
  let toks = tokenize(expanded);
  toks = toks.flatMap(t => EXPAND[t] || [t]);
  const content = toks.filter(t => !STOPWORDS.has(t));
  out.tokens = content.length ? content : toks;
  out.phrase = out.tokens.join(' ');
  return out;
}

// ---- display titles -------------------------------------------------------
export function cleanDisplayName(driveName, title, desc = '') {
  let t = String(title || driveName || '').trim();
  t = t.replace(/~\$[^\s]*/g, ' ');
  t = t.replace(/^copy of\s+/i, '');
  t = t.replace(/20\d{6}T\d{6}Z/g, ' ');
  t = t.replace(/^(?:\d+[._\s-]+)+(?=[A-Za-z])/g, '');
  t = t.replace(/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|zip|htm|html|js|css)$/i, '');
  t = t.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*-?\s*0+\d*\s*$/g, '').trim();
  let out = t.slice(0, 200);
  if (!/[A-Za-z]/.test(out)) {
    // bare section numbers like "1.1": borrow real words from the description
    // ("1.1. Practice material." → "Practice material 1.1")
    const words = String(desc || '').split(/[\s\-–—_]+/)
      .filter(w => /[A-Za-z]{2,}/.test(w)).slice(0, 5).join(' ')
      .replace(/\s*[.!?;,]+$/g, '').trim().slice(0, 160);
    if (words) out = `${words} ${out}`.trim().slice(0, 200);
  }
  return out || String(title || driveName || 'Untitled resource');
}

export function fallbackType(driveName) {
  const m = String(driveName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m ? m[1] : '';
  if (['js', 'css'].includes(ext)) return 'code';
  if (['htm', 'html'].includes(ext)) return 'webpage';
  return 'other';
}

// ---- index ----------------------------------------------------------------
function tagWeight(tag) {
  if (STOP_TAGS.has(tag)) return 0;
  if (/^set-/.test(tag)) return 1;
  if (tag === 'answers') return 5;
  if (PROVIDERS.includes(tag)) return 6;
  return 3;
}

const K1 = 1.2, B = 0.4; // BM25-lite: short fields, mild length norm

export function buildIndex(links) {
  const docs = links.map((rec) => {
    const type = rec.contentType || fallbackType(rec.driveName);
    const titleToks = tokenize(rec.title);
    const titleCounts = new Map();
    const titlePos = new Map();
    titleToks.forEach((t, i) => {
      titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
      if (!titlePos.has(t)) titlePos.set(t, i);
    });
    const tagMap = new Map();
    for (const tag of (rec.tags || [])) {
      const w = tagWeight(String(tag).toLowerCase());
      if (!w) continue;
      for (const t of tokenize(tag)) {
        if (!tagMap.has(t) || tagMap.get(t) < w) tagMap.set(t, w);
      }
    }
    return {
      rec, type,
      displayTitle: cleanDisplayName(rec.driveName, rec.title, rec.description || rec.summary),
      titleToks, titleCounts, titlePos, titleLen: Math.max(1, titleToks.length),
      titlePhrase: titleToks.join(' '),
      tagMap,
      kwSet: new Set(tokenize((rec.keywords || []).join(' '))),
      catSet: new Set(tokenize(rec.category)),
      subSet: new Set(tokenize(rec.subcategory)),
      subjSet: new Set(tokenize((rec.subjects || []).join(' '))),
      descSet: new Set(tokenize(rec.description)),
      summSet: new Set(tokenize(rec.summary)),
      typeSet: new Set(tokenize(type)),
      yearSet: new Set(rec.dateModified && /^\d{4}/.test(rec.dateModified) ? [rec.dateModified.slice(0, 4)] : []),
      hasAnswers: (rec.tags || []).includes('answers'),
      isPaper: rec.category === 'practice-test' || rec.category === 'past-paper' ||
        /paper|test|exam|pack|homework|quiz/i.test(rec.title || ''),
    };
  });
  const N = docs.length;
  const vocab = new Set();
  const df = new Map();
  let titleLenSum = 0;
  for (const d of docs) {
    titleLenSum += d.titleLen;
    const seen = new Set([...d.titleCounts.keys(), ...d.tagMap.keys(), ...d.kwSet, ...d.catSet, ...d.subSet, ...d.subjSet, ...d.typeSet]);
    for (const t of seen) { vocab.add(t); df.set(t, (df.get(t) || 0) + 1); }
  }
  const idf = (t) => {
    const f = df.get(t) || 0;
    return Math.log(1 + (N - f + 0.5) / (f + 0.5));
  };
  // co-occurrence concept graph: distinctive same-doc tokens → related ranking
  const co = new Map();
  for (const d of docs) {
    const toks = [...new Set([...d.titleToks, ...d.tagMap.keys()])].filter(t => {
      const f = df.get(t) || 0;
      return f >= 2 && f / N <= 0.5 && t.length > 2 && !STOPWORDS.has(t);
    }).slice(0, 24);
    for (let i = 0; i < toks.length; i++) for (let j = i + 1; j < toks.length; j++) {
      const a = toks[i], b = toks[j];
      if (!co.has(a)) co.set(a, new Map());
      if (!co.has(b)) co.set(b, new Map());
      co.get(a).set(b, (co.get(a).get(b) || 0) + 1);
      co.get(b).set(a, (co.get(b).get(a) || 0) + 1);
    }
  }
  const cooccur = new Map();
  for (const [t, m] of co) {
    const ft = df.get(t) || 1;
    const rel = [...m.entries()]
      .map(([u, c]) => [u, c / Math.sqrt(ft * (df.get(u) || 1))])
      .filter(([u, s]) => s > 0.15 && u !== t)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u]) => u);
    if (rel.length) cooccur.set(t, rel);
  }
  // corpus stopwords: tokens in >40% of docs carry ~no signal (never gate on them)
  const corpusStop = new Set([...df.entries()].filter(([, f]) => f / N > 0.4).map(([t]) => t));
  // sorted vocab for linear prefix scans
  const vocabSorted = [...vocab].sort();
  // suggestion pool (human-readable raw labels with live counts)
  const pool = [];
  const poolCount = (fn) => {
    const m = new Map();
    for (const d of docs) for (const v of fn(d)) m.set(v, (m.get(v) || 0) + 1);
    return m;
  };
  for (const p of PROVIDERS) {
    const c = docs.filter(d => d.tagMap.has(p)).length;
    if (c) pool.push({ label: p, kind: 'provider', count: c });
  }
  for (const [label, count] of poolCount(d => d.rec.category ? [String(d.rec.category).toLowerCase()] : []))
    pool.push({ label, kind: 'category', count });
  for (const [label, count] of poolCount(d => (d.rec.subjects || []).map(s => String(s).toLowerCase())))
    pool.push({ label, kind: 'subject', count });
  for (const [label, count] of poolCount(d =>
    (d.rec.tags || []).map(t => String(t).toLowerCase()).filter(t => !STOP_TAGS.has(t) && !/^set-/.test(t))))
    pool.push({ label, kind: 'tag', count });
  return { docs, vocab, vocabSorted, df, idf, corpusStop, cooccur, avgTitleLen: titleLenSum / Math.max(1, N), total: N, pool };
}

// ---- fuzzy ----------------------------------------------------------------
export function lev(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (!la) return lb; if (!lb) return la;
  if (Math.abs(la - lb) > 2) return 3;
  let prev = new Array(lb + 1), cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    for (let j = 1; j <= lb; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[lb];
}

// Meilisearch-style thresholds: <5 chars exact only; 5+ one typo; 9+ two typos.
function fuzzyLimit(tok) {
  if (tok.length < 5) return 0;
  if (tok.length < 9) return 1;
  return 2;
}

export function closestToken(index, tok) {
  const lim = fuzzyLimit(tok);
  if (!lim || index.vocab.has(tok)) return null;
  let best = null, bestD = Infinity;
  for (const v of index.vocab) {
    if (Math.abs(v.length - tok.length) > lim) continue;
    if (v[0] !== tok[0] && lim < 2) continue;
    const d = lev(tok, v);
    if (d <= lim && d < bestD) { best = v; bestD = d; if (d === 1 && lim === 1) break; }
  }
  return best;
}

// prefix candidates from sorted vocab (binary lower-bound + linear scan)
function prefixMatches(index, p, cap = 12) {
  const out = [];
  if (p.length < 2) return out;
  let lo = 0, hi = index.vocabSorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (index.vocabSorted[mid] < p) lo = mid + 1; else hi = mid;
  }
  for (let i = lo; i < index.vocabSorted.length && out.length < cap; i++) {
    const v = index.vocabSorted[i];
    if (!v.startsWith(p)) break;
    if (v !== p) out.push(v);
  }
  return out;
}

// ---- scoring (BM25-lite) ------------------------------------------------------
const BOOST = { title: 3.0, keyword: 2.2, tag: 1.0 /*×tagWeight*/, subject: 1.8, category: 1.4, desc: 0.8, summary: 0.8, type: 1.6, year: 2.0 };

function bm25tf(tf, len, avgLen) {
  return (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * len) / Math.max(1, avgLen)));
}

function intents(qtoks) {
  const has = (...ws) => ws.some(w => qtoks.includes(w));
  return {
    answers: has('answer', 'answers', 'solution', 'marking'),
    paper: has('paper', 'papers', 'test', 'tests', 'exam', 'exams', 'practice', 'pack'),
    type: qtoks.find(t => TYPES.includes(t)) || null,
    year: qtoks.find(t => /^(19|20)\d{2}$/.test(t)) || null,
  };
}

// Expand one query token into match candidates: [{tok, typos, weight, isPrefix}]
// isLast controls prefix expansion (Meilisearch-style: prefix only on final term).
function candidatesFor(index, tok, isLast) {
  const out = [{ tok, typos: 0, weight: 1, isPrefix: false }];
  if (index.vocab.has(tok)) {
    if (isLast) {
      for (const p of prefixMatches(index, tok, 6)) out.push({ tok: p, typos: 0, weight: 0.4, isPrefix: true });
    }
    return out;
  }
  const lim = fuzzyLimit(tok);
  if (lim && isLast) {
    for (const p of prefixMatches(index, tok, 6)) out.push({ tok: p, typos: 0, weight: 0.4, isPrefix: true });
  }
  if (lim) {
    let best = null, bestD = Infinity;
    for (const v of index.vocab) {
      if (Math.abs(v.length - tok.length) > lim) continue;
      if (v[0] !== tok[0] && lim < 2) continue;
      const d = lev(tok, v);
      if (d <= lim && d < bestD) { best = v; bestD = d; }
    }
    if (best) out.push({ tok: best, typos: bestD, weight: 1 / (1 + bestD), isPrefix: false });
  }
  return out;
}

// term variants (OR-alternatives): score = best variant
function variantsOf(tok) {
  return ALT[tok] || [tok];
}

function termFieldScore(index, doc, tok) {
  let best = 0, where = '';
  const id = index.idf(tok);
  if (id <= 0.01) return { score: 0, where };
  const tf = doc.titleCounts.get(tok) || 0;
  if (tf) {
    const s = BOOST.title * id * bm25tf(tf, doc.titleLen, index.avgTitleLen);
    if (s > best) { best = s; where = 'title'; }
  }
  if (doc.tagMap.has(tok)) {
    const s = doc.tagMap.get(tok) * id;
    if (s > best) { best = s; where = 'tag'; }
  }
  const setFields = [[doc.kwSet, BOOST.keyword, 'kw'], [doc.subjSet, BOOST.subject, 'subj'],
    [doc.subSet, BOOST.category, 'sub'], [doc.catSet, BOOST.category, 'cat'],
    [doc.descSet, BOOST.desc, 'desc'], [doc.summSet, BOOST.summary, 'summ'],
    [doc.typeSet, BOOST.type, 'type'], [doc.yearSet, BOOST.year, 'year']];
  for (const [set, boost, name] of setFields) {
    if (set.has(tok)) {
      const s = boost * id;
      if (s > best) { best = s; where = name; }
    }
  }
  return { score: best, where };
}

// Score one doc against candidate lists. Returns null when gated out.
// Each candidate: {tok, typos, weight, isPrefix, gateOptional, required}.
// minRequired: minimum hits on required candidates (for expansion passes).
function scoreDoc(index, doc, cands, phrase, intent, { allowPartial = false, minRequired = 0 } = {}) {
  let s = 0, hits = 0, typos = 0, reqHits = 0;
  const matchedPos = [];
  for (const c of cands) {
    let best = 0, bestTypos = 0, bestTok = c.tok;
    for (const v of variantsOf(c.tok)) {
      const r = termFieldScore(index, doc, v);
      const w = r.score * c.weight;
      if (w > best) { best = w; bestTypos = c.typos; bestTok = v; }
    }
    if (best > 0) {
      hits++; s += best; typos += bestTypos;
      if (c.required) reqHits++;
      if (doc.titlePos.has(bestTok)) matchedPos.push(doc.titlePos.get(bestTok));
    } else if (!c.gateOptional && !allowPartial) {
      return null; // strict AND gate
    }
  }
  if (!allowPartial && hits < cands.filter(c => !c.gateOptional).length) return null;
  if (allowPartial && !hits) return null;
  if (reqHits < minRequired) return null;
  const coverage = hits / Math.max(1, cands.length);
  if (allowPartial) s *= (0.35 + 0.65 * coverage);
  // exact phrase bonus + slop-1 adjacency
  if (phrase && phrase.includes(' ')) {
    if (doc.titlePhrase.includes(phrase)) {
      s += 10 * Math.max(1, ...phrase.split(' ').map(t => index.idf(t)));
    } else {
      const pt = phrase.split(' ');
      let adjacent = 0;
      for (let i = 0; i + 1 < pt.length; i++) {
        const a = doc.titlePos.get(pt[i]), b = doc.titlePos.get(pt[i + 1]);
        if (a !== undefined && b !== undefined && Math.abs(b - a) <= 2) adjacent++;
      }
      if (adjacent) s += adjacent * 3;
    }
  }
  if (matchedPos.length >= 2) {
    const span = Math.max(...matchedPos) - Math.min(...matchedPos) + 1;
    s += (matchedPos.length / span) * 4;
  }
  if (intent.answers && doc.hasAnswers) s += 4;
  if (intent.paper && doc.isPaper) s += 2;
  if (intent.type && doc.typeSet.has(intent.type === 'doc' ? 'docx' : intent.type)) s += 4;
  if (intent.year && doc.yearSet.has(intent.year)) s += 6;
  s += (doc.rec.confidence || 0.5) * 0.5;
  return { score: s, hits, typos, coverage };
}

function sortScored(out) {
  // typo count is a sort key ABOVE score (Meilisearch rule), then score, then title.
  out.sort((a, b) => a.typos - b.typos || b.score - a.score || String(a.doc.displayTitle).localeCompare(String(b.doc.displayTitle)));
  return out;
}

// Split field:value filters into validated gates + fallback text tokens.
// Unknown field values are NOT dropped: they rejoin the query as plain text.
function splitFields(index, fieldFilters) {
  const gates = {}, extra = [];
  for (const [k, vals] of Object.entries(fieldFilters)) {
    for (const v of vals) {
      const toks = tokenize(v);
      if (!toks.length) continue;
      let valid = false;
      if (k === 'provider') valid = toks.every(t => PROVIDERS.includes(t));
      else if (k === 'type') valid = toks.every(t => TYPES.some(x => x.startsWith(t)));
      else if (k === 'category') valid = toks.every(t => CATS.includes(t));
      else if (k === 'subject') valid = toks.some(t => index.vocab.has(t));
      else if (k === 'answers') valid = toks.length === 1 && /^(yes|true|1|included|no|false|0)$/.test(toks[0]);
      else if (k === 'year') valid = toks.some(t => /^(19|20)\d{2}$/.test(t));
      if (valid) {
        if (!gates[k]) gates[k] = new Set();
        toks.forEach(t => gates[k].add(t));
      } else {
        for (const t of toks) if (!extra.includes(t)) extra.push(t);
      }
    }
  }
  return { gates, extra };
}
function fieldGate(rec, gates) {
  const tags = (rec.tags || []).map(String);
  if (gates.provider && ![...gates.provider].some(v => tags.includes(v))) return false;
  if (gates.type && ![...gates.type].some(v => (rec.contentType || '').toLowerCase().startsWith(v))) return false;
  if (gates.category && ![...gates.category].some(v => (rec.category || '').toLowerCase() === v)) return false;
  if (gates.subject && ![...gates.subject].some(v => (rec.subjects || []).map(s => String(s).toLowerCase()).includes(v))) return false;
  if (gates.answers) {
    const want = [...gates.answers][0];
    const has = tags.includes('answers');
    if (/^(yes|true|1|included)$/.test(want) ? !has : has) return false;
  }
  if (gates.year && ![...gates.year].some(v => (rec.dateModified || '').slice(0, 4) === v)) return false;
  return true;
}
// Main entry: { results, mode, corrected, dropped, related }
// modes: exact | drop | partial | fuzzy | none (fuzzy overlays via typos>0 + corrected)
export function search(index, query, opts = {}) {
  const nq = normalizeQuery(query);
  const { gates, extra } = splitFields(index, nq.fieldFilters);
  let qtoks = [...nq.tokens, ...extra.filter(t => !nq.tokens.includes(t))];
  // concept substitution for out-of-vocabulary study terms (trail records it)
  const conceptTrail = [];
  qtoks = qtoks.flatMap(t => {
    if (!index.vocab.has(t) && CONCEPT[t]) {
      conceptTrail.push(`${t}→${CONCEPT[t].join('+')}`);
      return CONCEPT[t];
    }
    return [t];
  });
  const phrase = qtoks.join(' ');
  const filter = opts.filter;
  const pass = (fn) => {
    const out = [];
    for (const doc of index.docs) {
      if (filter && !filter(doc.rec)) continue;
      if (!fieldGate(doc.rec, gates)) continue;
      const r = fn(doc);
      if (!r) continue;
      out.push({ rec: doc.rec, score: r.score, typos: r.typos, displayTitle: doc.displayTitle, type: doc.type, doc });
    }
    return sortScored(out);
  };
  if (!qtoks.length && !Object.keys(gates).length) {
    const out = [];
    for (const doc of index.docs) {
      if (filter && !filter(doc.rec)) continue;
      if (!fieldGate(doc.rec, gates)) continue;
      out.push({ rec: doc.rec, score: 1, typos: 0, displayTitle: doc.displayTitle, type: doc.type, doc });
    }
    out.sort((a, b) => String(a.displayTitle).localeCompare(String(b.displayTitle)));
    return { results: out, mode: 'exact', corrected: null, dropped: [], related: [...conceptTrail] };
  }
  // mark corpus-stopwords + STOPWORDS as gate-optional (score if present, never veto)
  const gateOptional = new Set([...STOPWORDS]);
  for (const t of qtoks) if (index.corpusStop.has(t)) gateOptional.add(t);
  const intentOf = (toks) => intents(toks);
  // pass 1: exact AND (typos repel via sort key, but exact-only candidates here)
  const flag = (t) => ({ gateOptional: gateOptional.has(t), required: !gateOptional.has(t) });
  const candsExact = qtoks.map(t => ({ tok: t, typos: 0, weight: 1, isPrefix: false, ...flag(t) }));
  let res = pass((doc) => scoreDoc(index, doc, candsExact, phrase, intentOf(qtoks)));
  if (res.length) {
    return { results: res, mode: 'exact', corrected: null, dropped: [], related: [...conceptTrail] };
  }
  // pass 2: full candidate expansion (prefix on last term + fuzzy), still AND-gated
  const candsFull = [];
  qtoks.forEach((t, i) => {
    for (const c of candidatesFor(index, t, i === qtoks.length - 1)) {
      candsFull.push({ ...c, gateOptional: gateOptional.has(t), src: t });
    }
  });
  // group candidates per source term: best candidate wins per term
  const bySrc = new Map();
  for (const c of candsFull) {
    if (!bySrc.has(c.src)) bySrc.set(c.src, []);
    bySrc.get(c.src).push(c);
  }
  res = pass((doc) => {
    let s = 0, hits = 0, typos = 0;
    const matchedPos = [];
    for (const [src, list] of bySrc) {
      let best = null;
      for (const c of list) {
        for (const v of variantsOf(c.tok)) {
          const r = termFieldScore(index, doc, v);
          const w = r.score * c.weight;
          if (w > (best?.score || 0)) best = { score: w, typos: c.typos, tok: v, isPrefix: c.isPrefix };
        }
      }
      if (best && best.score > 0) {
        hits++; s += best.score; typos += best.typos;
        if (doc.titlePos.has(best.tok)) matchedPos.push(doc.titlePos.get(best.tok));
      } else if (!gateOptional.has(src)) {
        return null;
      }
    }
    const need = [...bySrc.keys()].filter(k => !gateOptional.has(k)).length;
    if (hits < need) return null;
    const intent = intentOf(qtoks);
    if (phrase && phrase.includes(' ') && doc.titlePhrase.includes(phrase)) s += 10;
    if (matchedPos.length >= 2) {
      const span = Math.max(...matchedPos) - Math.min(...matchedPos) + 1;
      s += (matchedPos.length / span) * 4;
    }
    if (intent.answers && doc.hasAnswers) s += 4;
    if (intent.paper && doc.isPaper) s += 2;
    if (intent.type && doc.typeSet.has(intent.type === 'doc' ? 'docx' : intent.type)) s += 4;
    if (intent.year && doc.yearSet.has(intent.year)) s += 6;
    s += (doc.rec.confidence || 0.5) * 0.5;
    return { score: s, hits, typos, coverage: 1 };
  });
  if (res.length) {
    let corrected = null;
    const approx = qtoks.map(t => (index.vocab.has(t) || STOPWORDS.has(t)) ? t : (closestToken(index, t) || t));
    if (approx.some((t, i) => t !== qtoks[i])) corrected = approx.join(' ');
    const fuzzy = res.some(r => r.typos > 0);
    return { results: res, mode: fuzzy ? 'fuzzy' : 'exact', corrected: fuzzy ? corrected : null, dropped: [], related: [...conceptTrail] };
  }
  // pass 3: drop lowest-idf required token (Typesense-style), report it
  const required = qtoks.filter(t => !gateOptional.has(t));
  if (required.length > 1) {
    let drop = required[0], dropIdf = Infinity;
    for (const t of required) {
      const id = index.idf(t);
      if (id < dropIdf) { dropIdf = id; drop = t; }
    }
    const kept = qtoks.filter(t => t !== drop);
    const kc = kept.map(t => ({ tok: t, typos: 0, weight: 1, isPrefix: false, ...flag(t) }));
    res = pass((doc) => scoreDoc(index, doc, kc, kept.join(' '), intentOf(kept)));
    if (res.length) return { results: res, mode: 'drop', corrected: null, dropped: [drop], related: [] };
  }
  // pass 3.5: related-concept expansion (needs ≥1 original-term hit)
  if (qtoks.length) {
    const extra = [], usedRel = [];
    for (const t of qtoks) {
      for (const u of relatedTerms(index, t)) {
        if (qtoks.includes(u) || extra.some(e => e.tok === u)) continue;
        extra.push({ tok: u, typos: 0, weight: 0.3, isPrefix: false, gateOptional: true, required: false });
        usedRel.push(u);
      }
    }
    if (extra.length) {
      const kc = [...qtoks.map(t => ({ tok: t, typos: 0, weight: 1, isPrefix: false, ...flag(t) })), ...extra];
      res = pass((doc) => scoreDoc(index, doc, kc, phrase, intentOf(qtoks), { allowPartial: true, minRequired: 1 }));
      if (res.length) return { results: res, mode: 'partial', corrected: null, dropped: [], related: [...conceptTrail, ...[...new Set(usedRel)].slice(0, 6)] };
    }
  }
  // pass 4: coverage-weighted partial (OR)
  if (qtoks.length > 1) {
    const kc = qtoks.map(t => ({ tok: t, typos: 0, weight: 1, isPrefix: false, gateOptional: true, required: true }));
    res = pass((doc) => scoreDoc(index, doc, kc, phrase, intentOf(qtoks), { allowPartial: true, minRequired: 1 }));
    if (res.length) return { results: res, mode: 'partial', corrected: null, dropped: [], related: [...conceptTrail] };
  }
  // pass 5: fuzzy rescue across all terms (single best correction)
  const fixed = qtoks.map(t => (index.vocab.has(t) || STOPWORDS.has(t)) ? t : (closestToken(index, t) || t));
  if (fixed.some((t, i) => t !== qtoks[i])) {
    const kc = fixed.map(t => ({ tok: t, typos: 0, weight: 1, isPrefix: false, ...flag(t) }));
    res = pass((doc) => scoreDoc(index, doc, kc, fixed.join(' '), intentOf(fixed)));
    if (res.length) return { results: res, mode: 'fuzzy', corrected: fixed.join(' '), dropped: [], related: [...conceptTrail] };
    return { results: [], mode: 'none', corrected: fixed.join(' '), dropped: [], related: [...conceptTrail] };
  }
  return { results: [], mode: 'none', corrected: null, dropped: [], related: [...conceptTrail] };
}

// ---- related concepts (co-occurrence) + more-like-this -------------------------
export function relatedTerms(index, tok, k = 3) {
  return (index.cooccur.get(tok) || []).slice(0, k);
}

// TF-IDF cosine more-like-this: top-N docs most similar to the given record id.
export function moreLikeThis(index, id, n = 6) {
  const me = index.docs.find(d => d.rec.id === id);
  if (!me) return [];
  const vec = new Map();
  const add = (toks, w) => {
    const counts = new Map();
    for (const t of toks) counts.set(t, (counts.get(t) || 0) + 1);
    for (const [t, c] of counts) {
      const v = w * index.idf(t) * (1 + Math.log(1 + c));
      vec.set(t, (vec.get(t) || 0) + v);
    }
  };
  add(me.titleToks, 3);
  add([...me.tagMap.keys()], 2);
  add([...me.subjSet], 2);
  let normA = 0;
  for (const v of vec.values()) normA += v * v;
  normA = Math.sqrt(normA) || 1;
  const out = [];
  for (const d of index.docs) {
    if (d.rec.id === id) continue;
    const seen = new Set([...d.titleToks, ...d.tagMap.keys(), ...d.subjSet]);
    let dot = 0, normB = 0;
    for (const t of seen) {
      const w = index.idf(t);
      normB += w * w;
      if (vec.has(t)) dot += vec.get(t) * w;
    }
    const cos = dot / (normA * (Math.sqrt(normB) || 1));
    if (cos > 0) out.push({ doc: d, score: cos });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, n).map(x => ({ rec: x.doc.rec, score: x.score, displayTitle: x.doc.displayTitle, type: x.doc.type }));
}

// prefix match with single-typo tolerance (so "acc" finds "acer")
function prefixHit(label, p) {
  if (label.startsWith(p)) return true;
  const tol = (w) => p.length >= 3 && w.length >= p.length && lev(w.slice(0, p.length), p) <= 1;
  if (tol(label)) return true;
  return label.split(/[-\s]/).some(w => w !== label && (w.startsWith(p) || tol(w)));
}
// ---- suggestions (dataset-derived only) ------------------------------------
export function suggest(index, prefix, limit = 8) {
  const p = String(prefix || '').toLowerCase().trim().split(/\s+/).pop() || '';
  if (p.length < 2) return [];
  const out = [];
  const kindRank = { provider: 0, subject: 1, category: 2, tag: 3 };
  const hits = index.pool
    .filter(e => prefixHit(e.label, p))
    .sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || b.count - a.count)
    .slice(0, limit - 3);
  out.push(...hits.map(e => ({ label: e.label, kind: e.kind, count: e.count })));
  let titleN = 0;
  for (const d of index.docs) {
    if (titleN >= 3 || out.length >= limit) break;
    const w = d.titleToks.find(t => (t.startsWith(p) || (p.length >= 3 && lev(t.slice(0, p.length), p) <= 1)) && t.length > p.length);
    if (w) { out.push({ label: d.displayTitle, kind: 'resource', count: 0 }); titleN++; }
  }
  return out.slice(0, limit);
}

// ---- dataset stats (computed live, never hard-coded) ------------------------
export function computeStats(links) {
  const tagC = new Map(), subj = new Set(), prov = new Set(), cat = new Set();
  let answers = 0, pdfs = 0, files = 0;
  for (const r of links) {
    cat.add(r.category);
    if (r.contentType !== 'folder') files++; else continue;
    if ((r.tags || []).includes('answers')) answers++;
    if (r.contentType === 'pdf') pdfs++;
    for (const t of (r.tags || [])) {
      if (STOP_TAGS.has(t)) continue;
      tagC.set(t, (tagC.get(t) || 0) + 1);
      if (PROVIDERS.includes(t)) prov.add(t);
    }
    for (const s of (r.subjects || [])) subj.add(s);
  }
  return {
    total: links.length, files, folders: links.length - files,
    answers, pdfs,
    subjects: subj.size, providers: prov.size, categories: cat.size,
    topTags: [...tagC.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}
