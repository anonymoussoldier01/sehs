// Validates data/links.json — duplicates, URLs, schema. Exits non-zero on errors.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './lib/store.mjs';
import { isValidUrl } from './lib/normalize.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');

const links = readJson(path.join(ROOT, 'data', 'links.json'), null);
if (!Array.isArray(links)) { console.error('data/links.json missing or not an array. Run npm run ingest first.'); process.exit(1); }

const errors = [], warnings = [];
const seenUrl = new Map(), seenId = new Map();
links.forEach((r, i) => {
  const ctx = `#${i} id=${r.id || '?'} url=${r.url || '?'}`;
  if (!r.id) errors.push(`${ctx} missing id`);
  if (!r.url || !isValidUrl(r.url)) errors.push(`${ctx} invalid url`);
  if (!r.title) warnings.push(`${ctx} missing title`);
  if (!r.title && !r.description) warnings.push(`${ctx} title+description both empty`);
  if (seenUrl.has(r.url)) errors.push(`${ctx} duplicate url of #${seenUrl.get(r.url)}`);
  else seenUrl.set(r.url, i);
  if (r.id) {
    if (seenId.has(r.id)) errors.push(`${ctx} duplicate id of #${seenId.get(r.id)}`);
    else seenId.set(r.id, i);
  }
  if (r.confidence !== undefined && (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1)) errors.push(`${ctx} bad confidence`);
  for (const d of ['datePublished', 'dateModified', 'lastChecked']) {
    if (r[d] && !/^\d{4}-\d{2}-\d{2}/.test(r[d])) warnings.push(`${ctx} malformed ${d}=${r[d]}`);
  }
  if (r.status && !['active', 'redirected', 'unavailable', 'timeout', 'blocked', 'unknown'].includes(r.status)) errors.push(`${ctx} bad status ${r.status}`);
  for (const k of ['title', 'description', 'siteName', 'creator']) {
    if (typeof r[k] === 'string' && /^(unknown|n\/a|none|tbd)$/i.test(r[k].trim())) warnings.push(`${ctx} placeholder ${k}="${r[k]}"`);
  }
});

console.log(`validate: total=${links.length} errors=${errors.length} warnings=${warnings.length}`);
warnings.slice(0, 50).forEach(w => console.log('WARN', w));
errors.slice(0, 100).forEach(e => console.log('ERROR', e));
if (errors.length) process.exit(2);
console.log('validate OK');
