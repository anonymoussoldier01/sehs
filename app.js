// SEHS Study Directory — static frontend. Local dataset only, no API calls.
const PROVIDERS = ['acer', 'edutest', 'jac', 'spectrum', 'hendersons', 'edukingdom', 'pearson', 'vsse', 'vssa', 'deepti', 'mornington', 'whitman', 'capricorn'];
const QUICK = [['vsse', 'VSSE'], ['maths answers', 'Maths + answers'], ['numerical reasoning', 'Numerical'], ['reading comprehension', 'Reading'], ['written expression', 'Writing'], ['science', 'Science'], ['practice exam pack', 'Exam packs']];

const state = { links: [], cats: null, q: '', catsSel: new Set(), typesSel: new Set(), provSel: new Set(), tag: '', status: '', answersOnly: false, hideImg: false, sort: 'relevance', perPage: 24, page: 1, view: 'grid' };
const $ = (id) => document.getElementById(id);
const els = {};
['q', 'clear', 'stat-total', 'stat-showing', 'stat-meta', 'grid', 'skeleton', 'empty', 'empty-msg', 'empty-chips', 'empty-reset', 'empty-browse', 'pager-top', 'pager-bottom', 'facet-cat', 'facet-type', 'facet-provider', 'tag-cloud', 'quick-chips', 'f-tag', 'f-status', 'f-answers', 'f-hide-img', 'f-sort', 'f-per', 'reset', 'active-chips', 'hero-stats', 'hero-count', 'st-files', 'st-folders', 'st-answers', 'st-pdf', 'cnt-cat', 'view-grid', 'view-list', 'filters', 'filters-toggle', 'theme-toggle', 'modal', 'modal-body', 'modal-x', 'toast', 'copy-link', 'export-csv', 'brand-home'].forEach(id => els[id] = $(id));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmt = (n) => Number(n).toLocaleString();

function toast(msg) {
  els['toast'].textContent = msg;
  els['toast'].hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els['toast'].hidden = true, 2200);
}

/* ---------- theme ---------- */
function initTheme() {
  const saved = localStorage.getItem('sehs-theme');
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
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
  if (on) els['skeleton'].innerHTML = Array.from({ length: 8 }, () => '<div class="sk"><i style="height:16px;width:60%"></i><i style="height:12px;width:90%;margin-top:10px"></i><i style="height:12px;width:75%;margin-top:8px"></i></div>').join('');
  else els['skeleton'].innerHTML = '';
}

async function load() {
  skeleton(true);
  const [links, cats] = await Promise.all([
    fetch('data/links.json').then(r => { if (!r.ok) throw new Error('links'); return r.json(); }),
    fetch('data/categories.json').then(r => r.json()).catch(() => null)
  ]);
  state.links = Array.isArray(links) ? links : [];
  state.cats = cats;
  buildFacets();
  buildQuick();
  hero();
  readHash();
  syncControls();
  skeleton(false);
  render();
}

function counts(fn) {
  const m = new Map();
  for (const l of state.links) for (const v of fn(l)) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function buildFacets() {
  // Category
  const catCounts = state.cats?.categories || counts(l => l.category ? [l.category] : []).map(([value, count]) => ({ value, count }));
  els['cnt-cat'].textContent = `${catCounts.length} subjects`;
  els['facet-cat'].innerHTML = catCounts.map(({ value, count }) =>
    `<label class="check-row"><input type="checkbox" data-facet="cat" value="${esc(value)}"><span>${esc(pretty(value))}</span><span class="c">${fmt(count)}</span></label>`).join('');
  // Type
  const typeCounts = state.cats?.contentTypes || [];
  const icon = { pdf: 'PDF', docx: 'DOC', image: 'IMG', folder: 'DIR', archive: 'ZIP', webpage: 'WEB' };
  els['facet-type'].innerHTML = typeCounts.map(({ value, count }) =>
    `<label class="check-row"><input type="checkbox" data-facet="type" value="${esc(value)}"><span>${esc(icon[value] || value)}</span><span class="c">${fmt(count)}</span></label>`).join('');
  // Provider (derived from tags)
  const tagCounts = new Map((state.cats?.tags || []).map(t => [t.value, t.count]));
  const provs = PROVIDERS.map(p => ({ value: p, count: tagCounts.get(p) || 0 })).filter(p => p.count > 0).sort((a, b) => b.count - a.count);
  els['facet-provider'].innerHTML = provs.map(({ value, count }) =>
    `<label class="check-row"><input type="checkbox" data-facet="prov" value="${esc(value)}"><span>${esc(pretty(value))}</span><span class="c">${fmt(count)}</span></label>`).join('');
  // Tag cloud (top non-provider, non-noise tags)
  const skip = new Set(['google-drive', 'drive-folder', ...PROVIDERS, ...Array.from({ length: 33 }, (_, i) => `set-${i}`), 'set-', 'set-01', 'set-02', 'set-03', 'set-04', 'set-05', 'set-06', 'set-07', 'set-08', 'set-09']);
  const cloud = (state.cats?.tags || []).filter(t => !skip.has(t.value)).slice(0, 14);
  els['tag-cloud'].innerHTML = cloud.map(t => `<button data-tag="${esc(t.value)}">${esc(t.value)} · ${fmt(t.count)}</button>`).join('');
  // Tag select
  const allTags = (state.cats?.tags || []).slice(0, 150);
  for (const t of allTags) {
    const o = document.createElement('option');
    o.value = t.value; o.textContent = `${t.value} (${fmt(t.count)})`;
    els['f-tag'].appendChild(o);
  }
  document.querySelectorAll('[data-facet]').forEach(cb => cb.addEventListener('change', () => {
    const set = cb.dataset.facet === 'cat' ? state.catsSel : cb.dataset.facet === 'type' ? state.typesSel : state.provSel;
    cb.checked ? set.add(cb.value) : set.delete(cb.value);
    state.page = 1; render(); writeHash();
  }));
}

function buildQuick() {
  els['quick-chips'].innerHTML = QUICK.map(([q, label]) => `<button class="quick-chip" data-q="${esc(q)}">${esc(label)}</button>`).join('');
  els['empty-chips'].innerHTML = QUICK.slice(0, 4).map(([q, label]) => `<button class="quick-chip" data-q="${esc(q)}">${esc(label)}</button>`).join('');
}

function hero() {
  const L = state.links;
  const files = L.filter(l => l.contentType !== 'folder').length;
  const folders = L.length - files;
  const answers = L.filter(l => (l.tags || []).includes('answers')).length;
  const pdfs = L.filter(l => l.contentType === 'pdf').length;
  els['stat-total'].textContent = `${fmt(L.length)} files & folders · searchable offline`;
  els['hero-count'].textContent = fmt(L.length);
  els['st-files'].textContent = fmt(files);
  els['st-folders'].textContent = fmt(folders);
  els['st-answers'].textContent = fmt(answers);
  els['st-pdf'].textContent = fmt(pdfs);
  const top = (state.cats?.tags || []).filter(t => !['google-drive', 'drive-folder'].includes(t.value)).slice(0, 5);
  els['hero-stats'].innerHTML = top.map(t => `<span class="hero-pill">${esc(t.value)} · ${fmt(t.count)}</span>`).join('');
  els['stat-meta'].textContent = state.cats?.generatedAt ? `dataset ${state.cats.generatedAt.slice(0, 10)}` : '';
}

const pretty = (s) => String(s).split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');

/* ---------- search / filter ---------- */
function score(l, terms) {
  if (!terms.length) return 1;
  const title = (l.title || '').toLowerCase();
  const hay = [l.title, l.description, l.summary, l.category, l.subcategory, (l.tags || []).join(' '), (l.keywords || []).join(' '), (l.subjects || []).join(' '), l.siteName, l.creator, l.domain].filter(Boolean).join(' ').toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (title.includes(t)) s += 6;
    else if ((l.tags || []).some(x => x.toLowerCase().includes(t))) s += 4;
    else if (hay.includes(t)) s += 2;
    else return -1;
  }
  if ((l.tags || []).includes('answers')) s += 0.4;
  return s;
}

function filtered() {
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const l of state.links) {
    if (state.catsSel.size && !state.catsSel.has(l.category)) continue;
    if (state.typesSel.size && !state.typesSel.has(l.contentType)) continue;
    if (state.provSel.size && !(l.tags || []).some(t => state.provSel.has(t))) continue;
    if (state.tag && !(l.tags || []).includes(state.tag)) continue;
    if (state.status && l.status !== state.status) continue;
    if (state.answersOnly && !(l.tags || []).includes('answers')) continue;
    if (state.hideImg && l.contentType === 'image') continue;
    const s = score(l, terms);
    if (s < 0) continue;
    out.push({ l, s });
  }
  if (state.sort === 'title') out.sort((a, b) => String(a.l.title).localeCompare(String(b.l.title)));
  else if (state.sort === 'newest') out.sort((a, b) => String(b.l.dateModified || '').localeCompare(String(a.l.dateModified || '')));
  else if (state.sort === 'answers') out.sort((a, b) => (((b.l.tags || []).includes('answers')) - ((a.l.tags || []).includes('answers'))) || b.s - a.s);
  else out.sort((a, b) => b.s - a.s || String(a.l.title).localeCompare(String(b.l.title)));
  return out.map(x => x.l);
}

/* ---------- render ---------- */
const FILE_CLASS = { pdf: 'fi-pdf', docx: 'fi-docx', image: 'fi-image', folder: 'fi-folder', archive: 'fi-archive', webpage: 'fi-webpage' };
const FILE_ABBR = { pdf: 'PDF', docx: 'DOC', image: 'IMG', folder: 'DIR', archive: 'ZIP', webpage: 'WEB' };

function card(l) {
  const fc = FILE_CLASS[l.contentType] || 'fi-other';
  const ab = FILE_ABBR[l.contentType] || (l.contentType || '?').slice(0, 3).toUpperCase();
  const tags = (l.tags || []).filter(t => t !== 'google-drive').slice(0, 5).map(t => `<button class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  const hasAns = (l.tags || []).includes('answers');
  return `<article class="card" data-id="${esc(l.id)}">
    <div class="file-ico ${fc}" aria-hidden="true">${esc(ab)}</div>
    <div class="card-body">
      <h3><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || l.url)}</a></h3>
      ${l.summary || l.description ? `<p class="desc">${esc(l.summary || l.description)}</p>` : ''}
      <div class="meta-row">
        ${l.category ? `<span class="badge cat">${esc(pretty(l.category))}</span>` : ''}
        ${hasAns ? `<span class="badge ans">Answers ✓</span>` : ''}
        ${l.status && l.status !== 'active' ? `<span class="badge status-${esc(l.status)}">● ${esc(l.status)}</span>` : ''}
        ${l.dateModified ? `<span>mod ${esc(l.dateModified)}</span>` : ''}
      </div>
      ${tags ? `<div class="meta-row">${tags}</div>` : ''}
      <div class="confbar" title="metadata confidence ${esc(l.confidence ?? '')}"><i style="width:${Math.round((l.confidence ?? 0.5) * 100)}%"></i></div>
      <div class="card-foot">
        <button class="btn small secondary" data-details="${esc(l.id)}">Details</button>
        <a class="btn small" href="${esc(l.url)}" target="_blank" rel="noopener">Open ↗</a>
      </div>
    </div>
  </article>`;
}

function pager(total) {
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  if (state.page > pages) state.page = pages;
  for (const mount of ['pager-top', 'pager-bottom']) {
    const el = els[mount];
    el.innerHTML = '';
    const btn = (label, p, opts = {}) => {
      const b = document.createElement('button');
      b.innerHTML = label;
      if (opts.cur) b.classList.add('cur');
      if (opts.dis) b.disabled = true;
      b.setAttribute('aria-label', opts.aria || `Page ${p}`);
      if (opts.cur) b.setAttribute('aria-current', 'page');
      b.onclick = () => { state.page = p; render(); writeHash(); document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      el.appendChild(b);
    };
    btn('‹', Math.max(1, state.page - 1), { dis: state.page <= 1, aria: 'Previous page' });
    const win = new Set([1, state.page - 1, state.page, state.page + 1, pages]);
    const sorted = [...win].filter(p => p >= 1 && p <= pages).sort((a, b) => a - b);
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) { const d = document.createElement('span'); d.className = 'dots'; d.textContent = '…'; el.appendChild(d); }
      btn(String(p), p, { cur: p === state.page });
      prev = p;
    }
    btn('›', Math.min(pages, state.page + 1), { dis: state.page >= pages, aria: 'Next page' });
  }
  return pages;
}

function chips() {
  const c = [];
  if (state.q) c.push({ k: 'q', label: `“${state.q}”` });
  state.catsSel.forEach(v => c.push({ k: 'cat', v, label: pretty(v) }));
  state.typesSel.forEach(v => c.push({ k: 'type', v, label: v }));
  state.provSel.forEach(v => c.push({ k: 'prov', v, label: pretty(v) }));
  if (state.tag) c.push({ k: 'tag', label: `#${state.tag}` });
  if (state.status) c.push({ k: 'status', label: state.status });
  if (state.answersOnly) c.push({ k: 'answersOnly', label: 'answers only' });
  if (state.hideImg) c.push({ k: 'hideImg', label: 'hide images' });
  els['active-chips'].innerHTML = c.map((x, i) => `<span class="pill-x">${esc(x.label)}<button data-chip="${i}" aria-label="Remove filter ${esc(x.label)}">✕</button></span>`).join('');
  els['active-chips'].querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
    const x = c[Number(b.dataset.chip)];
    if (x.k === 'q') { state.q = ''; els['q'].value = ''; els['clear'].hidden = true; }
    if (x.k === 'cat') state.catsSel.delete(x.v);
    if (x.k === 'type') state.typesSel.delete(x.v);
    if (x.k === 'prov') state.provSel.delete(x.v);
    if (x.k === 'tag') { state.tag = ''; els['f-tag'].value = ''; }
    if (x.k === 'status') { state.status = ''; els['f-status'].value = ''; }
    if (x.k === 'answersOnly') { state.answersOnly = false; els['f-answers'].checked = false; }
    if (x.k === 'hideImg') { state.hideImg = false; els['f-hide-img'].checked = false; }
    syncChecks(); state.page = 1; render(); writeHash();
  });
}

function render() {
  const all = filtered();
  const total = all.length;
  const pages = pager(total);
  const slice = all.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  els['grid'].className = state.view === 'list' ? 'grid list' : 'grid';
  els['grid'].innerHTML = slice.map(card).join('');
  els['empty'].hidden = total !== 0;
  els['grid'].style.display = total === 0 ? 'none' : '';
  els['stat-showing'].textContent = total === 0 ? '0 results' :
    `${fmt(total)} result${total === 1 ? '' : 's'} · page ${fmt(state.page)} of ${fmt(pages)}`;
  if (total === 0) els['empty-msg'].textContent = state.q ? `Nothing matched “${state.q}” with the current filters.` : 'Nothing matched the current filters.';
  chips();
}

/* ---------- modal ---------- */
function openModal(id) {
  const l = state.links.find(x => x.id === id);
  if (!l) return;
  const rows = [
    ['Title', esc(l.title)], ['Description', esc(l.description || l.summary || '—')],
    ['Category', esc(l.category || '—') + (l.subcategory ? ` · ${esc(l.subcategory)}` : '')],
    ['Subjects', esc((l.subjects || []).join(', ') || '—')], ['Tags', esc((l.tags || []).join(', ') || '—')],
    ['Type', esc(l.contentType || '—')], ['Audience', esc(l.audience || '—')],
    ['Site', esc(l.siteName || l.domain || '—')], ['Drive file', esc(l.driveName || l.driveId || '—')],
    ['Modified', esc(l.dateModified || '—')], ['Checked', esc(l.lastChecked || '—')],
    ['Source', esc(l.metadataSource || '—') + (l.confidence != null ? ` · conf ${Number(l.confidence).toFixed(2)}` : '')],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  els['modal-body'].innerHTML = `<h2 id="m-title">${esc(l.title)}</h2>
    <div class="meta-row"><span class="badge cat">${esc(pretty(l.category || 'other'))}</span><span class="badge">${esc(l.contentType || '')}</span><span class="badge status-${esc(l.status || 'unknown')}">● ${esc(l.status || 'unknown')}</span></div>
    <dl class="kv">${rows}</dl>
    <div class="actions">
      <a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">Open original ↗</a>
      <button class="btn secondary" id="m-copy">Copy link</button>
      <button class="btn secondary" id="m-drive">Copy Drive ID</button>
    </div>`;
  els['modal'].hidden = false;
  document.body.style.overflow = 'hidden';
  $('m-copy').onclick = async () => { await navigator.clipboard.writeText(l.url).catch(() => {}); toast('Link copied'); };
  $('m-drive').onclick = async () => { await navigator.clipboard.writeText(l.driveId || l.url).catch(() => {}); toast('Drive ID copied'); };
  els['modal-x'].focus();
}
function closeModal() { els['modal'].hidden = true; document.body.style.overflow = ''; }

/* ---------- share / export ---------- */
function writeHash() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.catsSel.size) p.set('cat', [...state.catsSel].join(','));
  if (state.typesSel.size) p.set('type', [...state.typesSel].join(','));
  if (state.provSel.size) p.set('prov', [...state.provSel].join(','));
  if (state.tag) p.set('tag', state.tag);
  if (state.sort !== 'relevance') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', state.page);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
}
function readHash() {
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('q')) { state.q = p.get('q'); els['q'].value = state.q; els['clear'].hidden = false; }
    if (p.get('cat')) p.get('cat').split(',').forEach(v => state.catsSel.add(v));
    if (p.get('type')) p.get('type').split(',').forEach(v => state.typesSel.add(v));
    if (p.get('prov')) p.get('prov').split(',').forEach(v => state.provSel.add(v));
    if (p.get('tag')) state.tag = p.get('tag');
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('page')) state.page = Math.max(1, Number(p.get('page')) || 1);
  } catch {}
}
function syncControls() {
  els['f-tag'].value = state.tag;
  els['f-sort'].value = state.sort;
  syncChecks();
}
function syncChecks() {
  document.querySelectorAll('[data-facet="cat"]').forEach(cb => cb.checked = state.catsSel.has(cb.value));
  document.querySelectorAll('[data-facet="type"]').forEach(cb => cb.checked = state.typesSel.has(cb.value));
  document.querySelectorAll('[data-facet="prov"]').forEach(cb => cb.checked = state.provSel.has(cb.value));
  document.querySelectorAll('#tag-cloud button').forEach(b => b.classList.toggle('is-on', state.provSel.has(b.dataset.tag) || state.tag === b.dataset.tag));
}

/* ---------- events ---------- */
function bind() {
  els['q'].addEventListener('input', debounce(e => {
    state.q = e.target.value.trim(); state.page = 1;
    els['clear'].hidden = !state.q;
    render(); writeHash();
  }, 140));
  els['clear'].onclick = () => { els['q'].value = ''; state.q = ''; els['clear'].hidden = true; state.page = 1; render(); writeHash(); els['q'].focus(); };
  els['f-tag'].onchange = e => { state.tag = e.target.value; state.page = 1; render(); writeHash(); };
  els['f-status'].onchange = e => { state.status = e.target.value; state.page = 1; render(); writeHash(); };
  els['f-answers'].onchange = e => { state.answersOnly = e.target.checked; state.page = 1; render(); writeHash(); };
  els['f-hide-img'].onchange = e => { state.hideImg = e.target.checked; state.page = 1; render(); writeHash(); };
  els['f-sort'].onchange = e => { state.sort = e.target.value; state.page = 1; render(); writeHash(); };
  els['f-per'].onchange = e => { state.perPage = Number(e.target.value); state.page = 1; render(); };
  const reset = () => {
    Object.assign(state, { q: '', tag: '', status: '', answersOnly: false, hideImg: false, sort: 'relevance', page: 1 });
    state.catsSel.clear(); state.typesSel.clear(); state.provSel.clear();
    els['q'].value = ''; els['clear'].hidden = true;
    els['f-tag'].value = ''; els['f-status'].value = ''; els['f-answers'].checked = false; els['f-hide-img'].checked = false; els['f-sort'].value = 'relevance';
    syncChecks(); render(); writeHash();
  };
  els['reset'].onclick = reset;
  els['empty-reset'].onclick = reset;
  els['empty-browse'].onclick = () => { reset(); document.getElementById('results').scrollIntoView({ behavior: 'smooth' }); };
  els['brand-home'].onclick = (e) => { e.preventDefault(); reset(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { els['q'].value = q.dataset.q; state.q = q.dataset.q; els['clear'].hidden = false; state.page = 1; render(); writeHash(); document.getElementById('results').scrollIntoView({ behavior: 'smooth' }); return; }
    const t = e.target.closest('[data-tag]');
    if (t) {
      const v = t.dataset.tag;
      if (PROVIDERS.includes(v)) { state.provSel.has(v) ? state.provSel.delete(v) : state.provSel.add(v); }
      else { state.tag = state.tag === v ? '' : v; els['f-tag'].value = state.tag; }
      syncChecks(); state.page = 1; render(); writeHash(); return;
    }
    const d = e.target.closest('[data-details]');
    if (d) { openModal(d.dataset.details); return; }
  });

  els['view-grid'].onclick = () => { state.view = 'grid'; els['view-grid'].classList.add('is-on'); els['view-list'].classList.remove('is-on'); els['view-grid'].setAttribute('aria-pressed', 'true'); els['view-list'].setAttribute('aria-pressed', 'false'); render(); };
  els['view-list'].onclick = () => { state.view = 'list'; els['view-list'].classList.add('is-on'); els['view-grid'].classList.remove('is-on'); els['view-list'].setAttribute('aria-pressed', 'true'); els['view-grid'].setAttribute('aria-pressed', 'false'); render(); };

  els['filters-toggle'].onclick = () => {
    const open = els['filters'].classList.toggle('open');
    els['filters-toggle'].setAttribute('aria-expanded', String(open));
  };
  els['modal-x'].onclick = closeModal;
  els['modal'].addEventListener('click', (e) => { if (e.target === els['modal']) closeModal(); });

  els['copy-link'].onclick = async () => { writeHash(); await navigator.clipboard.writeText(location.href).catch(() => {}); toast('Share link copied'); };
  els['export-csv'].onclick = () => {
    const rows = filtered().map(l => ({ title: l.title, url: l.url, category: l.category, type: l.contentType, tags: (l.tags || []).join('|'), modified: l.dateModified || '' }));
    const csv = 'title,url,category,type,tags,modified\n' + rows.map(r => [r.title, r.url, r.category, r.type, r.tags, r.modified].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'sehs-directory.csv'; a.click();
    URL.revokeObjectURL(a.href);
    toast(`Exported ${fmt(rows.length)} rows`);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== els['q']) { e.preventDefault(); els['q'].focus(); }
    if (e.key === 'Escape') { closeModal(); els['filters'].classList.remove('open'); }
  });
}

initTheme();
bind();
load().catch(() => {
  skeleton(false);
  els['stat-showing'].textContent = 'Failed to load data/links.json — run npm run ingest:local first.';
});
