// SEHS Study Directory — local relevance search engine (zero dependencies).
// Works in the browser (ES module) and in Node (for tests).
// NEVER mutates the source dataset: builds a derived index, keeps originals.

export const PROVIDERS = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'vssa', 'deepti', 'mornington', 'whitman', 'capricorn'];

// Zero-discrimination metadata: present on (nearly) every record.
const STOP_TAGS = new Set(['google-drive', 'drive-folder']);
// Query filler words dropped before matching (unless the whole query is filler).
const STOPWORDS = new Set(['with', 'from', 'for', 'the', 'a', 'an', 'and', 'of', 'in', 'on', 'to']);
// Tokens that must never be stemmed.
const KEEP = new Set(['maths', 'physics', 'news']);
// Query expansion: common student spellings / concatenations → canonical tokens.
const EXPAND = {
  math: ['maths'],
  practise: ['practice'],
  'practise paper': ['practice', 'paper'],
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

// ---- normalisation -------------------------------------------------------
export function stem(tok) {
  if (KEEP.has(tok) || tok.length <= 3) return tok;
  if (tok.endsWith('ies') && tok.length > 5) return tok.slice(0, -3) + 'y';
  if (tok.endsWith('es') && tok.length > 5) return tok.slice(0, -2);
  if (tok.endsWith('s') && !tok.endsWith('ss')) return tok.slice(0, -1);
  return tok;
}

// Raw text → normalised token list (lowercase, punctuation/extra-space collapsed,
// hyphens+underscores split, stemmed). Used for both index and query.
export function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase()
    .replace(/[~$+*^#@!?;:"'‘’“”()[\]{}<>|\\/=]/g, ' ')
    .replace(/[-_./,]+/g, ' ')
    .replace(/(\d)t(\d)/g, '$1t $2') // 20241004t032630z → separate timestamp chunks
    .split(/[^a-z0-9]+/)
    .filter(t => t && t.length > 0 && !/^\d+$/.test(t) === false ? true : true)
    .map(stem)
    .filter(Boolean);
}

// Joined normalised string for exact-phrase matching.
export function normJoin(text) {
  return tokenize(text).join(' ');
}

// Query text → { tokens, phrase, droppedFillers }. Expansion + stopword removal.
export function normalizeQuery(q) {
  const raw = String(q || '').toLowerCase().trim();
  if (!raw) return { tokens: [], phrase: '', corrected: null };
  const expanded = EXPAND[raw] ? EXPAND[raw].join(' ') : raw;
  let toks = tokenize(expanded);
  // expand single concatenated tokens (practicepaper handled above; generic fallback)
  toks = toks.flatMap(t => EXPAND[t] || [t]);
  const content = toks.filter(t => !STOPWORDS.has(t));
  const tokens = content.length ? content : toks; // don't nuke all-filler queries
  return { tokens, phrase: tokens.join(' ') };
}

// ---- display titles -------------------------------------------------------
// Cleaner card title; original title/driveName/URL always preserved in the record.
export function cleanDisplayName(driveName, title) {
  let t = String(title || driveName || '').trim();
  t = t.replace(/~\$[^\s]*/g, ' ');                   // whole Office temp-file token (~$ replaces leading chars)
  t = t.replace(/^copy of\s+/i, '');                  // Drive "Copy of …"
  t = t.replace(/20\d{6}T\d{6}Z/g, ' ');               // embedded timestamps
  t = t.replace(/^(?:\d+[._\s-]+)+(?=[A-Za-z])/g, '');   // leading sequence numbers ("00 "), never "24th"
  t = t.replace(/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|zip|htm|html|js|css)$/i, '');
  t = t.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*-?\s*0+\d*\s*$/g, '').trim();      // trailing sequence numbers (" 001")
  return t.slice(0, 200) || String(title || driveName || '');
}

// Fallback content type when the record has none (e.g. webpage support files).
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
  if (/^set-/.test(tag)) return 1;                    // set numbers: weak signal
  if (tag === 'answers') return 5;
  if (PROVIDERS.includes(tag)) return 6;
  return 3;
}

export function buildIndex(links) {
  const docs = links.map((rec) => {
    const type = rec.contentType || fallbackType(rec.driveName);
    const titleToks = tokenize(rec.title);
    const titlePos = new Map(); // token → first position (for proximity)
    titleToks.forEach((t, i) => { if (!titlePos.has(t)) titlePos.set(t, i); });
    const tagMap = new Map(); // token → max weight
    for (const tag of (rec.tags || [])) {
      const w = tagWeight(String(tag).toLowerCase());
      if (!w) continue;
      for (const t of tokenize(tag)) {
        if (!tagMap.has(t) || tagMap.get(t) < w) tagMap.set(t, w);
      }
    }
    return {
      rec,
      type,
      displayTitle: cleanDisplayName(rec.driveName, rec.title),
      titleToks, titlePos,
      titlePhrase: titleToks.join(' '),
      tagMap,
      kwSet: new Set(tokenize((rec.keywords || []).join(' '))),
      catSet: new Set(tokenize(rec.category)),
      subSet: new Set(tokenize(rec.subcategory)),
      subjSet: new Set(tokenize((rec.subjects || []).join(' '))),
      descSet: new Set(tokenize(rec.description)),
      summSet: new Set(tokenize(rec.summary)),
      typeSet: new Set(tokenize(type)),
      hasAnswers: (rec.tags || []).includes('answers'),
      isPaper: rec.category === 'practice-test' || rec.category === 'past-paper' ||
        /paper|test|exam|pack|homework|quiz/i.test(rec.title || ''),
    };
  });
  // vocabulary for fuzzy rescue + suggestions
  const vocab = new Set();
  const df = new Map(); // token → doc count (for idf-lite)
  for (const d of docs) {
    const seen = new Set([...d.titleToks, ...d.tagMap.keys(), ...d.kwSet, ...d.catSet, ...d.subSet]);
    for (const t of seen) { vocab.add(t); df.set(t, (df.get(t) || 0) + 1); }
  }
  // suggestion pool: human-readable raw labels with live counts (dataset-derived only)
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
  return { docs, vocab, total: docs.length, pool };
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

function fuzzyLimit(tok) {
  if (tok.length <= 3) return 0;
  if (tok.length <= 6) return 1;
  return 2;
}

// closest vocab token within limit, or null
export function closestToken(index, tok) {
  const lim = fuzzyLimit(tok);
  if (!lim || index.vocab.has(tok)) return null;
  let best = null, bestD = Infinity;
  for (const v of index.vocab) {
    if (Math.abs(v.length - tok.length) > lim) continue;
    if (v[0] !== tok[0] && lim < 2) continue; // cheap prune: same first letter
    const d = lev(tok, v);
    if (d <= lim && d < bestD) { best = v; bestD = d; if (d === 1 && lim === 1) break; }
  }
  return best;
}

// ---- scoring ---------------------------------------------------------------
const W = { title: 8, keyword: 6, tagMax: 6, provider: 7, category: 4, desc: 2, summary: 2, type: 5 };

// intent boosts computed from the raw query tokens
function intents(qtoks) {
  const has = (...ws) => ws.some(w => qtoks.includes(w));
  return {
    answers: has('answer', 'answers', 'solution', 'marking'),
    paper: has('paper', 'papers', 'test', 'tests', 'exam', 'exams', 'practice', 'pack'),
    type: qtoks.find(t => ['pdf', 'docx', 'doc', 'image', 'folder', 'archive', 'zip', 'webpage'].includes(t)) || null,
  };
}

function scoreDoc(doc, qtoks, phrase, intent) {
  let s = 0, hits = 0;
  const matchedPos = [];
  for (const t of qtoks) {
    let tokScore = 0;
    if (doc.titlePos.has(t)) { tokScore = Math.max(tokScore, W.title); matchedPos.push(doc.titlePos.get(t)); }
    if (doc.kwSet.has(t)) tokScore = Math.max(tokScore, W.keyword);
    if (doc.tagMap.has(t)) tokScore = Math.max(tokScore, doc.tagMap.get(t));
    if (doc.subjSet.has(t)) tokScore = Math.max(tokScore, 5);
    if (doc.subSet.has(t)) tokScore = Math.max(tokScore, W.category);
    if (doc.catSet.has(t)) tokScore = Math.max(tokScore, W.category);
    if (doc.descSet.has(t)) tokScore = Math.max(tokScore, W.desc);
    if (doc.summSet.has(t)) tokScore = Math.max(tokScore, W.summary);
    if (doc.typeSet.has(t)) tokScore = Math.max(tokScore, W.type);
    if (tokScore > 0) { hits++; s += tokScore; }
  }
  if (hits < qtoks.length) return { score: -1, hits }; // strict AND gate
  // exact-phrase bonus (order-sensitive, the strongest signal)
  if (phrase && phrase.includes(' ') && doc.titlePhrase.includes(phrase)) s += 25;
  // coverage multiplier: all-terms matched by construction → reward is implicit,
  // proximity bonus for title matches
  if (matchedPos.length >= 2) {
    const span = Math.max(...matchedPos) - Math.min(...matchedPos) + 1;
    s += (matchedPos.length / span) * 4;
  }
  // intent boosts
  if (intent.answers && doc.hasAnswers) s += 6;
  if (intent.paper && doc.isPaper) s += 3;
  if (intent.type && doc.typeSet.has(intent.type === 'doc' ? 'docx' : intent.type)) s += 6;
  // mild quality prior from ingestion confidence (keeps ranking stable on ties)
  s += (doc.rec.confidence || 0.5) * 0.5;
  return { score: s, hits };
}

// partial (OR) path: coverage-weighted so all-term matches still dominate
function scorePartial(doc, qtoks, phrase, intent) {
  let s = 0, hits = 0;
  const matchedPos = [];
  for (const t of qtoks) {
    let tokScore = 0;
    if (doc.titlePos.has(t)) { tokScore = W.title; matchedPos.push(doc.titlePos.get(t)); }
    else if (doc.tagMap.has(t)) tokScore = doc.tagMap.get(t);
    else if (doc.kwSet.has(t)) tokScore = W.keyword;
    else if (doc.subjSet.has(t)) tokScore = 5;
    else if (doc.subSet.has(t) || doc.catSet.has(t)) tokScore = W.category;
    else if (doc.descSet.has(t)) tokScore = W.desc;
    else if (doc.summSet.has(t)) tokScore = W.summary;
    else if (doc.typeSet.has(t)) tokScore = W.type;
    if (tokScore > 0) { hits++; s += tokScore; }
  }
  if (!hits) return { score: -1, hits: 0 };
  s *= (0.35 + 0.65 * (hits / qtoks.length)); // coverage weight
  if (phrase && phrase.includes(' ') && doc.titlePhrase.includes(phrase)) s += 20;
  if (matchedPos.length >= 2) {
    const span = Math.max(...matchedPos) - Math.min(...matchedPos) + 1;
    s += (matchedPos.length / span) * 3;
  }
  if (intent.answers && doc.hasAnswers) s += 5;
  if (intent.paper && doc.isPaper) s += 2;
  return { score: s, hits };
}

function sortScored(out) {
  out.sort((a, b) => b.score - a.score || String(a.doc.displayTitle).localeCompare(String(b.doc.displayTitle)));
  return out;
}

// Main entry: { results: [{rec, score, displayTitle, type}], mode, corrected }
// mode: 'exact' | 'partial' | 'fuzzy' | 'none'
export function search(index, query, opts = {}) {
  const { tokens: qtoks, phrase } = normalizeQuery(query);
  const intent = intents(qtoks);
  const pass = (fn) => {
    const out = [];
    for (const doc of index.docs) {
      if (opts.filter && !opts.filter(doc.rec)) continue;
      const { score: s } = fn(doc, qtoks, phrase, intent);
      if (s < 0) continue;
      out.push({ rec: doc.rec, score: s, displayTitle: doc.displayTitle, type: doc.type, doc });
    }
    return sortScored(out);
  };
  if (!qtoks.length) {
    const out = [];
    for (const doc of index.docs) {
      if (opts.filter && !opts.filter(doc.rec)) continue;
      out.push({ rec: doc.rec, score: 1, displayTitle: doc.displayTitle, type: doc.type, doc });
    }
    out.sort((a, b) => String(a.displayTitle).localeCompare(String(b.displayTitle)));
    return { results: out, mode: 'exact', corrected: null };
  }
  let res = pass(scoreDoc);
  if (res.length) return { results: res, mode: 'exact', corrected: null };
  // partial fallback (multi-term only)
  if (qtoks.length > 1) {
    res = pass(scorePartial);
    if (res.length) return { results: res, mode: 'partial', corrected: null };
  }
  // fuzzy rescue: substitute closest vocab tokens (conservative, one pass)
  const fixed = qtoks.map(t => {
    if (index.vocab.has(t) || STOPWORDS.has(t)) return t;
    return closestToken(index, t) || t;
  });
  const changed = fixed.some((t, i) => t !== qtoks[i]);
  if (changed) {
    const fIntent = intents(fixed);
    const fPhrase = fixed.join(' ');
    const out = [];
    for (const doc of index.docs) {
      if (opts.filter && !opts.filter(doc.rec)) continue;
      const { score: s } = scorePartial(doc, fixed, fPhrase, fIntent);
      if (s < 0) continue;
      out.push({ rec: doc.rec, score: s, displayTitle: doc.displayTitle, type: doc.type, doc });
    }
    if (out.length) {
      return { results: sortScored(out), mode: 'fuzzy', corrected: fixed.join(' ') };
    }
    return { results: [], mode: 'none', corrected: fixed.join(' ') };
  }
  return { results: [], mode: 'none', corrected: null };
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
  // title completions: resources with a word starting with prefix
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
