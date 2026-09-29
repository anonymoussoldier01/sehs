import { sleep } from './store.mjs';
import { log } from './log.mjs';

// Minimal Drive v3 client using API key (public folders). Recurses subfolders.
export async function listDriveChildren(folderId, apiKey, { pageSize = 200 } = {}) {
  const all = [];
  let pageToken = '';
  for (let i = 0; i < 50; i++) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink)');
    let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=${pageSize}&key=${encodeURIComponent(apiKey)}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`network-error: ${e.message}`);
    }
    if (res.status === 403 || res.status === 401) {
      const t = await res.text().catch(() => '');
      throw new Error(`drive-auth-error ${res.status}: ${t.slice(0, 300)}`);
    }
    if (res.status === 404) throw new Error('drive-not-found (private or bad id?)');
    if (res.status === 429) { await sleep(2000); continue; }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`drive-http-${res.status}: ${t.slice(0, 300)}`);
    }
    const j = await res.json();
    if (Array.isArray(j.files)) all.push(...j.files);
    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
  }
  return all;
}

export async function getDriveFileMeta(fileId, apiKey) {
  const fields = encodeURIComponent('id,name,mimeType,modifiedTime,createdTime,size,webViewLink,owners(displayName),parents');
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fields}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`drive-file-${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

export async function expandFolderRecursive(folderId, apiKey, { depth = 0, maxDepth = 8, onFolder = null } = {}) {
  if (depth > maxDepth) return [];
  const children = await listDriveChildren(folderId, apiKey);
  const out = [];
  for (const f of children) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    if (isFolder) {
      if (onFolder) onFolder(f, depth);
      try {
        const sub = await expandFolderRecursive(f.id, apiKey, { depth: depth + 1, maxDepth, onFolder });
        out.push({ ...f, _isFolder: true, _childCount: sub.length });
        out.push(...sub);
      } catch (e) {
        log('warn', `subfolder failed ${f.id} ${f.name}: ${e.message}`);
        out.push({ ...f, _isFolder: true, _error: String(e.message) });
      }
    } else {
      out.push(f);
    }
  }
  return out;
}
