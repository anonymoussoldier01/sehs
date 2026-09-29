// URL parsing / normalization / controlled vocabularies
export function extractDriveIds(raw) {
  const ids = [];
  const folderRe = /folders\/([A-Za-z0-9-_]{10,})/g;
  const fileRe = /\/file\/d\/([A-Za-z0-9-_]{10,})/g;
  const idParamRe = /[?&](?:id|ids)=([A-Za-z0-9-_]{10,})/g;
  let m;
  while ((m = folderRe.exec(raw))) ids.push({ id: m[1], kind: 'folder', raw });
  while ((m = fileRe.exec(raw))) ids.push({ id: m[1], kind: 'file', raw });
  while ((m = idParamRe.exec(raw))) ids.push({ id: m[1], kind: 'unknown', raw });
  // google.com/search?q=...drive... edge: try to find embedded folder id
  if (/google\.com\/search/i.test(raw)) {
    const inner = /([A-Za-z0-9-_]{25,})/g;
    let m2;
    while ((m2 = inner.exec(raw))) {
      if (!ids.some(x => x.id === m2[1])) ids.push({ id: m2[1], kind: 'maybe-folder', raw, note: 'extracted-from-search-url-needs-verification' });
    }
  }
  return ids;
}

export function normalizeUrl(u) {
  try {
    const url = new URL(u.trim());
    url.hash = '';
    // lower host, remove trailing slash (except root), remove utm params
    url.hostname = url.hostname.toLowerCase();
    for (const k of [...url.searchParams.keys()]) {
      if (/^utm_|^hsmi$|^gclid$|^fbclid$/i.test(k)) url.searchParams.delete(k);
    }
    let s = url.toString();
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

export function isValidUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

export function domainOf(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
}

export const CATEGORY_VOCAB = [
  'exam-prep', 'maths', 'english', 'reading', 'writing', 'verbal-reasoning',
  'quantitative', 'past-paper', 'practice-test', 'study-guide', 'reference',
  'tutorial', 'tool', 'document', 'folder', 'other'
];

export function normalizeCategory(c) {
  if (!c) return undefined;
  const s = String(c).toLowerCase().trim().replace(/[\s_]+/g, '-');
  if (CATEGORY_VOCAB.includes(s)) return s;
  // map common Gemini variants
  const map = {
    'math': 'maths', 'mathematics': 'maths', 'quant': 'quantitative',
    'verbal': 'verbal-reasoning', 'comprehension': 'reading',
    'test': 'practice-test', 'tests': 'practice-test', 'exams': 'exam-prep',
    'exam': 'exam-prep', 'guide': 'study-guide', 'docs': 'document',
    'drive-folder': 'folder', 'google-drive': 'folder'
  };
  return map[s] || (CATEGORY_VOCAB.includes(s) ? s : 'other');
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  const seen = new Set();
  for (let t of tags) {
    if (typeof t !== 'string') continue;
    t = t.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40);
    if (!t || t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

export function normalizeDate(d) {
  if (!d) return undefined;
  const s = String(d).trim();
  if (!s) return undefined;
  // accept YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString().slice(0, 10);
}
