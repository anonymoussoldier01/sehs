// Page handlers: landing, search, resource, taxonomy, about, unlock.
import { search, normalizeQuery, computeStats, PROVIDERS, moreLikeThis } from '../search.js';
import { toRec, publicView, loadRows, forRole, fmtBytes } from './content.mjs';
import { layout, esc, pretty, resultRow, pagerHtml, emptyBlock, highlight, QUICK } from './templates.mjs';

function liteRows(db) {
  const where = `visibility = 1`;
  return db.prepare(`SELECT category, file_type, tags, subject FROM resources WHERE ${where}`).all()
    .map(r => ({ category: r.category, contentType: r.file_type, tags: JSON.parse(r.tags || '[]'), subjects: r.subject ? [r.subject] : [] }));
}

export function landing(ctx) {
  const { db, indexes, session } = ctx;
  const stats = computeStats(liteRows(db));
  const index = forRole(indexes);
  const docById = new Map(index.docs.map(d => [d.rec.id, d]));
  const pick = (fn, n) => {
    const out = [];
    for (const d of index.docs) {
      if (out.length >= n * 4) break;
      if (fn(d.rec)) out.push(d);
    }
    out.sort((a, b) => String(a.displayTitle).localeCompare(String(b.displayTitle)));
    return out.slice(0, n);
  };
  const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
  const card = (d) => resultRow(publicView(rowMap.get(d.rec.id)), d.displayTitle, [], true);
  const practice = pick(r => r.category === 'practice-test', 6);
  const answers = pick(r => (r.tags || []).includes('answers'), 6);
  const subjCount = new Map();
  for (const d of index.docs) for (const s of (d.rec.subjects || [])) subjCount.set(s, (subjCount.get(s) || 0) + 1);
  const topSubj = [...subjCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const body = `
  <section class="wrap hero" aria-label="Search">
    <h1>Find exactly what you need to study.</h1>
    <p class="hero-sub">Search the SEHS resource collection across practice papers, notes, tests and more.</p>
    <form class="search-wrap" action="/search" method="get" role="search">
      <div class="searchbox">
        <svg class="search-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input name="q" type="search" placeholder="Search papers, subjects, providers, topics…" autocomplete="off" aria-label="Search study resources">
        <kbd title="Press / to focus">/</kbd>
      </div>
    </form>
    <dl class="stats" aria-label="Collection statistics">
      <div><dt>Resources</dt><dd>${stats.total.toLocaleString()}</dd></div>
      <div><dt>Subjects</dt><dd>${stats.subjects}</dd></div>
      <div><dt>Providers</dt><dd>${stats.providers}</dd></div>
      <div><dt>With answers</dt><dd>${stats.answers.toLocaleString()}</dd></div>
      <div><dt>PDFs</dt><dd>${stats.pdfs.toLocaleString()}</dd></div>
    </dl>
  </section>
  <div class="wrap layout single" id="discovery">
    <main aria-label="Browse resources">
      <section class="disc-section" id="recent-strip" hidden><div class="disc-head"><h2>Recently viewed</h2></div><div class="disc-grid" id="recent-grid"></div></section>
      <section class="disc-section"><div class="disc-head"><h2>Practice tests <small>${practice.length ? '' : ''}</small></h2><a class="link-btn" href="/search?cat=practice-test">View all →</a></div>
        <div class="disc-grid">${practice.map(card).join('')}</div></section>
      <section class="disc-section"><div class="disc-head"><h2>Resources with answers</h2><a class="link-btn" href="/search?answers=1">View all →</a></div>
        <div class="disc-grid">${answers.map(card).join('')}</div></section>
      <section class="disc-section"><div class="disc-head"><h2>By subject</h2><a class="link-btn" href="/subjects">All subjects →</a></div>
        <div class="disc-sub">${topSubj.map(([s, c]) => `<div class="disc-tile"><h3>${esc(pretty(s))}</h3><p>${c.toLocaleString()} resources</p><a class="link-btn" href="/search?q=${encodeURIComponent(s)}">View all ${esc(pretty(s))} →</a></div>`).join('')}</div></section>
    </main>
  </div>`;
  return layout({ title: 'Find exactly what you need to study', desc: 'Search the SEHS resource collection across practice papers, notes, tests and more.', body, active: '/', session });
}

export function parseSearchParams(sp) {
  const list = (k) => (sp.get(k) || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  const per = Number(sp.get('per'));
  return {
    q: (sp.get('q') || '').slice(0, 200),
    cat: list('cat'), provider: list('provider'), type: list('type'),
    year: (sp.get('year') || '').slice(0, 4),
    aud: list('aud'), answers: sp.get('answers') === '1',
    sort: ['relevance', 'title-az', 'title-za', 'newest', 'type', 'answers'].includes(sp.get('sort')) ? sp.get('sort') : 'relevance',
    view: sp.get('view') === 'list' ? 'list' : 'grid',
    page: Math.max(1, Number(sp.get('page')) || 1),
    per: [24, 48, 96].includes(per) ? per : 24,
  };
}

function baseQuery(p, exclude) {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.cat.length && exclude !== 'cat') sp.set('cat', p.cat.join(','));
  if (p.provider.length && exclude !== 'provider') sp.set('provider', p.provider.join(','));
  if (p.type.length && exclude !== 'type') sp.set('type', p.type.join(','));
  if (p.year) sp.set('year', p.year);
  if (p.aud.length) sp.set('aud', p.aud.join(','));
  if (p.answers) sp.set('answers', '1');
  if (p.sort !== 'relevance') sp.set('sort', p.sort);
  if (p.per !== 24) sp.set('per', p.per);
  const s = sp.toString();
  return s ? `/search?${s}&` : '/search?';
}

export function searchPage(ctx, sp) {
  const { db, indexes, session } = ctx;
  const p = parseSearchParams(sp);
  const index = forRole(indexes);
  const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));

  const facetPass = (rec) => {
    if (p.cat.length && !p.cat.includes(rec.category)) return false;
    if (p.provider.length && !(rec.tags || []).some(t => p.provider.includes(t))) return false;
    return true;
  };
  const { tokens } = normalizeQuery(p.q);
  let res = search(index, p.q, { filter: facetPass });
  // apply remaining facets post-search (type/year/audience/answers need internals)
  let arr = res.results.filter(x => {
    const r = x.rec;
    const type = index.docs.find(d => d.rec.id === r.id)?.type || '';
    if (p.type.length && !p.type.includes(type)) return false;
    if (p.year && (r._year || '') !== p.year) return false;
    if (p.aud.length && !p.aud.includes(r._audience || 'general')) return false;
    if (p.answers && !(r.tags || []).includes('answers')) return false;
    x._type = type;
    return true;
  });
  // dynamic facet counts from the query result (before facet narrowing)
  const allQ = search(index, p.q, {}).results;
  const countBy = (fn) => { const m = new Map(); for (const x of allQ) for (const v of fn(x)) m.set(v, (m.get(v) || 0) + 1); return m; };
  const catC = countBy(x => [x.rec.category]);
  const provC = countBy(x => (x.rec.tags || []).filter(t => PROVIDERS.includes(t)));
  const docType = new Map(index.docs.map(d => [d.rec.id, d.type]));
  const typeC = countBy(x => [docType.get(x.rec.id) || 'other']);

  if (p.sort === 'title-az') arr.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  else if (p.sort === 'title-za') arr.sort((a, b) => b.displayTitle.localeCompare(a.displayTitle));
  else if (p.sort === 'newest') arr.sort((a, b) => String(b.rec.dateModified || '').localeCompare(String(a.rec.dateModified || '')) || b.score - a.score);
  else if (p.sort === 'type') arr.sort((a, b) => String(a._type).localeCompare(String(b._type)) || a.displayTitle.localeCompare(b.displayTitle));
  else if (p.sort === 'answers') arr.sort((a, b) => (((b.rec.tags || []).includes('answers')) - ((a.rec.tags || []).includes('answers'))) || b.score - a.score);

  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / p.per));
  const page = Math.min(p.page, pages);
  const slice = arr.slice((page - 1) * p.per, page * p.per);
  const base = baseQuery(p);
  const viewHref = (v) => {
    const sp = new URLSearchParams(base.replace(/&$/, '').replace('/search?', ''));
    if (v === 'list') sp.set('view', 'list'); else sp.delete('view');
    const s = sp.toString();
    return s ? `/search?${s}` : '/search';
  };

  const cards = slice.map(x => {
    const row = rowMap.get(x.rec.id);
    if (!row) return '';
    return resultRow(publicView(row), x.displayTitle, tokens, true);
  }).join('');

  const check = (facet, v, label, count) => {
    const on = p[facet === 'cat' ? 'cat' : facet === 'provider' ? 'provider' : 'type'].includes(v);
    return `<label class="check-row"><input type="checkbox" data-f="${facet}" value="${esc(v)}"${on ? ' checked' : ''}><span>${esc(label)}</span><span class="c">${Number(count || 0).toLocaleString()}</span></label>`;
  };
  const catFacet = [...catC.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) => check('cat', v, pretty(v), c)).join('');
  const provFacet = [...provC.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) => check('provider', v, pretty(v), c)).join('');
  const typeFacet = [...typeC.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) => check('type', v, pretty(v), c)).join('');

  const chips = [];
  if (p.q) chips.push(`<span class="pill-x">“${esc(p.q)}”<a href="${base.replace(/&$/, '').replace(/q=[^&]*&?/, '').replace(/\?$/, '') || '/search'}" aria-label="Remove query">✕</a></span>`);

  const modeNote = total > 0 && (res.mode === 'partial' || res.mode === 'fuzzy' || res.mode === 'drop' || (res.related && res.related.length))
    ? `<span class="mode-note">${res.mode === 'fuzzy' && res.corrected ? `Showing results for “${esc(res.corrected)}”. ` : res.mode === 'drop' && res.dropped.length ? `Ignoring “${esc(res.dropped.join(' '))}” — showing closest matches. ` : `No exact matches — showing closest matches. `}${res.related && res.related.length ? `Including related: ${esc(res.related.join(', '))}. ` : ''}</span>` : '';

  const body = `
  <div class="wrap layout" id="main">
    <aside class="filters" id="filters" aria-label="Filters">
      <div class="filters-head"><h2>Filters</h2><a class="link-btn" href="/search${p.q ? `?q=${encodeURIComponent(p.q)}` : ''}">Clear all</a></div>
      <div class="active-chips">${chips.join('')}</div>
      <details class="f-section" open><summary>Category</summary>
        <input class="facet-search" placeholder="Filter categories…" aria-label="Filter categories">
        <div class="check-list" id="facet-cat">${catFacet}</div></details>
      <details class="f-section" open><summary>Provider</summary>
        <input class="facet-search" placeholder="Filter providers…" aria-label="Filter providers">
        <div class="check-list" id="facet-provider">${provFacet}</div></details>
      <details class="f-section" open><summary>File type</summary>
        <div class="check-list" id="facet-type">${typeFacet}</div></details>
      <details class="f-section"><summary>More options</summary>
        <label class="check-row"><input type="checkbox" data-f="answers"${p.answers ? ' checked' : ''}><span>Answers included</span></label>
      </details>
    </aside>
    <main aria-label="Results">
      <div class="toolbar">
        <div class="showing-col">
          <span id="stat-showing">${total === 0 ? 'No results' : `${total.toLocaleString()} resource${total === 1 ? '' : 's'} found${p.q ? ` for “${esc(p.q)}”` : ''}`}</span>
          ${modeNote}
        </div>
      <div class="toolbar-right">
        <button id="density-toggle" class="btn secondary small" title="Toggle compact rows">Compact</button>
        <div class="seg" role="group" aria-label="View">
          <a class="seg-btn${p.view === 'grid' ? ' is-on' : ''}" href="${viewHref('grid')}" aria-label="Grid view">▦</a>
          <a class="seg-btn${p.view === 'list' ? ' is-on' : ''}" href="${viewHref('list')}" aria-label="List view">☰</a>
        </div>
        <label class="sort-wrap">Sort
            <select id="f-sort" aria-label="Sort results">
              ${[['relevance', 'Best match'], ['title-az', 'A–Z'], ['title-za', 'Z–A'], ['newest', 'Newest'], ['type', 'File type'], ['answers', 'Answers first']].map(([v, l]) => `<option value="${v}"${p.sort === v ? ' selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>
      <div id="grid" class="grid${p.view === 'list' ? ' list' : ''}">${cards}</div>
      ${total === 0 ? emptyBlock({
        msg: p.q ? `Nothing matched “${p.q}” with the current filters.` : 'Nothing matched the current filters.',
        corrected: res.mode === 'none' ? res.corrected : null,
        correctHref: res.corrected ? `/search?q=${encodeURIComponent(res.corrected)}` : '',
        chips: QUICK,
      }) : ''}
      ${pagerHtml(base, page, pages, total, p.per)}
    </main>
  </div>
  <script src="/search-page.js" defer></script>`;
  return layout({ title: p.q ? `Results for “${p.q}”` : 'Browse resources', body, active: '/search', session });
}

export function resourcePage(ctx, publicId) {
  const { db, indexes, session } = ctx;
  const notFound = () => ({ code: 404, html: layout({ title: 'Not found', body: `<div class="wrap" style="padding:40px 20px">${emptyBlock({ title: 'Resource not found', msg: 'It may have been moved, hidden, or the link is incorrect.', chips: QUICK })}</div>`, session }) });
  if (!/^[0-9a-f]{32}$/.test(publicId || '')) return notFound();
  const row = db.prepare('SELECT * FROM resources WHERE public_id = ?').get(publicId);
  if (!row || !row.visibility) return notFound();
  if (row.status === 'unavailable') {
    return { code: 200, html: layout({ title: row.title, body: `<div class="wrap" style="padding:40px 20px">${emptyBlock({ title: 'Temporarily unavailable', msg: 'This resource is being verified. Please check back soon.', chips: QUICK })}</div>`, session }) };
  }
  const v = publicView(row);
  const index = forRole(indexes);
  const doc = index.docs.find(d => d.rec.id === publicId);
  const displayTitle = doc ? doc.displayTitle : row.title;
  // related: TF-IDF cosine more-like-this (content similarity, not heuristics)
  const rows = loadRows(db);
  const rowMap = new Map(rows.map(r => [r.public_id, r]));
  const related = moreLikeThis(index, publicId, 6).map(x => {
    const r = rowMap.get(x.rec.id);
    if (!r) return '';
    return resultRow(publicView(r), x.displayTitle, [], false);
  }).join('');
  const facts = [
    ['File type', pretty(v.fileType) + (row.size_bytes ? ` · ${fmtBytes(row.size_bytes)}` : '')],
    ['Subject', v.subject ? pretty(v.subject) : pretty(v.category)],
    ['Provider', v.provider ? pretty(v.provider) : '—'],
    ['Year', v.year || '—'],
    ['Answers', v.answersIncluded ? 'Included' : 'Not included'],
    ['Updated', v.year || '—'],
    ['Status', v.status === 'available' ? 'Available' : pretty(v.status)],
  ].map(([k, val]) => `<dt>${k}</dt><dd>${esc(val)}</dd>`).join('');
  const body = `
  <div class="wrap" style="padding:20px;max-width:900px" id="main" data-record-id="${esc(v.id)}">
    <p class="crumb"><a href="/">Home</a> › <a href="/search?cat=${encodeURIComponent(v.category)}">${esc(pretty(v.category))}</a> › ${esc(displayTitle.slice(0, 60))}</p>
    <h1 style="font-family:var(--disp);letter-spacing:-.02em">${esc(displayTitle)}</h1>
    <div class="meta-row" style="margin:10px 0 16px">
      <span class="badge cat">${esc(pretty(v.category))}</span>
      ${v.provider ? `<span class="badge prov">${esc(pretty(v.provider))}</span>` : ''}
      <span class="badge">${esc(pretty(v.fileType))}</span>
      ${v.answersIncluded ? `<span class="badge ans">Answers included</span>` : ''}
    </div>
    ${v.description ? `<p style="color:var(--mut);max-width:70ch">${esc(v.description)}</p>` : ''}
    <dl class="kv">${facts}</dl>
    <div class="meta-row" style="margin:6px 0 18px">${(v.tags || []).slice(0, 10).map(t => `<a class="tag" href="/search?q=${encodeURIComponent(t)}">${esc(pretty(t))}</a>`).join('')}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px">
      <button class="btn" data-open="${esc(v.id)}">Open resource →</button>
      <button class="btn secondary" data-save="${esc(v.id)}" aria-label="Save this resource">☆ Save</button>
      <button class="btn secondary" id="copy-link">Copy link</button>
    </div>
    ${related ? `<section class="disc-section"><div class="disc-head"><h2>Related resources</h2></div><div class="disc-grid">${related}</div></section>` : ''}
  </div>
  <script src="/record.js" defer></script>`;
  return {
    code: 200,
    html: layout({ title: displayTitle, desc: v.description.slice(0, 160), body, session }),
  };
}

export function savedPage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:1000px" id="main">
    <h1 style="font-family:var(--disp)">Saved resources <span class="count-pill" id="saved-count" hidden></span></h1>
    <p style="color:var(--mut)">Bookmarks live only in this browser. Clearing site data removes them.</p>
    <div class="grid" id="saved-grid" style="margin-top:16px"><div class="sk"><i style="height:16px;width:60%"></i></div></div>
  </div>`;
  return layout({ title: 'Saved resources', body, session });
}

export function taxonomyPage(ctx, kind) {  const { db, session } = ctx;
  const where = `visibility = 1`;
  const isSubj = kind === 'subjects';
  const rows = isSubj
    ? db.prepare(`SELECT subject AS v, COUNT(*) AS c FROM resources WHERE ${where} AND subject <> '' GROUP BY subject ORDER BY c DESC`).all()
    : db.prepare(`SELECT provider AS v, COUNT(*) AS c FROM resources WHERE ${where} AND provider <> '' GROUP BY provider ORDER BY c DESC`).all();
  const tiles = rows.map(({ v: name, c }) => {
    const href = isSubj ? `/search?q=${encodeURIComponent(name)}` : `/search?provider=${encodeURIComponent(name)}`;
    return `<div class="disc-tile"><h3>${esc(pretty(name))}</h3><p>${Number(c).toLocaleString()} resources</p><a class="link-btn" href="${href}">Browse →</a></div>`;
  }).join('');
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <h1 style="font-family:var(--disp)">Browse by ${isSubj ? 'subject' : 'provider'}</h1>
    <p style="color:var(--mut)">${rows.length} ${isSubj ? 'subjects' : 'providers'} in the collection.</p>
    <div class="disc-sub" style="margin-top:16px">${tiles}</div></div>`;
  return layout({ title: isSubj ? 'Subjects' : 'Providers', body, active: isSubj ? '/subjects' : '/providers', session });
}

export function aboutPage(ctx) {
  const { db, session } = ctx;
  const n = db.prepare(`SELECT COUNT(*) AS n FROM resources WHERE visibility = 1`).get().n;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:760px" id="main">
    <h1 style="font-family:var(--disp)">About this directory</h1>
    <p style="color:var(--mut)">A searchable collection of ${Number(n).toLocaleString()} SEHS selective-entry study resources — practice papers, notes, homework and tests. Search runs on our own index; opening a resource takes you to its hosted file.</p>
    <h2 style="font-size:16px;margin-top:24px">Access</h2>
    <p style="color:var(--mut)">Every resource is open to everyone — no account, no login. You will be asked to accept the Terms &amp; Conditions when you open your first resource in each browser tab.</p>
    <h2 style="font-size:16px;margin-top:24px">Privacy</h2>
    <p style="color:var(--mut)">No cookies. No accounts. No third-party tracking or advertising. Preferences and saved items stay in your own browser. We log the minimum needed to operate the service, and raw usage statistics auto-purge after 30 days.</p></div>`;
  return layout({ title: 'About', body, active: '/about', session });
}

export function unlockPage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:32px 20px;max-width:560px" id="main">
    <h1 style="font-family:var(--disp)">Admin unlock</h1>
    <p style="color:var(--mut)">Enter the admin password to manage the collection. Access stays in this browser tab only — closing the tab locks it again. Locked out? Wait a minute and try again — repeated wrong guesses trigger a temporary lockout.</p>
    <div id="unlock-status"></div>
    <form id="unlock-form">
      <label class="sort-wrap" style="display:block;margin-bottom:10px">Admin password
        <input id="unlock-pw" type="password" autocomplete="current-password" required minlength="8"
          style="display:block;width:100%;margin-top:6px;padding:11px 12px;border-radius:10px;border:1px solid var(--line2);background:var(--panel);color:inherit;font-size:15px">
      </label>
      <p id="unlock-err" class="mode-note" hidden></p>
      <button class="btn" type="submit" style="width:100%">Unlock admin</button>
    </form>
  </div>
  <script src="/unlock.js" defer></script>`;
  return layout({ title: 'Admin unlock', body, session });
}
