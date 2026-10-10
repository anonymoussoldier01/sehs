// Gemini enrichment -> state/enriched.json (checkpointed, resumable)
// Usage: $env:GEMINI_API_KEY="..."; node scripts/enrich-gemini.mjs [-- --limit=100 --refresh --retry-failed]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readText, readJson, writeJson, stableHash, sleep, nowIso } from './lib/store.mjs';
import { geminiJson, buildEnrichPrompt } from './lib/gemini.mjs';
import { normalizeCategory, normalizeTags, normalizeDate, normalizeUrl, domainOf } from './lib/normalize.mjs';
import { log, setLogFile } from './lib/log.mjs';
import { getEnv } from './lib/env.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
setLogFile(path.join(ROOT, 'logs', `enrich-${Date.now()}.log`));

function args() {
  return Object.fromEntries(process.argv.slice(2).map(s => {
    const m = s.match(/^--([^=]+)(=(.*))?$/);
    return m ? [m[1], m[3] ?? true] : [s, true];
  }));
}

async function main() {
  const a = args();
  const apiKey = getEnv('GEMINI_API_KEY', '');
  if (!apiKey) { console.error('Missing GEMINI_API_KEY. PowerShell: $env:GEMINI_API_KEY="YOUR_KEY"'); process.exit(1); }
  const model = getEnv('GEMINI_MODEL', 'gemini-2.0-flash');
  const conc = Number(getEnv('GEMINI_CONCURRENCY', '3'));
  const limit = a.limit ? Number(a.limit) : Infinity;
  const doRefresh = !!a.refresh;
  const retryFailed = !!a['retry-failed'];

  const urls = readText(path.join(ROOT, 'source-data', 'urls.txt')).split('\n').map(s => s.trim()).filter(Boolean);
  const driveData = readJson(path.join(ROOT, 'source-data', 'drive-files.json'), { records: [] });
  const driveByUrl = new Map((driveData.records || []).map(r => [r.url, r]));
  const fetched = readJson(path.join(ROOT, 'state', 'fetch.json'), { items: {} }).items || {};
  const prev = readJson(path.join(ROOT, 'state', 'enriched.json'), { records: {} });
  const records = prev.records || {};

  const queue = [];
  for (const url of urls) {
    const h = stableHash(url);
    const existing = records[h];
    if (existing && existing.ok && !doRefresh) continue;
    if (existing && !existing.ok && !retryFailed && !doRefresh) continue;
    queue.push(url);
    if (queue.length >= limit) break;
  }
  log('info', `enrich model=${model} queued=${queue.length} total=${urls.length} existing=${Object.keys(records).length}`);

  let ok = 0, fail = 0, geminiFail = 0;
  for (let i = 0; i < queue.length; i += conc) {
    const batch = queue.slice(i, i + conc);
    await Promise.all(batch.map(async (url) => {
      const h = stableHash(url);
      const drive = driveByUrl.get(url) || {};
      const f = fetched[h] || {};
      const norm = normalizeUrl(url) || url;
      const domain = domainOf(norm);
      const prompt = buildEnrichPrompt({ url: norm, driveName: drive.driveName, mimeType: drive.mimeType, fetched: f });
      try {
        const g = await geminiJson({ apiKey, model, prompt });
        const rec = toRecord({ url: norm, drive, fetched: f, g, domain });
        records[h] = { ok: true, record: rec, updatedAt: nowIso() };
        ok++;
      } catch (e) {
        geminiFail++;
        fail++;
        // conservative fallback — never invent, preserve URL
        const rec = fallbackRecord({ url: norm, drive, fetched: f, domain });
        records[h] = { ok: false, record: rec, error: String(e.message).slice(0, 300), updatedAt: nowIso() };
        log('warn', `enrich failed ${url}: ${e.message}`);
      }
    }));
    log('info', `progress ${Math.min(i + conc, queue.length)}/${queue.length} ok=${ok} fail=${fail}`);
    writeJson(path.join(ROOT, 'state', 'enriched.json'), { updatedAt: nowIso(), records });
    await sleep(400);
  }
  writeJson(path.join(ROOT, 'state', 'enriched.json'), { updatedAt: nowIso(), records });
  writeJson(path.join(ROOT, 'logs', 'enrich-summary.json'), { updatedAt: nowIso(), model, queued: queue.length, ok, fail, geminiFail, total: Object.keys(records).length });
  log('info', `enrich DONE ok=${ok} fail=${fail} total=${Object.keys(records).length}`);
}

function toRecord({ url, drive, fetched, g, domain }) {
  const clean = (v, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const title = clean(g.title, 200) || clean(fetched.pageTitle, 200) || clean(fetched.ogTitle, 200) || clean(drive.driveName, 200) || url;
  const description = clean(g.description, 600) || clean(fetched.metaDescription, 600) || clean(fetched.ogDescription, 600) || undefined;
  const category = normalizeCategory(g.category) || 'other';
  // Files-only: folder mime never produces a record (dropped by caller).
  const rec = {
    id: stableHash(url),
    url,
    title,
    description,
    summary: clean(g.summary, 300) || description?.slice(0, 200),
    category,
    subcategory: clean(g.subcategory, 100) || undefined,
    tags: normalizeTags(g.tags),
    subjects: Array.isArray(g.subjects) ? g.subjects.map(s => String(s).slice(0, 60)).filter(Boolean).slice(0, 8) : [],
    contentType: clean(g.contentType, 40) || guessContentType(drive.mimeType, url),
    audience: clean(g.audience, 60) || undefined,
    difficulty: clean(g.difficulty, 30) || undefined,
    technology: clean(g.technology, 60) || (domain.includes('drive.google') ? 'google-drive' : undefined),
    domain,
    siteName: clean(g.siteName, 120) || clean(fetched.ogSiteName, 120) || (domain.includes('drive.google') ? 'Google Drive' : undefined),
    creator: clean(g.creator, 120) || clean(fetched.author, 120) || undefined,
    language: clean(g.language, 10) || clean(fetched.lang, 10) || 'en',
    keywords: normalizeTags(g.keywords),
    image: clean(fetched.ogImage, 500) || undefined,
    favicon: driveFavicon(domain, fetched.favicon),
    source: drive.source || 'supplied-list',
    driveId: drive.driveId || undefined,
    driveName: drive.driveName || undefined,
    status: fetched.status || drive.status || 'unknown',
    metadataSource: g.evidenceLevel === 'explicit' ? 'extracted+gemini' : 'gemini',
    confidence: typeof g.confidence === 'number' ? Math.max(0, Math.min(1, g.confidence)) : 0.6,
    dateModified: normalizeDate(drive.modifiedTime) || normalizeDate(fetched.datePublished) || undefined,
    datePublished: normalizeDate(fetched.datePublished) || undefined,
    lastChecked: new Date().toISOString().slice(0, 10)
  };
  // strip empties
  for (const k of Object.keys(rec)) {
    if (rec[k] === undefined || rec[k] === '' || (Array.isArray(rec[k]) && !rec[k].length)) delete rec[k];
  }
  if (!rec.tags) rec.tags = [];
  if (!rec.keywords) rec.keywords = [];
  return rec;
}

function fallbackRecord({ url, drive, fetched, domain }) {
  // Files-only: folders fall back to 'other' and are dropped upstream.
  const title = (fetched.pageTitle || drive.driveName || url).toString().slice(0, 200);
  return {
    id: stableHash(url), url, title,
    description: fetched.metaDescription || fetched.ogDescription || undefined,
    category: 'other',
    tags: [],
    keywords: [],
    domain,
    siteName: domain.includes('drive.google') ? 'Google Drive' : undefined,
    driveId: drive.driveId || undefined,
    driveName: drive.driveName || undefined,
    status: fetched.status || 'unknown',
    metadataSource: 'fallback',
    confidence: 0.3,
    lastChecked: new Date().toISOString().slice(0, 10)
  };
}

function guessContentType(mime, url) {
  if (!mime) {
    if (/\.(pdf)(\?|$)/i.test(url)) return 'pdf';
    return undefined;
  }
  if (mime.includes('folder')) return undefined;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('document')) return 'docx';
  if (mime.includes('spreadsheet')) return 'spreadsheet';
  if (mime.includes('presentation')) return 'slides';
  if (mime.includes('image')) return 'image';
  if (mime.includes('video')) return 'video';
  return undefined;
}

function driveFavicon(domain, f) {
  if (f) return f;
  if (domain.includes('drive.google')) return 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

main().catch(e => { console.error(e); process.exit(1); });
