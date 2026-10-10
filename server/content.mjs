// Content layer: DB rows → search index + strict public serializers.
// Members-only rows are EXCLUDED before search/serialize for anonymous roles.
import { buildIndex } from '../search.js';

const PROVIDER_ORDER = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'vssa', 'deepti', 'mornington', 'whitman', 'capricorn'];

export function toRec(row) {
  const tags = JSON.parse(row.tags || '[]');
  return {
    id: row.public_id,
    title: row.title,
    description: row.description || '',
    summary: row.description || '',
    category: row.category || 'other',
    subcategory: '',
    tags,
    keywords: tags,
    subjects: row.subject ? [row.subject] : [],
    contentType: row.file_type || 'other',
    confidence: 0.6,
    dateModified: row.year ? `${row.year}-06-01` : undefined,
    // internal-only (never serialized):
    _access: row.access_level,
    _visible: !!row.visibility,
    _status: row.status,
    _audience: row.audience || '',
    _year: row.year || '',
    _provider: row.provider || '',
  };
}

// Public view: allowlisted fields ONLY. No urls, no ids except public_id, no sources.
export function publicView(row) {
  const tags = JSON.parse(row.tags || '[]');
  return {
    id: row.public_id,
    title: row.title,
    description: row.description || '',
    subject: row.subject || '',
    category: row.category || 'other',
    provider: row.provider || '',
    fileType: row.file_type || 'other',
    year: row.year || '',
    tags: tags.filter(t => t !== 'google-drive' && t !== 'drive-folder' && !/^set-/.test(t)).slice(0, 12),
    answersIncluded: !!row.answers_included,
    audience: row.audience || '',
    sizeBytes: row.size_bytes ?? null,
    status: row.status,
    featured: !!row.featured,
    lastVerifiedAt: row.last_verified_at || null,
  };
}

export function visibleWhere() {
  // Files-only: Drive folder placeholders are never public. Only the admin
  // visibility flag + non-folder rows are visible. Children of folders were
  // expanded at ingest time, so hiding folders loses no content.
  return `visibility = 1 AND file_type != 'folder' AND category != 'folder'`;
}

export function loadRows(db) {
  return db.prepare(`SELECT * FROM resources WHERE ${visibleWhere()}`).all();
}

export function buildIndexes(db) {
  const recs = db.prepare(`SELECT * FROM resources WHERE ${visibleWhere()}`).all().map(toRec);
  const index = buildIndex(recs);
  return { anon: index, authed: index };
}

export function forRole(indexes) {
  return indexes.anon;
}

export function fmtBytes(n) {
  if (n == null || n === '') return '';
  n = Number(n);
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export { PROVIDER_ORDER };
