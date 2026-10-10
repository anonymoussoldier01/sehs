// Expands Drive folders -> source-data/drive-files.json + source-data/urls.txt
// Usage: $env:GEMINI_API_KEY="..."; npm run expand [-- --refresh]
// Never logs secret keys.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDriveIds, normalizeUrl } from './lib/normalize.mjs';
import { expandFolderRecursive, getDriveFileMeta, listDriveChildren } from './lib/drive.mjs';
import { readText, writeJson, writeText, readJson, nowIso, sleep } from './lib/store.mjs';
import { log, setLogFile } from './lib/log.mjs';
import { getEnv } from './lib/env.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const FOLDERS_TXT = path.join(ROOT, 'source-data', 'drive-folders.txt');
const OUT_FILES = path.join(ROOT, 'source-data', 'drive-files.json');
const OUT_URLS = path.join(ROOT, 'source-data', 'urls.txt');
const LOG = path.join(ROOT, 'logs', `expand-${Date.now()}.log`);

setLogFile(LOG);

function parseArgs() {
  const a = Object.fromEntries(process.argv.slice(2).map(s => {
    const m = s.match(/^--([^=]+)(=(.*))?$/);
    return m ? [m[1], m[3] ?? true] : [s, true];
  }));
  return a;
}

async function main() {
  const args = parseArgs();
  const apiKey = getEnv('DRIVE_API_KEY', '') || getEnv('GEMINI_API_KEY', '');
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY (or DRIVE_API_KEY). PowerShell: $env:GEMINI_API_KEY="YOUR_KEY"; npm run expand');
    process.exit(1);
  }
  const rawLines = readText(FOLDERS_TXT).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  log('info', `inputs: ${rawLines.length} lines`);

  const targets = [];
  const invalid = [];
  for (const line of rawLines) {
    const ids = extractDriveIds(line);
    if (!ids.length) invalid.push({ raw: line, reason: 'no-drive-id-found' });
    else for (const x of ids) targets.push({ ...x, source: line });
  }
  // dedupe ids
  const seen = new Map();
  for (const t of targets) {
    if (!seen.has(t.id)) seen.set(t.id, t);
  }
  const uniq = [...seen.values()];
  log('info', `unique drive ids: ${uniq.length}`, { invalid: invalid.length });

  const records = []; // files-only: folder placeholders are never emitted
  const stats = { folders: 0, files: 0, failed: [], empty: [], skippedFolders: 0 };

  for (const t of uniq) {
    log('info', `expanding ${t.kind} ${t.id} from ${t.source.slice(0, 80)}`);
    try {
      if (t.kind === 'file') {
        const meta = await getDriveFileMeta(t.id, apiKey);
        records.push(toRecord(meta, t));
        stats.files++;
      } else {
        // list + recurse
        let children;
        try {
          children = await expandFolderRecursive(t.id, apiKey, {
            onFolder: (f, d) => log('info', `${'  '.repeat(d)}folder: ${f.name} (${f.id})`)
          });
        } catch (e) {
          stats.failed.push({ id: t.id, error: String(e.message).slice(0, 300), source: t.source });
          log('warn', `folder ${t.id} failed: ${e.message}`);
          // Files-only: do NOT preserve unexpanded folders as records.
          // Queue for retry instead (state/folders-retry.json).
          try {
            const fs = await import('node:fs');
            const retryPath = path.join(ROOT, 'state', 'folders-retry.json');
            let cur = [];
            try { cur = JSON.parse(fs.readFileSync(retryPath, 'utf8')); } catch { cur = []; }
            if (!cur.find(x => x.id === t.id)) cur.push({ id: t.id, source: t.source, error: String(e.message).slice(0, 300), at: new Date().toISOString() });
            fs.mkdirSync(path.dirname(retryPath), { recursive: true });
            fs.writeFileSync(retryPath, JSON.stringify(cur, null, 2));
          } catch { /* retry queue best-effort */ }
          continue;
        }
        stats.folders++;
        // Files-only: skip folder placeholder itself, keep children only.
        if (!children.length) stats.empty.push(t.id);
        for (const c of children) {
          if (c._isFolder) {
            // Nested folder: count but do not emit (its children were already
            // recursed into expandFolderRecursive output as files).
            stats.skippedFolders++;
          } else {
            records.push(toRecord(c, t));
            stats.files++;
          }
        }
      }
      await sleep(300);
    } catch (e) {
      stats.failed.push({ id: t.id, error: String(e.message).slice(0, 300), source: t.source });
      log('warn', `id ${t.id} failed: ${e.message}`);
    }
  }

  // dedupe by driveId then url
  const byId = new Map();
  for (const r of records) {
    if (!byId.has(r.driveId)) byId.set(r.driveId, r);
  }
  const deduped = [...byId.values()];
  const urls = deduped.map(r => r.url).filter(Boolean);
  const normSeen = new Set(); const finalUrls = [];
  for (const u of urls) {
    const n = normalizeUrl(u) || u;
    if (normSeen.has(n)) continue;
    normSeen.add(n);
    finalUrls.push(n);
  }

  writeJson(OUT_FILES, { generatedAt: nowIso(), inputs: rawLines.length, uniqueIds: uniq.length, totalRecords: deduped.length, invalidInputs: invalid, stats, records: deduped });
  writeText(OUT_URLS, finalUrls.join('\n') + '\n');
  writeJson(path.join(ROOT, 'logs', 'expand-summary.json'), { generatedAt: nowIso(), inputs: rawLines.length, uniqueIds: uniq.length, totalRecords: deduped.length, files: stats.files, folders: stats.folders, failed: stats.failed.length, empty: stats.empty, invalidInputs: invalid.length });
  log('info', `DONE records=${deduped.length} files=${stats.files} folders=${stats.folders} failed=${stats.failed.length} invalid=${invalid.length}`);
  log('info', `wrote ${OUT_FILES} and ${OUT_URLS}`);
  if (!deduped.length) process.exitCode = 2;
}

function toRecord(f, t) {
  const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
  return {
    driveId: f.id,
    driveName: f.name || '',
    mimeType: f.mimeType || '',
    size: f.size || undefined,
    modifiedTime: f.modifiedTime || undefined,
    url: isFolder ? `https://drive.google.com/drive/folders/${f.id}` : `https://drive.google.com/file/d/${f.id}/view`,
    webViewLink: f.webViewLink || undefined,
    source: t.source,
    parentHint: t.id,
    status: 'unknown'
  };
}

main().catch(e => { console.error('expand failed:', e.message); process.exit(1); });
