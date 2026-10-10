// Local heuristic enrichment — NO API key needed. Grounded ONLY in Drive metadata.
// Produces state/enriched.json in the same shape as enrich-gemini.mjs so build-data works.
// Gemini can later refine via: $env:GEMINI_API_KEY="..."; node scripts/enrich-gemini.mjs --refresh
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readText, readJson, writeJson, stableHash, nowIso } from './lib/store.mjs';
import { normalizeUrl, domainOf, normalizeTags } from './lib/normalize.mjs';
import { log, setLogFile } from './lib/log.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
setLogFile(path.join(ROOT, 'logs', `local-${Date.now()}.log`));

const PROVIDERS = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'deepti', 'mornington', 'whitman', 'capricorn', 'vssa', 'native'];
const SUBJECT_RULES = [
  { re: /numeric(al)?[\s_\-]*reason/i, subject: 'numerical-reasoning', category: 'quantitative' },
  { re: /quantitative|QR\b/i, subject: 'quantitative', category: 'quantitative' },
  { re: /verbal[\s_\-]*reason/i, subject: 'verbal-reasoning', category: 'verbal-reasoning' },
  { re: /reading|comprehension/i, subject: 'reading-comprehension', category: 'reading' },
  { re: /written[\s_\-]*expression|SW\b|writing/i, subject: 'written-expression', category: 'writing' },
  { re: /\bmaths?\b|mathematics/i, subject: 'mathematics', category: 'maths' },
  { re: /science/i, subject: 'science', category: 'reference' },
  { re: /english/i, subject: 'english', category: 'english' },
];

function classify(name, mime, url) {
  const lower = (name || '').toLowerCase();
  const tags = new Set();
  const subjects = [];
  let category = 'other';
  let subcategory;
  let contentType;
  const ext = (name.split('.').pop() || '').toLowerCase();

  // contentType from mime/ext — explicit
  if (/folder/.test(mime)) contentType = 'folder';
  else if (/pdf/.test(mime) || ext === 'pdf') contentType = 'pdf';
  else if (/word|docx|document/.test(mime) || ext === 'docx' || ext === 'doc') contentType = 'docx';
  else if (/spreadsheet|xls/.test(mime)) contentType = 'spreadsheet';
  else if (/presentation|pptx/.test(mime)) contentType = 'slides';
  else if (/image|png|jpg|jpeg|gif/.test(mime) || ['png', 'jpg', 'jpeg', 'gif'].includes(ext)) contentType = 'image';
  else if (/zip/.test(mime) || ext === 'zip') contentType = 'archive';
  else if (/video|mp4/.test(mime)) contentType = 'video';
  else if (/html/.test(mime) || ext === 'htm' || ext === 'html') contentType = 'webpage';

  // subjects — explicit from filename
  for (const r of SUBJECT_RULES) {
    if (r.re.test(name)) {
      subjects.push(r.subject);
      tags.add(r.subject);
      if (category === 'other') category = r.category;
    }
  }

  // providers — explicit
  const providersFound = [];
  for (const p of PROVIDERS) {
    if (lower.includes(p)) { providersFound.push(p); tags.add(p); }
  }
  // named schools/exams
  if (/sehs|selective/i.test(name)) { tags.add('sehs'); tags.add('selective-entry'); }
  if (/\bjmss\b|john monash/i.test(name)) { tags.add('jmss'); }
  if (/\bvsse\b|\bvssa\b/i.test(name)) { tags.add('vsse'); }
  if (/tt8|year[\s_\-]*8|yr[\s_\-]*8/.test(name)) { tags.add('year-8'); }
  if (/edukingdom/i.test(name)) { tags.add('edukingdom'); }

  // answers vs paper — explicit
  const isAnswers = /answer|marking|solution/i.test(name);
  const isPaper = /paper|test|exam|pack|homework|set|quiz|practice/i.test(name);
  if (isAnswers) { tags.add('answers'); subcategory = subcategory || 'answers'; }
  if (/homework/i.test(name)) { tags.add('homework'); subcategory = subcategory || 'homework'; }
  if (/practice[\s_\-]*exam[\s_\-]*pack/i.test(name)) { category = 'practice-test'; tags.add('practice-exam-pack'); }
  else if (isPaper && category === 'other' && contentType !== 'folder' && contentType !== 'image') category = 'practice-test';
  // Files-only: folders never become a category (dropped upstream).

  // set/paper numbers — explicit
  const setM = name.match(/set[\s_\-]*(\d+)/i) || name.match(/\bW(\d{1,2})\b/) || name.match(/test[\s_\-]*(\d+)/i) || name.match(/paper[\s_\-]*(\d*)/i);
  if (setM) tags.add(`set-${setM[1].toLowerCase()}`);

  // past-paper vs practice
  if (/past[\s_\-]*paper/i.test(name)) { category = 'past-paper'; tags.add('past-paper'); }

  // audience
  let audience = 'students';
  if (/year[\s_\-]*8|yr[\s_\-]*8|tt8|sehs|jmss|selective/i.test(name)) audience = 'selective-entry-students-year-8';

  return { tags: [...tags], subjects, category, subcategory, contentType, audience, providersFound, isAnswers };
}

function cleanTitle(driveName, url) {
  let t = (driveName || '').trim();
  if (!t || /^\((folder|unexpanded)/.test(t)) {
    const m = url.match(/\/(folders|file\/d)\/([A-Za-z0-9-_]+)/);
    return `Drive ${m ? m[1].replace('file/d', 'file') : 'item'} ${m ? m[2].slice(0, 8) : ''}`.trim();
  }
  // strip extension for display, replace underscores, collapse
  t = t.replace(/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|zip|htm|html|js|css)$/i, '');
  t = t.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.slice(0, 200);
}

async function main() {
  const driveData = readJson(path.join(ROOT, 'source-data', 'drive-files.json'), { records: [] });
  const fetched = readJson(path.join(ROOT, 'state', 'fetch.json'), { items: {} }).items || {};
  const prevGemini = readJson(path.join(ROOT, 'state', 'enriched.json'), { records: {} }).records || {};
  // preserve any successful gemini records
  const geminiOk = new Map();
  for (const [h, v] of Object.entries(prevGemini)) if (v && v.ok && v.record && v.record.metadataSource !== 'fallback') geminiOk.set(h, v);

  const records = {};
  let n = 0, skippedFolders = 0;
  for (const d of driveData.records || []) {
    // Files-only: drop any folder record that slipped through (legacy data).
    if ((d.mimeType || '').includes('folder') || (d.url || '').includes('/drive/folders/')) { skippedFolders++; continue; }
    const url = d.url;
    const h = stableHash(url);
    if (geminiOk.has(h)) { records[h] = geminiOk.get(h); continue; }
    const norm = normalizeUrl(url) || url;
    const domain = domainOf(norm);
    const f = fetched[h] || {};
    const name = d.driveName || f.pageTitle || '';
    const c = classify(name, d.mimeType || '', norm);
    const title = cleanTitle(name, norm);
    const isFolder = (d.mimeType || '').includes('folder');
    const descParts = [];
    if (c.providersFound.length) descParts.push(`Provider: ${c.providersFound.join(', ')}`);
    if (c.subjects.length) descParts.push(`Subject: ${c.subjects.join(', ')}`);
    if (c.isAnswers) descParts.push('Includes answers/solutions');
    else if (/\.pdf|\.docx/i.test(name)) descParts.push('Practice material');
    if (isFolder) descParts.push(`Drive folder${d.childCount ? ` with ~${d.childCount} files` : ''}`);
    const description = descParts.length ? `${title}. ${descParts.join('. ')}.` : `${title}. Shared via Google Drive.`;
    const rec = {
      id: h,
      url: norm,
      title,
      description: description.slice(0, 600),
      summary: (c.subjects.length ? `${c.subjects.join(', ')}` : 'study material') + (c.providersFound.length ? ` · ${c.providersFound.join(', ')}` : '') + (c.isAnswers ? ' · answers' : ''),
      category: c.category,
      subcategory: c.subcategory || (isFolder ? undefined : (c.providersFound[0] || undefined)),
      tags: normalizeTags([...c.tags, ...(isFolder ? ['drive-folder'] : ['google-drive'])]),
      subjects: c.subjects,
      contentType: c.contentType,
      audience: c.audience,
      difficulty: undefined,
      technology: 'google-drive',
      domain,
      siteName: 'Google Drive',
      language: 'en',
      keywords: normalizeTags([...c.subjects, ...c.providersFound]),
      driveId: d.driveId || undefined,
      driveName: d.driveName || undefined,
      source: d.source || 'supplied-list',
      status: 'active',
      metadataSource: 'extracted+heuristic',
      confidence: c.subjects.length || c.providersFound.length ? 0.75 : 0.55,
      dateModified: d.modifiedTime ? d.modifiedTime.slice(0, 10) : undefined,
      lastChecked: new Date().toISOString().slice(0, 10)
    };
    for (const k of Object.keys(rec)) {
      if (rec[k] === undefined || rec[k] === '' || (Array.isArray(rec[k]) && !rec[k].length)) delete rec[k];
    }
    if (!rec.tags) rec.tags = [];
    if (!rec.keywords) rec.keywords = [];
    records[h] = { ok: true, record: rec, updatedAt: nowIso() };
    n++;
  }
  writeJson(path.join(ROOT, 'state', 'enriched.json'), { updatedAt: nowIso(), records, note: 'local-heuristic; run enrich-gemini --refresh after enabling Generative Language API to add AI summaries' });
  log('info', `local enrich DONE records=${n} preservedGemini=${geminiOk.size}`);
}

main().catch(e => { console.error(e); process.exit(1); });
