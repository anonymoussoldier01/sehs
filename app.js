// Static directory frontend — loads local dataset only. No Gemini/API calls.
const state = { links: [], cats: null, q: '', cat: '', type: '', domain: '', status: '', tag: '', sort: 'relevance', page: 1, perPage: 24 };
const $ = (id) => document.getElementById(id);
const els = {};
['q', 'clear', 'f-cat', 'f-type', 'f-domain', 'f-status', 'f-tag', 'f-sort', 'reset', 'grid', 'empty', 'empty-reset', 'stat-total', 'stat-showing', 'stat-meta', 'pager-top', 'pager-bottom'].forEach(id => els[id] = $(id));

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function load() {
  const [links, cats] = await Promise.all([
    fetch('data/links.json').then(r => r.json()),
    fetch('data/categories.json').then(r => r.json()).catch(() => null)
  ]);
  state.links = Array.isArray(links) ? links : [];
  state.cats = cats;
  fillFilters();
  els['stat-total'].textContent = `${state.links.length.toLocaleString()} records`;
  els['stat-meta'].textContent = cats ? `updated ${esc(cats.generatedAt?.slice(0, 10) || '')}` : '';
  render();
}

function fillFilters() {
  const cats = state.cats;
  const add = (sel, items, fmt) => {
    const el = els[sel];
    (items || []).forEach(({ value, count }) => {
      const o = document.createElement('option');
      o.value = value; o.textContent = fmt ? fmt(value, count) : `${value} (${count})`;
      el.appendChild(o);
    });
  };
  if (cats) {
    add('f-cat', cats.categories);
    add('f-type', cats.contentTypes);
    add('f-domain', cats.domains);
    add('f-tag', (cats.tags || []).slice(0, 120));
  } else {
    // fallback from links
    const uniq = (fn) => [...new Set(state.links.flatMap(fn).filter(Boolean))].sort().map(v => ({ value: v, count: state.links.filter(l => fn(l).includes(v)).length }));
    add('f-cat', uniq(l => [l.category]));
    add('f-type', uniq(l => [l.contentType]));
    add('f-domain', uniq(l => [l.domain]));
    add('f-tag', uniq(l => l.tags || []).slice(0, 120));
  }
}

function score(link, q) {
  if (!q) return 1;
  const hay = [link.title, link.description, link.summary, link.category, link.subcategory, (link.tags || []).join(' '), (link.keywords || []).join(' '), (link.subjects || []).join(' '), link.siteName, link.creator, link.domain].filter(Boolean).join(' ').toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let s = 0;
  const title = (link.title || '').toLowerCase();
  for (const t of terms) {
    if (title.includes(t)) s += 5;
    else if (hay.includes(t)) s += 2;
    else return -1;
  }
  return s;
}

function filtered() {
  const { q, cat, type, domain, status, tag, sort } = state;
  let out = [];
  for (const l of state.links) {
    if (cat && l.category !== cat) continue;
    if (type && l.contentType !== type) continue;
    if (domain && l.domain !== domain) continue;
    if (status && l.status !== status) continue;
    if (tag && !(l.tags || []).includes(tag)) continue;
    const s = score(l, q);
    if (s < 0) continue;
    out.push({ l, s });
  }
  if (sort === 'title') out.sort((a, b) => String(a.l.title).localeCompare(String(b.l.title)));
  else if (sort === 'domain') out.sort((a, b) => String(a.l.domain).localeCompare(String(b.l.domain)));
  else if (sort === 'newest') out.sort((a, b) => String(b.l.dateModified || '').localeCompare(String(a.l.dateModified || '')));
  else out.sort((a, b) => b.s - a.s || String(a.l.title).localeCompare(String(b.l.title)));
  return out.map(x => x.l);
}

function card(l) {
  const tags = (l.tags || []).slice(0, 6).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  const status = l.status ? `<span class="badge status-${esc(l.status)}">● ${esc(l.status)}</span>` : '';
  return `<article class="card">
    <h3><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || l.url)}</a></h3>
    ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ''}
    <div class="meta">
      ${l.category ? `<span class="badge cat">${esc(l.category)}</span>` : ''}
      ${l.contentType ? `<span class="badge type">${esc(l.contentType)}</span>` : ''}
      ${status}
    </div>
    <div class="meta">${tags}</div>
    <div class="meta"><span>${esc(l.siteName || l.domain || '')}</span>${l.dateModified ? `<span>· mod ${esc(l.dateModified)}</span>` : ''}</div>
    <div class="open"><a href="${esc(l.url)}" target="_blank" rel="noopener">Open original ↗</a><span class="conf">${l.confidence != null ? `conf ${Number(l.confidence).toFixed(2)}` : ''}</span></div>
  </article>`;
}

function pager(total, page, perPage, mount) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const el = els[mount];
  el.innerHTML = '';
  const btn = (label, p, opts = {}) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (opts.cur) b.classList.add('cur');
    if (opts.dis) b.disabled = true;
    b.onclick = () => { state.page = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    el.appendChild(b);
  };
  btn('‹ Prev', Math.max(1, page - 1), { dis: page <= 1 });
  const win = [1, page - 1, page, page + 1, pages].filter((v, i, a) => v >= 1 && v <= pages && a.indexOf(v) === i).sort((a, b) => a - b);
  win.forEach(p => btn(String(p), p, { cur: p === page }));
  btn('Next ›', Math.min(pages, page + 1), { dis: page >= pages });
}

function render() {
  const all = filtered();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  if (state.page > pages) state.page = pages;
  const slice = all.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  els['grid'].innerHTML = slice.map(card).join('');
  els['empty'].hidden = total !== 0;
  els['stat-showing'].textContent = total === 0 ? '0 results' : `Showing ${((state.page - 1) * state.perPage + 1).toLocaleString()}–${Math.min(total, state.page * state.perPage).toLocaleString()} of ${total.toLocaleString()}`;
  pager(total, state.page, state.perPage, 'pager-top');
  pager(total, state.page, state.perPage, 'pager-bottom');
}

function bind() {
  els['q'].addEventListener('input', debounce(e => { state.q = e.target.value.trim(); state.page = 1; render(); }, 150));
  els['clear'].onclick = () => { els['q'].value = ''; state.q = ''; state.page = 1; render(); els['q'].focus(); };
  [['f-cat', 'cat'], ['f-type', 'type'], ['f-domain', 'domain'], ['f-status', 'status'], ['f-tag', 'tag'], ['f-sort', 'sort']].forEach(([id, k]) => {
    els[id].addEventListener('change', e => { state[k] = e.target.value; state.page = 1; render(); });
  });
  const reset = () => {
    Object.assign(state, { q: '', cat: '', type: '', domain: '', status: '', tag: '', sort: 'relevance', page: 1 });
    els['q'].value = ''; els['f-cat'].value = ''; els['f-type'].value = ''; els['f-domain'].value = ''; els['f-status'].value = ''; els['f-tag'].value = ''; els['f-sort'].value = 'relevance';
    render();
  };
  els['reset'].onclick = reset;
  els['empty-reset'].onclick = reset;
  document.addEventListener('click', e => {
    const b = e.target.closest('.chiplink');
    if (b) { els['q'].value = b.dataset.q; state.q = b.dataset.q; state.page = 1; render(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== els['q']) { e.preventDefault(); els['q'].focus(); }
  });
}

bind();
load().catch(e => { els['stat-showing'].textContent = 'Failed to load data/links.json — run npm run ingest first.'; });
