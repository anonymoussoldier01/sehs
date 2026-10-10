// SEHS Study Directory — static frontend (ES module). Local dataset only, no API calls.
import { PROVIDERS, buildIndex, search, suggest, normalizeQuery, computeStats } from './search.js';

const state = {
  links: [], cats: null, index: null, stats: null,
  q: '', catsSel: new Set(), typesSel: new Set(), provSel: new Set(), audSel: new Set(),
  answersOnly: false, hideImg: false, hideCode: false,
  sort: 'relevance', perPage: 24, page: 1, view: localStorage.getItem('sehs-view') || 'grid',
  last: { results: [], mode: 'exact', corrected: null }, selIdx: -1,
};
const $ = (id) => document.getElementById(id);
const els = {};
['q', 'clear', 'suggest', 'stats', 'stat-showing', 'mode-note', 'stat-meta', 'grid', 'skeleton',
 'empty', 'empty-title', 'empty-msg', 'did-you-mean', 'empty-chips', 'empty-cats', 'empty-reset',
 'pager-top', 'pager-bottom', 'facet-cat', 'facet-provider', 'facet-type', 'facet-aud',
 'f-answers', 'f-hide-img', 'f-hide-code', 'f-sort', 'f-per', 'reset', 'active-chips',
 'discovery', 'view-grid', 'view-list', 'filters', 'filters-toggle', 'filter-count', 'filter-count-2',
 'theme-toggle', 'modal', 'modal-body', 'modal-x', 'toast', 'copy-link', 'export-csv',
 'brand-home', 'about-text'].forEach(id => els[id] = $(id));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmt = (n) => Number(n).toLocaleString();
const pretty = (s) => String(s).split(/[-\s]/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
// Tags worth showing on cards (hide infrastructure noise).
const HIDE_TAGS = new Set(['google-drive', 'drive-folder']);
const isSetTag = (t) => /^set-/.test(t);
function displayTags(rec, max = 5) {
  return (rec.tags || []).filter(t => !HIDE_TAGS.has(t) && !isSetTag(t)).slice(0, max);
}

function toast(msg) {
  els['toast'].textContent = msg;
  els['toast'].hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els['toast'].hidden = true, 2200);
}

/* ---------- theme ---------- */
function initTheme() {
  const saved = localStorage.getItem('sehs-theme');
  const dark = saved ? saved === 'dark' : true;
  document.documentElement.dataset.theme = dark ? 'dark' : '';
  els['theme-toggle'].setAttribute('aria-pressed', String(dark));
}
els['theme-toggle'].onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : '';
  localStorage.setItem('sehs-theme', dark ? 'dark' : 'light');
  els['theme-toggle'].setAttribute('aria-pressed', String(dark));
};

/* ---------- load ---------- */
function skeleton(on) {
  els['skeleton'].hidden = !on;
  els['skeleton'].innerHTML = on
    ? Array.from({ length: 8 }, () => '<div class="sk"><i style="height:16px;width:60%"></i><i style="height:12px;width:90%;margin-top:10px"></i><i style="height:12px;width:75%;margin-top:8px"></i></div>').join('')
    : '';
}

async function load() {
  skeleton(true);
  const [links, cats] = await Promise.all([
    fetch('data/links.json').then(r => { if (!r.ok) throw new Error('links'); return r.json(); }),
    fetch('data/categories.json').then(r => r.json()).catch(() => null),
  ]);
  state.links = Array.isArray(links) ? links : [];
  state.cats = cats;
  const t0 = performance.now();
  state.index = buildIndex(state.links);
  state.stats = computeStats(state.links);
  window.__sehsIndexMs = performance.now() - t0;
  renderStats();
  buildFacets();
  readStateFromURL();
  syncControls();
  applyView();
  skeleton(false);
  doSearch();
}

function renderStats() {
  const s = state.stats;
  const items = [
    [fmt(s.total), 'Resources', ''],
    [s.subjects, 'Subjects', ''],
    [s.providers, 'Providers', ''],
    [fmt(s.answers), 'With answers', ''],
    [fmt(s.pdfs), 'PDFs', ''],
  ];
  els['stats'].innerHTML = items.map(([n, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(n)}</dd></div>`).join('');
  els['stat-meta'].textContent = state.cats?.generatedAt ? `dataset updated ${state.cats.generatedAt.slice(0, 10)}` : '';
}

/* ---------- facets ---------- */
function liveCount(fn) {
  let n = 0;
  for (const l of state.links) if (fn(l)) n++;
  return n;
}

function buildFacets() {
  const catVals = state.cats?.categories?.map(c => c.value) ||
    [...new Set(state.links.map(l => l.category).filter(Boolean))];
  els['facet-cat'].innerHTML = catVals.map(v =>
    `<label class="check-row"><input type="checkbox" data-facet="cat" value="${esc(v)}"><span>${esc(pretty(v))}</span><span class="c">${fmt(liveCount(l => l.category === v))}</span></label>`).join('');
  const tagC = new Map((state.cats?.tags || []).map(t => [t.value, t.count]));
  const provs = PROVIDERS.map(p => ({ v: p, c: tagC.get(p) || liveCount(l => (l.tags || []).includes(p)) })).filter(p => p.c > 0);
  els['facet-provider'].innerHTML = provs.map(({ v, c }) =>
    `<label class="check-row"><input type="checkbox" data-facet="prov" value="${esc(v)}"><span>${esc(pretty(v))}</span><span class="c">${fmt(c)}</span></label>`).join('');
  const typeC = new Map();
  for (const d of state.index.docs) typeC.set(d.type, (typeC.get(d.type) || 0) + 1);
  const typeName = { pdf: 'PDF', docx: 'Word', image: 'Image', folder: 'Folder', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'Other' };
  els['facet-type'].innerHTML = [...typeC.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) =>
    `<label class="check-row"><input type="checkbox" data-facet="type" value="${esc(v)}"><span>${esc(typeName[v] || v)}</span><span class="c">${fmt(c)}</span></label>`).join('');
  const audC = new Map();
  for (const l of state.links) audC.set(l.audience || 'general', (audC.get(l.audience || 'general') || 0) + 1);
  const audName = { 'students': 'General', 'selective-entry-students-year-8': 'Selective entry · Year 8' };
  els['facet-aud'].innerHTML = [...audC.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) =>
    `<label class="check-row"><input type="checkbox" data-facet="aud" value="${esc(v)}"><span>${esc(audName[v] || pretty(v))}</span><span class="c">${fmt(c)}</span></label>`).join('');
  document.querySelectorAll('[data-facet]').forEach(cb => cb.addEventListener('change', () => {
    const set = { cat: state.catsSel, type: state.typesSel, prov: state.provSel, aud: state.audSel }[cb.dataset.facet];
    cb.checked ? set.add(cb.value) : set.delete(cb.value);
    state.page = 1; doSearch(); writeHash();
  }));
}

/* ---------- search ---------- */
function activeFilterCount() {
  return state.catsSel.size + state.typesSel.size + state.provSel.size + state.audSel.size +
    (state.answersOnly ? 1 : 0) + (state.hideImg ? 1 : 0) + (state.hideCode ? 1 : 0);
}
function hasActive() {
  return state.q.trim() !== '' || activeFilterCount() > 0;
}

function filterFn() {
  const { catsSel, typesSel, provSel, audSel, answersOnly, hideImg, hideCode } = state;
  const idxTypes = state.index ? new Map(state.index.docs.map(d => [d.rec.id, d.type])) : new Map();
  return (rec) => {
    if (catsSel.size && !catsSel.has(rec.category)) return false;
    if (typesSel.size && !typesSel.has(idxTypes.get(rec.id) || rec.contentType)) return false;
    if (provSel.size && !(rec.tags || []).some(t => provSel.has(t))) return false;
    if (audSel.size && !audSel.has(rec.audience || 'general')) return false;
    if (answersOnly && !(rec.tags || []).includes('answers')) return false;
    const t = idxTypes.get(rec.id) || rec.contentType;
    if (hideImg && t === 'image') return false;
    if (hideCode && (t === 'code' || t === 'webpage')) return false;
    return true;
  };
}

function doSearch() {
  const t0 = performance.now();
  state.last = search(state.index, state.q, { filter: filterFn() });
  window.__sehsSearchMs = performance.now() - t0;
  state.page = Math.min(state.page, Math.max(1, Math.ceil(state.last.results.length / state.perPage)));
  render();
}

function sortedResults() {
  const arr = [...state.last.results];
  if (state.sort === 'title-az') arr.sort((a, b) => String(a.displayTitle).localeCompare(String(b.displayTitle)));
  else if (state.sort === 'title-za') arr.sort((a, b) => String(b.displayTitle).localeCompare(String(a.displayTitle)));
  else if (state.sort === 'newest') arr.sort((a, b) => String(b.rec.dateModified || '').localeCompare(String(a.rec.dateModified || '')) || b.score - a.score);
  else if (state.sort === 'type') arr.sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.displayTitle).localeCompare(String(b.displayTitle)));
  else if (state.sort === 'answers') arr.sort((a, b) => (((b.rec.tags || []).includes('answers')) - ((a.rec.tags || []).includes('answers'))) || b.score - a.score);
  return arr;
}

/* ---------- highlight ---------- */
function highlightTokens() {
  const raw = state.q.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const { tokens } = normalizeQuery(state.q);
  return [...new Set([...raw, ...tokens])].filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
}
function highlight(text, tokens) {
  let out = esc(text);
  for (const t of tokens) {
    try {
      out = out.replace(new RegExp(`(${escReg(t)}\\w*)`, 'gi'), '<mark>$1</mark>');
    } catch { /* ignore bad patterns */ }
  }
  return out;
}

/* ---------- cards ---------- */
const FILE_CLASS = { pdf: 'fi-pdf', docx: 'fi-docx', image: 'fi-image', folder: 'fi-folder', archive: 'fi-archive', webpage: 'fi-webpage', code: 'fi-code', other: 'fi-other' };
const FILE_ABBR = { pdf: 'PDF', docx: 'DOC', image: 'IMG', folder: 'DIR', archive: 'ZIP', webpage: 'WEB', code: 'CODE', other: 'FILE' };
const TYPE_LABEL = { pdf: 'PDF', docx: 'Word', image: 'Image', folder: 'Folder', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'File' };

function metaBadges(r, type) {
  const hasAns = (r.tags || []).includes('answers');
  const prov = (r.tags || []).find(t => PROVIDERS.includes(t));
  return `${r.category ? `<span class="badge cat">${esc(pretty(r.category))}</span>` : ''}
    ${prov ? `<span class="badge prov">${esc(pretty(prov))}</span>` : ''}
    <span class="badge">${esc(TYPE_LABEL[type] || type || '')}</span>
    ${hasAns ? `<span class="badge ans">Answers included</span>` : ''}
    ${r.status && r.status !== 'active' ? `<span class="badge st-${esc(r.status)}">● ${esc(r.status)}</span>` : ''}`;
}

function card(x, tokens) {
  const { rec: r, displayTitle, type } = x;
  const tags = displayTags(r).map(t => `<button class="tag" data-tag="${esc(t)}">${esc(pretty(t))}</button>`).join('');
  return `<article class="card" data-id="${esc(r.id)}">
    <div class="file-ico ${FILE_CLASS[type] || 'fi-other'}" aria-hidden="true">${esc(FILE_ABBR[type] || 'FILE')}</div>
    <div class="card-body">
      <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${highlight(displayTitle, tokens)}</a></h3>
      ${r.description ? `<p class="desc">${highlight(r.description, tokens)}</p>` : ''}
      <div class="meta-row">${metaBadges(r, type)}</div>
      ${tags ? `<div class="meta-row tagrow">${tags}</div>` : ''}
      <div class="card-foot">
        <span class="date">${r.dateModified ? `Updated ${esc(r.dateModified)}` : ''}</span>
        <span><button class="btn small secondary" data-details="${esc(r.id)}">Details</button>
        <a class="btn small" href="${esc(r.url)}" target="_blank" rel="noopener">Open resource →</a></span>
      </div>
    </div>
  </article>`;
}

/* ---------- discovery (empty query, no filters) ---------- */
function topSubjects(limit = 6) {
  const m = new Map();
  for (const l of state.links) for (const s of (l.subjects || [])) m.set(s, (m.get(s) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
function topProviders(limit = 8) {
  const tagC = new Map((state.cats?.tags || []).map(t => [t.value, t.count]));
  return PROVIDERS.map(p => [p, tagC.get(p) || 0]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function renderDiscovery() {
  const get = (fn, n) => {
    const out = [];
    for (const d of state.index.docs) {
      if (!fn(d.rec)) continue;
      out.push({ rec: d.rec, score: 1, displayTitle: d.displayTitle, type: d.type, doc: d });
      if (out.length >= n * 3) break;
    }
    out.sort((a, b) => String(a.displayTitle).localeCompare(String(b.displayTitle)));
    return out.slice(0, n);
  };
  const tokens = [];
  const practice = get(r => r.category === 'practice-test', 6);
  const answers = get(r => (r.tags || []).includes('answers'), 6);
  const subjects = topSubjects(6).map(([s, c]) => ({
    title: pretty(s), count: c, items: get(r => (r.subjects || []).includes(s), 4), key: 'subject', val: s,
  }));
  const providers = topProviders(8).map(([p, c]) => ({
    title: pretty(p), count: c, items: get(r => (r.tags || []).includes(p), 4), key: 'provider', val: p,
  }));
  const section = (title, countLabel, items, viewKey, viewVal) => `
    <section class="disc-section">
      <div class="disc-head"><h2>${esc(title)} <small>${esc(countLabel)}</small></h2>
      <button class="link-btn" data-viewall="${esc(viewKey)}:${esc(viewVal)}">View all →</button></div>
      <div class="disc-grid">${items.map(x => card(x, tokens)).join('')}</div>
    </section>`;
  els['discovery'].innerHTML =
    section('Practice tests', `${fmt(liveCount(l => l.category === 'practice-test'))} resources`, practice, 'cat', 'practice-test') +
    section('Resources with answers', `${fmt(state.stats.answers)} resources`, answers, 'answers', '1') +
    `<section class="disc-section"><div class="disc-head"><h2>By subject</h2></div>
      <div class="disc-sub">${subjects.map(s => `<div class="disc-tile"><h3>${esc(s.title)}</h3><p>${fmt(s.count)} resources</p><div class="disc-grid" style="grid-template-columns:1fr">${s.items.slice(0, 2).map(x => card(x, tokens)).join('')}</div><button class="link-btn" data-viewall="subject:${esc(s.val)}">View all ${esc(s.title)} →</button></div>`).join('')}</div></section>` +
    `<section class="disc-section"><div class="disc-head"><h2>By provider</h2></div>
      <div class="disc-sub">${providers.map(s => `<div class="disc-tile"><h3>${esc(s.title)}</h3><p>${fmt(s.count)} resources</p><button class="link-btn" data-viewall="provider:${esc(s.val)}">View all ${esc(s.title)} →</button></div>`).join('')}</div></section>`;
  els['discovery'].hidden = false;
  els['grid'].innerHTML = '';
  els['grid'].style.display = 'none';
  els['pager-top'].innerHTML = '';
  els['pager-bottom'].innerHTML = '';
  els['stat-showing'].textContent = 'Browse resources';
  els['mode-note'].hidden = true;
  chips();
}

/* ---------- results render ---------- */
function pager(total) {
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  if (state.page > pages) state.page = pages;
  for (const mount of ['pager-top', 'pager-bottom']) {
    const el = els[mount];
    el.innerHTML = '';
    if (total === 0) continue;
    const btn = (label, p, opts = {}) => {
      const b = document.createElement('button');
      b.innerHTML = label;
      if (opts.cur) b.classList.add('cur');
      if (opts.dis) b.disabled = true;
      b.setAttribute('aria-label', opts.aria || `Page ${p}`);
      if (opts.cur) b.setAttribute('aria-current', 'page');
      b.onclick = () => { state.page = p; render(); writeHash(); document.getElementById('main').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      el.appendChild(b);
    };
    btn('← Previous', Math.max(1, state.page - 1), { dis: state.page <= 1, aria: 'Previous page' });
    const win = new Set([1, state.page - 1, state.page, state.page + 1, pages]);
    const sorted = [...win].filter(p => p >= 1 && p <= pages).sort((a, b) => a - b);
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) { const d = document.createElement('span'); d.className = 'dots'; d.textContent = '…'; el.appendChild(d); }
      btn(String(p), p, { cur: p === state.page });
      prev = p;
    }
    btn('Next →', Math.min(pages, state.page + 1), { dis: state.page >= pages, aria: 'Next page' });
    const s = document.createElement('span');
    s.className = 'showing';
    s.textContent = `Showing ${fmt((state.page - 1) * state.perPage + 1)}–${fmt(Math.min(total, state.page * state.perPage))} of ${fmt(total)}`;
    el.appendChild(s);
  }
  return pages;
}

function chips() {
  const c = [];
  if (state.q.trim()) c.push({ k: 'q', label: `“${state.q.trim()}”` });
  state.catsSel.forEach(v => c.push({ k: 'cat', v, label: pretty(v) }));
  state.typesSel.forEach(v => c.push({ k: 'type', v, label: TYPE_LABEL[v] || v }));
  state.provSel.forEach(v => c.push({ k: 'prov', v, label: pretty(v) }));
  state.audSel.forEach(v => c.push({ k: 'aud', v, label: v === 'general' ? 'General' : pretty(v.replace('selective-entry-', '')) }));
  if (state.answersOnly) c.push({ k: 'answersOnly', label: 'Answers included' });
  if (state.hideImg) c.push({ k: 'hideImg', label: 'Hide images' });
  if (state.hideCode) c.push({ k: 'hideCode', label: 'Hide support files' });
  els['active-chips'].innerHTML = c.map((x, i) => `<span class="pill-x">${esc(x.label)}<button data-chip="${i}" aria-label="Remove filter ${esc(x.label)}">✕</button></span>`).join('');
  els['active-chips'].querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
    const x = c[Number(b.dataset.chip)];
    if (x.k === 'q') { state.q = ''; els['q'].value = ''; els['clear'].hidden = true; }
    if (x.k === 'cat') state.catsSel.delete(x.v);
    if (x.k === 'type') state.typesSel.delete(x.v);
    if (x.k === 'prov') state.provSel.delete(x.v);
    if (x.k === 'aud') state.audSel.delete(x.v);
    if (x.k === 'answersOnly') { state.answersOnly = false; els['f-answers'].checked = false; }
    if (x.k === 'hideImg') { state.hideImg = false; els['f-hide-img'].checked = false; }
    if (x.k === 'hideCode') { state.hideCode = false; els['f-hide-code'].checked = false; }
    syncChecks(); state.page = 1; doSearch(); writeHash();
  });
  const n = activeFilterCount();
  for (const id of ['filter-count', 'filter-count-2']) {
    els[id].hidden = n === 0;
    els[id].textContent = n;
  }
}

function render() {
  if (!hasActive()) { renderDiscovery(); return; }
  els['discovery'].innerHTML = '';
  els['discovery'].hidden = true;
  const arr = sortedResults();
  const total = arr.length;
  const pages = pager(total);
  const slice = arr.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  const tokens = highlightTokens();
  els['grid'].className = state.view === 'list' ? 'grid list' : 'grid';
  els['grid'].style.display = '';
  els['grid'].innerHTML = slice.map(x => card(x, tokens)).join('');
  els['empty'].hidden = total !== 0;
  if (total === 0) renderEmpty();
  els['stat-showing'].textContent = total === 0 ? 'No results' :
    `${fmt(total)} resource${total === 1 ? '' : 's'} found${state.q.trim() ? ` for “${state.q.trim()}”` : ''}`;
  const mn = els['mode-note'];
  const { mode, corrected } = state.last;
  if (total > 0 && (mode === 'partial' || mode === 'fuzzy')) {
    mn.hidden = false;
    mn.innerHTML = mode === 'fuzzy' && corrected
      ? `Showing results for “${esc(corrected)}”. `
      : `No exact matches — showing closest matches. `;
  } else {
    mn.hidden = true;
    mn.innerHTML = '';
  }
  chips();
}

const QUICK = [['vsse', 'VSSE'], ['maths answers', 'Maths + answers'], ['numerical reasoning', 'Numerical'], ['reading comprehension', 'Reading'], ['capricorn practice paper', 'Capricorn papers']];

function renderEmpty() {
  els['grid'].innerHTML = '';
  els['empty-title'].textContent = 'No exact matches';
  els['empty-msg'].textContent = state.q.trim()
    ? `Nothing matched “${state.q.trim()}” with the current filters. Try a broader search or one of these:`
    : 'Nothing matched the current filters.';
  const dym = els['did-you-mean'];
  if (state.last.corrected) {
    dym.hidden = false;
    dym.innerHTML = `Did you mean: <button id="dym-apply">“${esc(state.last.corrected)}”</button>?`;
    $('dym-apply').onclick = () => {
      state.q = state.last.corrected; els['q'].value = state.q; els['clear'].hidden = false;
      state.page = 1; doSearch(); writeHash();
      document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
    };
  } else {
    dym.hidden = true;
    dym.innerHTML = '';
  }
  els['empty-chips'].innerHTML = QUICK.map(([q, label]) => `<button class="quick-chip" data-q="${esc(q)}">${esc(label)}</button>`).join('');
  const topCats = (state.cats?.categories || []).filter(c => c.value !== 'other').slice(0, 4);
  els['empty-cats'].innerHTML = topCats.map(c => `<button class="quick-chip" data-viewall="cat:${esc(c.value)}">${esc(pretty(c.value))}</button>`).join('');
}

/* ---------- autocomplete ---------- */
function renderSuggest() {
  const val = els['q'].value;
  const last = val.split(/\s+/).pop() || '';
  if (last.length < 2 || document.activeElement !== els['q']) { hideSuggest(); return; }
  const items = suggest(state.index, last, 8);
  if (!items.length) { hideSuggest(); return; }
  state.suggItems = items;
  state.selIdx = -1;
  els['suggest'].innerHTML = items.map((s, i) =>
    `<button class="sugg" role="option" data-sugg="${i}" aria-selected="false">
      <span class="k">${esc(s.kind)}</span><span class="lbl">${esc(pretty(s.label))}</span>
      ${s.count ? `<span class="c">${fmt(s.count)}</span>` : ''}</button>`).join('');
  els['suggest'].hidden = false;
  els['q'].setAttribute('aria-expanded', 'true');
  els['suggest'].querySelectorAll('[data-sugg]').forEach(b => {
    b.addEventListener('mousedown', (e) => { e.preventDefault(); applySugg(Number(b.dataset.sugg)); });
  });
}
function hideSuggest() {
  els['suggest'].hidden = true;
  els['q'].setAttribute('aria-expanded', 'false');
  state.selIdx = -1;
}
function applySugg(i) {
  const s = (state.suggItems || [])[i];
  hideSuggest();
  if (!s) return;
  if (s.kind === 'resource') {
    const doc = state.index.docs.find(d => d.displayTitle === s.label);
    if (doc) { openModal(doc.rec.id); return; }
  }
  const parts = els['q'].value.split(/\s+/);
  parts[parts.length - 1] = s.label;
  els['q'].value = parts.join(' ') + ' ';
  state.q = els['q'].value.trim();
  els['clear'].hidden = false;
  state.page = 1; doSearch(); writeHash();
}

/* ---------- modal ---------- */
function openModal(id) {
  const d = state.index.docs.find(x => x.rec.id === id);
  if (!d) return;
  const l = d.rec;
  const rows = [
    ['Description', l.description || l.summary || '—'],
    ['Category', pretty(l.category || '—') + (l.subcategory ? ` · ${pretty(l.subcategory)}` : '')],
    ['Subjects', ((l.subjects || []).map(pretty).join(', ') || '—')],
    ['Tags', (displayTags(l, 12).map(pretty).join(', ') || '—')],
    ['File type', TYPE_LABEL[d.type] || d.type || '—'],
    ['Audience', l.audience === 'selective-entry-students-year-8' ? 'Selective entry · Year 8' : (l.audience || '—')],
    ['Drive file', l.driveName || l.driveId || '—'],
    ['Updated', l.dateModified || '—'],
    ['Checked', l.lastChecked || '—'],
  ].filter(([, v]) => v && v !== '—').map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  els['modal-body'].innerHTML = `<h2 id="m-title">${esc(d.displayTitle)}</h2>
    <div class="meta-row">${metaBadges(l, d.type)}</div>
    <dl class="kv">${rows}</dl>
    <div class="actions">
      <a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">Open in Google Drive →</a>
      <button class="btn secondary" id="m-copy">Copy link</button>
    </div>`;
  els['modal'].hidden = false;
  document.body.style.overflow = 'hidden';
  $('m-copy').onclick = async () => { await navigator.clipboard.writeText(l.url).catch(() => {}); toast('Link copied'); };
  els['modal-x'].focus();
}
function closeModal() { els['modal'].hidden = true; document.body.style.overflow = ''; }

/* ---------- URL state ---------- */
function readParams() {
  const fromSearch = new URLSearchParams(location.search);
  const fromHash = new URLSearchParams((location.hash || '').replace(/^#\/?/, ''));
  const get = (k) => fromSearch.get(k) || fromHash.get(k);
  return {
    q: get('q') || '', cat: get('cat') || get('category') || '', type: get('type') || '',
    prov: get('prov') || get('provider') || '', sort: get('sort') || '', page: get('page') || '',
  };
}
function readStateFromURL() {
  try {
    const p = readParams();
    if (p.q) { state.q = p.q; els['q'].value = p.q; els['clear'].hidden = false; }
    if (p.cat) p.cat.split(',').forEach(v => state.catsSel.add(v));
    if (p.type) p.type.split(',').forEach(v => state.typesSel.add(v));
    if (p.prov) p.prov.split(',').forEach(v => state.provSel.add(v));
    if (p.sort) { state.sort = p.sort; els['f-sort'].value = p.sort; }
    if (p.page) state.page = Math.max(1, Number(p.page) || 1);
  } catch { /* ignore malformed URLs */ }
}
function writeHash() {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set('q', state.q.trim());
  if (state.catsSel.size) p.set('cat', [...state.catsSel].join(','));
  if (state.typesSel.size) p.set('type', [...state.typesSel].join(','));
  if (state.provSel.size) p.set('prov', [...state.provSel].join(','));
  if (state.sort !== 'relevance') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', state.page);
  try {
    history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname + location.search);
  } catch { /* file:// or restricted context */ }
}
function syncControls() {
  els['f-sort'].value = state.sort;
  syncChecks();
}
function syncChecks() {
  document.querySelectorAll('[data-facet="cat"]').forEach(cb => cb.checked = state.catsSel.has(cb.value));
  document.querySelectorAll('[data-facet="type"]').forEach(cb => cb.checked = state.typesSel.has(cb.value));
  document.querySelectorAll('[data-facet="prov"]').forEach(cb => cb.checked = state.provSel.has(cb.value));
  document.querySelectorAll('[data-facet="aud"]').forEach(cb => cb.checked = state.audSel.has(cb.value));
}
function applyView() {
  const list = state.view === 'list';
  els['view-list'].classList.toggle('is-on', list);
  els['view-grid'].classList.toggle('is-on', !list);
  els['view-list'].setAttribute('aria-pressed', String(list));
  els['view-grid'].setAttribute('aria-pressed', String(!list));
}

/* ---------- events ---------- */
function resetAll() {
  Object.assign(state, { q: '', answersOnly: false, hideImg: false, hideCode: false, sort: 'relevance', page: 1 });
  state.catsSel.clear(); state.typesSel.clear(); state.provSel.clear(); state.audSel.clear();
  els['q'].value = ''; els['clear'].hidden = true;
  els['f-answers'].checked = false; els['f-hide-img'].checked = false; els['f-hide-code'].checked = false;
  els['f-sort'].value = 'relevance';
  syncChecks(); doSearch(); writeHash();
}

function bind() {
  const onType = debounce(() => {
    state.q = els['q'].value;
    els['clear'].hidden = !state.q;
    state.page = 1; doSearch(); writeHash();
  }, 120);
  els['q'].addEventListener('input', () => { onType(); renderSuggest(); });
  els['q'].addEventListener('focus', renderSuggest);
  els['q'].addEventListener('blur', () => setTimeout(hideSuggest, 120));
  els['q'].addEventListener('keydown', (e) => {
    const items = state.suggItems || [];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      state.selIdx = e.key === 'ArrowDown'
        ? (state.selIdx + 1) % items.length
        : (state.selIdx - 1 + items.length) % items.length;
      els['suggest'].querySelectorAll('.sugg').forEach((b, i) => {
        b.classList.toggle('sel', i === state.selIdx);
        b.setAttribute('aria-selected', String(i === state.selIdx));
      });
    } else if (e.key === 'Enter' && state.selIdx >= 0 && items[state.selIdx]) {
      e.preventDefault();
      applySugg(state.selIdx);
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  });
  els['clear'].onclick = () => { els['q'].value = ''; state.q = ''; els['clear'].hidden = true; hideSuggest(); state.page = 1; doSearch(); writeHash(); els['q'].focus(); };

  els['f-answers'].onchange = e => { state.answersOnly = e.target.checked; state.page = 1; doSearch(); writeHash(); };
  els['f-hide-img'].onchange = e => { state.hideImg = e.target.checked; state.page = 1; doSearch(); writeHash(); };
  els['f-hide-code'].onchange = e => { state.hideCode = e.target.checked; state.page = 1; doSearch(); writeHash(); };
  els['f-sort'].onchange = e => { state.sort = e.target.value; state.page = 1; render(); writeHash(); };
  els['f-per'].onchange = e => { state.perPage = Number(e.target.value); state.page = 1; render(); };
  els['reset'].onclick = resetAll;
  els['empty-reset'].onclick = resetAll;
  els['brand-home'].onclick = (e) => { e.preventDefault(); resetAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  document.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', (e) => {
    const nav = a.dataset.nav;
    if (nav === 'about') return; // native anchor scroll
    e.preventDefault();
    if (nav === 'discovery' && hasActive()) resetAll();
    document.getElementById(nav === 'discovery' ? 'discovery' : 'main').scrollIntoView({ behavior: 'smooth' });
  }));

  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) {
      els['q'].value = q.dataset.q; state.q = q.dataset.q; els['clear'].hidden = false;
      state.page = 1; doSearch(); writeHash();
      document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const t = e.target.closest('[data-tag]');
    if (t) {
      const v = t.dataset.tag;
      els['q'].value = v; state.q = v; els['clear'].hidden = false;
      state.page = 1; doSearch(); writeHash();
      return;
    }
    const v = e.target.closest('[data-viewall]');
    if (v) {
      const [k, val] = v.dataset.viewall.split(/:(.+)/);
      resetAllSilent();
      if (k === 'cat') state.catsSel.add(val);
      else if (k === 'provider') state.provSel.add(val);
      else if (k === 'subject') { els['q'].value = val; state.q = val; }
      else if (k === 'answers') state.answersOnly = true;
      syncControls(); state.page = 1; doSearch(); writeHash();
      document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const d = e.target.closest('[data-details]');
    if (d) { openModal(d.dataset.details); return; }
  });

  els['view-grid'].onclick = () => { state.view = 'grid'; localStorage.setItem('sehs-view', 'grid'); applyView(); render(); };
  els['view-list'].onclick = () => { state.view = 'list'; localStorage.setItem('sehs-view', 'list'); applyView(); render(); };
  els['filters-toggle'].onclick = () => {
    const open = els['filters'].classList.toggle('open');
    els['filters-toggle'].setAttribute('aria-expanded', String(open));
  };
  els['modal-x'].onclick = closeModal;
  els['modal'].addEventListener('click', (e) => { if (e.target === els['modal']) closeModal(); });

  els['copy-link'].onclick = async () => {
    writeHash();
    await navigator.clipboard.writeText(location.href).catch(() => {});
    toast('Share link copied');
  };
  els['export-csv'].onclick = () => {
    const rows = sortedResults().map(x => ({ title: x.displayTitle, url: x.rec.url, category: x.rec.category, type: x.type, tags: (x.rec.tags || []).join('|'), modified: x.rec.dateModified || '' }));
    const csv = 'title,url,category,type,tags,modified\n' + rows.map(r => [r.title, r.url, r.category, r.type, r.tags, r.modified].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'sehs-directory.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`Exported ${fmt(rows.length)} rows`);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== els['q'] && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      e.preventDefault(); els['q'].focus();
      document.querySelector('.hero').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (e.key === 'Escape') { closeModal(); els['filters'].classList.remove('open'); }
  });
}

function resetAllSilent() {
  Object.assign(state, { q: '', answersOnly: false, hideImg: false, hideCode: false, sort: 'relevance', page: 1 });
  state.catsSel.clear(); state.typesSel.clear(); state.provSel.clear(); state.audSel.clear();
  els['q'].value = ''; els['clear'].hidden = true;
  els['f-answers'].checked = false; els['f-hide-img'].checked = false; els['f-hide-code'].checked = false;
  els['f-sort'].value = 'relevance';
}

initTheme();
bind();
load().catch(() => {
  skeleton(false);
  els['stat-showing'].textContent = 'Couldn’t load the dataset';
  els['empty'].hidden = false;
  els['empty-title'].textContent = 'Dataset failed to load';
  els['empty-msg'].textContent = 'data/links.json could not be fetched. Run npm run ingest:local, then reload. If you opened index.html directly, serve the folder instead: npm run serve.';
});
