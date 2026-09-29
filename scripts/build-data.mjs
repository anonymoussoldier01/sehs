// Builds data/links.json + data/categories.json from state/enriched.json
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, nowIso } from './lib/store.mjs';
import { log, setLogFile } from './lib/log.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
setLogFile(path.join(ROOT, 'logs', `build-${Date.now()}.log`));

async function main() {
  const enriched = readJson(path.join(ROOT, 'state', 'enriched.json'), { records: {} });
  const recs = Object.values(enriched.records || {}).map(x => x.record).filter(Boolean);
  // sort: folders last? keep title sort for determinism
  recs.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  writeJson(path.join(ROOT, 'data', 'links.json'), recs);

  const count = (fn) => {
    const m = new Map();
    for (const r of recs) for (const v of fn(r)) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  };
  const cats = {
    generatedAt: nowIso(),
    total: recs.length,
    categories: count(r => r.category ? [r.category] : []),
    tags: count(r => r.tags || []).slice(0, 200),
    domains: count(r => r.domain ? [r.domain] : []),
    contentTypes: count(r => r.contentType ? [r.contentType] : []),
    statuses: count(r => r.status ? [r.status] : [])
  };
  writeJson(path.join(ROOT, 'data', 'categories.json'), cats);
  // also emit a JS embed for zero-fetch usage if desired
  log('info', `build DONE links=${recs.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
