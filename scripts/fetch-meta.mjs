// Fetches HTTP metadata for urls.txt -> state/fetch.json (checkpointed)
// Usage: npm run fetch [-- --limit=200 --refresh]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readText, readJson, writeJson } from './lib/store.mjs';
import { fetchPageMeta } from './lib/http.mjs';
import { log, setLogFile } from './lib/log.mjs';
import { getEnv } from './lib/env.mjs';
import { stableHash } from './lib/store.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
setLogFile(path.join(ROOT, 'logs', `fetch-${Date.now()}.log`));

function args() {
  return Object.fromEntries(process.argv.slice(2).map(s => {
    const m = s.match(/^--([^=]+)(=(.*))?$/);
    return m ? [m[1], m[3] ?? true] : [s, true];
  }));
}

async function main() {
  const a = args();
  const limit = a.limit ? Number(a.limit) : Infinity;
  const refresh = !!a.refresh;
  const timeoutMs = Number(getEnv('HTTP_TIMEOUT_MS', '15000'));
  const urls = readText(path.join(ROOT, 'source-data', 'urls.txt')).split('\n').map(s => s.trim()).filter(Boolean);
  const driveData = readJson(path.join(ROOT, 'source-data', 'drive-files.json'), { records: [] });
  const driveByUrl = new Map((driveData.records || []).map(r => [r.url, r]));
  const prev = readJson(path.join(ROOT, 'state', 'fetch.json'), { items: {} });
  const items = prev.items || {};
  let done = 0, skipped = 0, failed = 0;
  const conc = 5;
  const queue = urls.filter(u => {
    if (refresh) return true;
    const h = stableHash(u);
    return !items[h] || items[h].status === 'unknown';
  }).slice(0, limit);
  log('info', `fetch: total=${urls.length} queued=${queue.length} cached=${Object.keys(items).length}`);

  // Drive file URLs: Google blocks scraping; synthesize from Drive record, mark unknown reachability
  async function handleOne(url) {
    const h = stableHash(url);
    const drive = driveByUrl.get(url);
    if (drive && /drive\.google\.com\/file\/d\//.test(url)) {
      items[h] = {
        url, status: 'unknown', httpStatus: 0,
        pageTitle: drive.driveName || undefined,
        driveName: drive.driveName, mimeType: drive.mimeType,
        dateModified: drive.modifiedTime ? drive.modifiedTime.slice(0, 10) : undefined,
        note: 'drive-file: metadata from Drive API; page scrape skipped (Google blocks bots)',
        updatedAt: new Date().toISOString()
      };
      return 'cached-drive';
    }
    if (drive && /drive\.google\.com\/drive\/folders\//.test(url)) {
      items[h] = {
        url, status: 'active', httpStatus: 200,
        pageTitle: drive.driveName && !drive.driveName.startsWith('(folder') ? drive.driveName : `Drive folder ${drive.driveId}`,
        driveName: drive.driveName, mimeType: drive.mimeType,
        note: 'drive-folder placeholder',
        updatedAt: new Date().toISOString()
      };
      return 'cached-folder';
    }
    try {
      const r = await fetchPageMeta(url, { timeoutMs });
      items[h] = { ...r, updatedAt: new Date().toISOString() };
      return r.status;
    } catch (e) {
      failed++;
      items[h] = { url, status: 'unknown', error: String(e.message).slice(0, 200), updatedAt: new Date().toISOString() };
      return 'error';
    }
  }

  for (let i = 0; i < queue.length; i += conc) {
    const batch = queue.slice(i, i + conc);
    const res = await Promise.all(batch.map(handleOne));
    done += batch.length;
    if (done % 50 === 0 || done === queue.length) {
      log('info', `progress ${done}/${queue.length}`);
      writeJson(path.join(ROOT, 'state', 'fetch.json'), { updatedAt: new Date().toISOString(), items });
    }
  }
  writeJson(path.join(ROOT, 'state', 'fetch.json'), { updatedAt: new Date().toISOString(), items });
  log('info', `fetch DONE queued=${queue.length} cached-items=${Object.keys(items).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
