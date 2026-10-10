// Page handlers: landing, search, resource, taxonomy, about, unlock.
import { search, normalizeQuery, computeStats, PROVIDERS, moreLikeThis } from '../search.js';
import { toRec, publicView, loadRows, forRole, fmtBytes } from './content.mjs';
import { layout, esc, pretty, resultRow, pagerHtml, emptyBlock, highlight, QUICK } from './templates.mjs';

function liteRows(db) {
  const where = `visibility = 1 AND file_type != 'folder' AND category != 'folder'`;
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
  // trending: top-opened in the last 7 days (anonymous aggregates only)
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const trending = ctx.db.prepare(`SELECT key, SUM(count) c FROM daily_aggregates
    WHERE kind = 'resource' AND day >= ? GROUP BY key ORDER BY c DESC LIMIT 6`).all(since)
    .map(r => ({ row: rowMap.get(r.key), opens: r.c })).filter(x => x.row);
  const trendingCards = trending.map(({ row }) => {
    const d = docById.get(row.public_id);
    return resultRow(publicView(row), d ? d.displayTitle : row.title, [], true);
  }).join('');
  const stat = (label, n) => `<div><dt>${label}</dt><dd data-countup="${n}">${Number(n).toLocaleString()}</dd></div>`;
  const deckCard = (href, ico, title, sub, badge) => `
    <a class="deck-card" href="${href}"><span class="deck-top"><span class="deck-ico" aria-hidden="true">${ico}</span>${badge ? `<span class="studiers">${esc(badge)}</span>` : ''}</span>
    <h3>${esc(title)}</h3><p>${esc(sub)}</p><span class="deck-go">Study →</span></a>`;
  const nextRail = topSubj.slice(0, 6).map(([s, c]) =>
    deckCard(`/search?q=${encodeURIComponent(s)}`, '▢', pretty(s), `${Number(c).toLocaleString()} resources · flashcards + papers`, `${Number(c).toLocaleString()} resources`)).join('');
  const body = `
  <div class="feed" id="discovery">
    <section aria-label="Search">
      <form class="search-wrap" action="/search" method="get" role="search">
        <div class="searchbox">
          <svg class="search-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input name="q" type="search" placeholder="Search papers, decks, topics — try “fractions”…" autocomplete="off" aria-label="Search study resources">
          <kbd title="Press / to focus">/</kbd>
        </div>
      </form>
      <div class="quick-row"><span class="quick-label">Popular:</span>
        <a class="quick-chip" href="/search?q=vsse">VSSE</a>
        <a class="quick-chip" href="/search?q=maths&answers=1">Maths + answers</a>
        <a class="quick-chip" href="/search?q=numerical%20reasoning">Numerical</a>
        <a class="quick-chip" href="/search?q=reading%20comprehension">Reading</a>
        <a class="quick-chip" href="/mocks">Timed mock</a>
      </div>
      <dl class="stats" aria-label="Collection statistics">
        ${stat('Resources', stats.total)}
        ${stat('Subjects', stats.subjects)}
        ${stat('Providers', stats.providers)}
        ${stat('With answers', stats.answers)}
      </dl>
    </section>
    <section class="progress-strip" id="progress-strip" aria-label="Your progress"></section>

    <h2 class="feed-h">Recents <small id="home-next-inline"></small></h2>
    <section class="disc-section" id="recent-strip" hidden><div class="disc-grid" id="recent-grid"></div></section>
    <div class="disc-grid" id="recent-fallback">
      <div class="disc-tile"><h3 id="home-next">Pick up where you left off</h3><p>Your recent decks and papers appear here.</p><p><a class="btn small" id="home-go" href="/study">Open study hub →</a></p></div>
      <div class="disc-tile"><h3>Question of the day</h3><p id="home-qotd">Warming up…</p><p id="home-qotd-a" hidden style="font-size:13.5px"></p><p><button class="btn small secondary" id="home-qotd-reveal" hidden>Show answer</button></p></div>
    </div>

    <h2 class="feed-h">Personalize your content</h2>
    <section class="disc-tile" id="tuned-shelf" hidden><h3>Picked for how you study</h3><p style="color:var(--mut);font-size:13px">Based on what you open · stored in this browser · <a class="link-btn" href="/subjects">update subjects</a></p><div class="disc-grid" id="tuned-grid" style="margin-top:10px"></div></section>
    <section class="disc-tile" id="tuned-fallback"><h3>Find content based on your exams</h3><p style="color:var(--mut);font-size:13.5px">Open a few resources and this shelf tunes itself to your subjects.</p><p><a class="btn small secondary" href="/subjects">Browse subjects</a></p></section>

    <h2 class="feed-h">New: timed mode</h2>
    <section class="promo"><div><h3>Exam blocks, real timing</h3><p>60 / 55 / 40-minute blocks with instant scoring and explanations. Best scores stay in your browser.</p><p><a class="btn small" href="/mocks">Generate a mock</a></p></div><div class="promo-art" aria-hidden="true">◷</div></section>

    <h2 class="feed-h">For your next study session <small>from the library</small></h2>
    <div class="rail">${nextRail}</div>

    <h2 class="feed-h">Learn questions <small>try one now</small></h2>
    <section class="learn-card" id="feed-learn" aria-label="Sample learn question">
      <p class="qpos">1 / 5 · sample</p>
      <p class="q" id="feed-learn-q">Loading a sample question…</p>
      <div id="feed-learn-opts"></div>
      <p class="opt-fb" id="feed-learn-fb" hidden></p>
      <p style="margin:14px 0 0"><a class="btn small" href="/study">Open flashcards</a> <a class="btn small secondary" href="/mocks">Take a timed mock</a></p>
    </section>

    <h2 class="feed-h">New arrivals <small><a class="link-btn" href="/feed.xml">RSS</a></small></h2>
    <section class="disc-grid" id="new-grid"><div class="sk"><i style="height:16px;width:60%"></i><i style="height:12px;width:90%;margin-top:10px"></i></div><div class="sk"><i style="height:16px;width:55%"></i><i style="height:12px;width:85%;margin-top:10px"></i></div></section>
    ${trendingCards ? `<h2 class="feed-h">Trending this week</h2><div class="disc-grid">${trendingCards}</div>` : ''}
    <h2 class="feed-h">Practice tests <small><a class="link-btn" href="/search?cat=practice-test">View all</a></small></h2>
    <div class="disc-grid">${practice.map(card).join('')}</div>
    <h2 class="feed-h">Resources with answers <small><a class="link-btn" href="/search?answers=1">View all</a></small></h2>
    <div class="disc-grid">${answers.map(card).join('')}</div>
    <h2 class="feed-h">By subject <small><a class="link-btn" href="/subjects">All subjects</a></small></h2>
    <div class="disc-sub">${topSubj.map(([s, c]) => `<div class="disc-tile"><h3>${esc(pretty(s))}</h3><p>${c.toLocaleString()} resources</p><a class="link-btn" href="/search?q=${encodeURIComponent(s)}">View all ${esc(pretty(s))} →</a></div>`).join('')}</div>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/home.js" defer></script>
  <script src="/feed-learn.js" defer></script>`;
  return layout({ title: 'Study flashcards, mocks and past papers', desc: 'Flashcards, timed mocks and a searchable library of selective-entry study resources.', body, active: '/', session });
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
      ${total === 0 ? '' : `<section class="disc-section"><div class="disc-tile"><button class="btn small secondary" id="explain-results">Explain these results</button> <span style="color:var(--faint);font-size:12px">Plain-English summary of the top hits + what to try next</span><p id="explain-out" style="white-space:pre-wrap;font-size:13.5px" hidden></p></div></section>`}
      ${total === 0 ? emptyBlock({
        msg: p.q ? `Nothing matched “${p.q}” with the current filters.` : 'Nothing matched the current filters.',
        corrected: res.mode === 'none' ? res.corrected : null,
        correctHref: res.corrected ? `/search?q=${encodeURIComponent(res.corrected)}` : '',
        chips: QUICK,
      }) : ''}
      ${pagerHtml(base, page, pages, total, p.per)}
    </main>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/search-page.js" defer></script>`;
  return layout({ title: p.q ? `Results for “${p.q}”` : 'Browse resources', body, active: '/search', session });
}

export function resourcePage(ctx, publicId) {
  const { db, indexes, session } = ctx;
  const notFound = () => ({ code: 404, html: layout({ title: 'Not found', body: `<div class="wrap" style="padding:40px 20px">${emptyBlock({ title: 'Resource not found', msg: 'It may have been moved, hidden, or the link is incorrect.', chips: QUICK })}</div>`, session }) });
  if (!/^[0-9a-f]{32}$/.test(publicId || '')) return notFound();
  const row = db.prepare('SELECT * FROM resources WHERE public_id = ?').get(publicId);
  if (!row || !row.visibility) return notFound();
  if (row.file_type === 'folder' || row.category === 'folder') return notFound();
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
      <button class="btn secondary" data-copylink="/r/${esc(v.id)}">Copy link</button>
      <button class="btn secondary" data-report="${esc(v.id)}">Report issue</button>
    </div>
    <div class="disc-tile" style="margin-bottom:28px"><h3 style="margin-top:0">Study this properly</h3>
      <p style="color:var(--mut);font-size:13.5px;margin:0 0 10px">Turn this resource into flashcards or a short quiz. Made on the spot, saved to your browser.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small secondary" id="res-cards">Make flashcards</button><button class="btn small secondary" id="res-quiz">Quiz me on this</button></div>
      <div id="res-ai-out" hidden style="margin-top:8px"><div id="res-ai-body" style="font-size:14px"></div><p><button class="btn small secondary" id="res-ai-save" hidden>Save as personal deck</button></p></div>
    </div>
    <div class="modal-backdrop" id="report-modal" hidden><div class="modal" role="dialog" aria-modal="true" aria-labelledby="rep-title" style="max-width:480px">
      <button class="icon-btn modal-x" id="report-x" aria-label="Close">✕</button>
      <h2 id="rep-title">Report an issue</h2>
      <form id="report-form" style="display:grid;gap:8px">
        <select id="report-reason" aria-label="Reason" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
          <option value="broken">Link is broken</option>
          <option value="wrong-details">Wrong title/details</option>
          <option value="other">Something else</option>
        </select>
        <textarea id="report-detail" rows="3" maxlength="500" placeholder="Optional details…" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"></textarea>
        <div><button class="btn small" type="submit">Send report</button></div>
      </form>
    </div></div>
    ${related ? `<section class="disc-section"><div class="disc-head"><h2>Related resources</h2></div><div class="disc-grid">${related}</div></section>` : ''}
  </div>
  <script src="/ai.js" defer></script>
  <script src="/record.js" defer></script>`;
  return {
    code: 200,
    html: layout({ title: displayTitle, desc: v.description.slice(0, 160), body, session }),
  };
}

export function savedPage(ctx) {  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:1000px" id="main">
    <h1 style="font-family:var(--disp)">Saved resources <span class="count-pill" id="saved-count" hidden></span></h1>
    <p style="color:var(--mut)">Bookmarks live only in this browser. Clearing site data removes them.</p>
    <div class="grid" id="saved-grid" style="margin-top:16px"><div class="sk"><i style="height:16px;width:60%"></i></div></div>
    <section class="disc-section" style="margin-top:24px"><div class="disc-head"><h2>Studylists</h2></div>
      <div class="disc-grid" id="lists-hub"></div>
      <form id="list-new" style="display:flex;gap:8px;margin-top:12px;max-width:480px">
        <input id="list-name" required maxlength="60" placeholder="New list name…" aria-label="New list name" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <button class="btn small" type="submit">Create list</button>
      </form>
      <p style="color:var(--faint);font-size:12.5px">Lists live in this browser. Share links encode public resource IDs only.</p>
    </section>
  </div>`;
  return layout({ title: 'Saved resources', body, session });
}

export function sharedListPage(ctx, ids) {
  const { db, indexes, session } = ctx;
  const index = forRole(indexes);
  const docById = new Map(index.docs.map(d => [d.rec.id, d]));
  const rowMap = new Map(loadRows(db).map(r => [r.public_id, r]));
  const cards = ids.map(id => {
    const row = rowMap.get(id);
    if (!row) return '';
    const d = docById.get(id);
    return resultRow(publicView(row), d ? d.displayTitle : row.title, [], true);
  }).join('');
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <p class="crumb"><a href="/">Home</a> › <a href="/saved">Saved</a> › Shared list</p>
    <h1 style="font-family:var(--disp)">Shared studylist (${ids.length} resources)</h1>
    <div style="display:flex;gap:8px;margin:12px 0 16px"><button class="btn small secondary" onclick="window.print()">Print pack</button></div>
    ${cards ? `<div class="grid">${cards}</div>` : '<p style="color:var(--mut)">None of these resources are available.</p>'}
  </div>`;
  return layout({ title: `Shared list (${ids.length})`, body, session });
}

export function studyHubPage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <h1 style="font-family:var(--disp)">Study hub</h1>
    <p style="color:var(--mut)">Flashcards, quizzes and goals — everything stays in your browser.</p>
    <section class="disc-section"><div class="disc-head"><h2>Your exam</h2></div>
      <div class="disc-tile" id="goals-widget">
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
          <div><div style="font-size:13px;color:var(--mut)">Countdown</div>
          <div id="exam-countdown" style="font-family:var(--disp);font-size:28px;font-weight:800">—</div></div>
          <div><div style="font-size:13px;color:var(--mut)">Day streak</div>
          <div id="streak-count" style="font-family:var(--disp);font-size:28px;font-weight:800">0 🔥</div></div>
          <div><div style="font-size:13px;color:var(--mut)">Cards mastered</div>
          <div id="mastered-count" style="font-family:var(--disp);font-size:28px;font-weight:800">0</div></div>
        </div>
        <form id="exam-form" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <input id="exam-date" type="date" aria-label="Exam date" style="padding:8px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
          <button class="btn small" type="submit">Set exam date</button>
          <button class="btn small secondary" type="button" id="exam-clear">Clear</button>
        </form>
      </div></section>
    <section class="disc-section"><div class="disc-head"><h2>Native SEHS prep</h2></div>
      <div class="disc-grid">
        <div class="disc-tile"><h3>Exam guide</h3><p>3 blocks, pacing, schools, plans.</p><a class="btn small" href="/exam-guide">Open guide →</a></div>
        <div class="disc-tile"><h3>Timed mocks</h3><p>60 / 55 / 40 min blocks + diagnostic.</p><a class="btn small" href="/mocks">Open mocks →</a></div>
        <div class="disc-tile"><h3>Writing studio</h3><p>80 prompts + timer + rubric.</p><a class="btn small" href="/writing">Open writing →</a></div>
        <div class="disc-tile"><h3>Maths drills</h3><p>Infinite Year-8 drills.</p><a class="btn small" href="/drills">Open drills →</a></div>
      </div></section>
    <section class="disc-section"><div class="disc-head"><h2>Study tools that use your work</h2></div>
      <div class="disc-grid">
        <div class="disc-tile"><h3>Flashcards from any topic</h3>
          <div style="display:flex;gap:8px;margin-top:8px"><input id="ai-deck-topic" maxlength="120" placeholder="e.g. analogies, fractions…" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit" aria-label="Deck topic"><button class="btn small" id="ai-deck-go">Make deck</button></div>
          <p id="ai-deck-msg" style="font-size:13px;color:var(--mut)"></p></div>
        <div class="disc-tile"><h3>My study plan</h3>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><select id="ai-plan-weeks" aria-label="Weeks" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"><option value="4">4 weeks</option><option value="8" selected>8 weeks</option><option value="12">12 weeks</option></select><button class="btn small" id="ai-plan-go">Build my plan</button> <button class="btn small secondary" id="ai-coach-go">Coach my mistakes</button></div>
          <p id="ai-plan-msg" style="font-size:13px;color:var(--mut)"></p></div>
      </div>
      <div class="disc-tile" id="ai-study-out" hidden style="margin-top:12px"><div id="ai-study-body" style="white-space:pre-wrap;font-size:14px"></div></div></section>
    <section class="disc-section"><div class="disc-head"><h2>Flashcard decks</h2></div>
      <div class="disc-grid" id="deck-grid"><div class="sk"><i style="height:16px;width:60%"></i></div></div></section>
    <section class="disc-section"><div class="disc-head"><h2>Your decks</h2>
      <span><button class="btn small secondary" id="deck-export">Export</button>
      <label class="btn small secondary" style="cursor:pointer">Import<input id="deck-import" type="file" accept="application/json" hidden></label></span></div>
      <div class="disc-grid" id="local-decks"></div>
      <div class="disc-tile" style="margin-top:12px"><h3>New deck</h3>
        <form id="deck-new" style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="deck-title" required maxlength="80" placeholder="Deck title" style="flex:1;min-width:200px;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
          <button class="btn small" type="submit">Create</button>
        </form>
        <form id="card-add" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" hidden>
          <select id="card-deck" aria-label="Deck"></select>
          <input id="card-front" required maxlength="500" placeholder="Front" style="flex:1;min-width:140px;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
          <input id="card-back" required maxlength="2000" placeholder="Back" style="flex:1;min-width:140px;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
          <button class="btn small" type="submit">Add card</button>
        </form></div></section>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/aistudy.js" defer></script>
  <script src="/study.js" defer></script>`;
  return layout({ title: 'Study hub', body, session });
}

export function studyDeckPage(ctx, deckId) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:760px" id="main" data-deck="${esc(deckId)}">
    <p class="crumb"><a href="/study">Study hub</a> › <span id="deck-crumb">Deck</span></p>
    <h1 id="deck-title" style="font-family:var(--disp)">Loading deck…</h1>
    <p id="deck-desc" style="color:var(--mut)"></p>
    <div class="seg" role="group" aria-label="Study mode" style="margin:12px 0">
      <button class="seg-btn is-on" data-mode="flip" aria-pressed="true">Flashcards</button>
      <button class="seg-btn" data-mode="learn" aria-pressed="false">Learn</button>
      <button class="seg-btn" data-mode="test" aria-pressed="false">Test</button>
    </div>
    <div id="study-area"></div>
  </div>
  <script src="/study.js" defer></script>`;
  return layout({ title: 'Study deck', body, session });
}

export function requestPage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:640px" id="main">
    <p class="crumb"><a href="/">Home</a> › Request a resource</p>
    <h1 style="font-family:var(--disp)">Request a resource</h1>
    <p style="color:var(--mut)">Tell us what's missing — an administrator reviews every request. Please don't include personal details.</p>
    <p style="color:var(--mut)">Tip: <a class="link-btn" href="/search">search the collection first</a> — your resource may already be here under a different title.</p>
    <form id="request-form" style="display:grid;gap:10px;margin-top:12px">
      <input id="req-title" required minlength="4" maxlength="200" placeholder="What are you looking for? (e.g. 2023 ACER verbal reasoning)" style="padding:11px;border-radius:10px;border:1px solid var(--line2);background:var(--panel);color:inherit;font-size:15px">
      <textarea id="req-detail" rows="4" maxlength="1000" placeholder="Extra detail (optional)" style="padding:11px;border-radius:10px;border:1px solid var(--line2);background:var(--panel);color:inherit"></textarea>
      <div><button class="btn" type="submit">Send request</button> <span id="req-msg" style="font-size:13px"></span></div>
    </form>
  </div>
  <script src="/request.js" defer></script>`;
  return layout({ title: 'Request a resource', body, session });
}

export function taxonomyPage(ctx, kind) {  const { db, session } = ctx;
  const where = `visibility = 1 AND file_type != 'folder' AND category != 'folder'`;
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
  const n = db.prepare(`SELECT COUNT(*) AS n FROM resources WHERE visibility = 1 AND file_type != 'folder' AND category != 'folder'`).get().n;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:760px" id="main">
    <h1 style="font-family:var(--disp)">About this directory</h1>
    <p style="color:var(--mut)">A searchable collection of ${Number(n).toLocaleString()} selective-entry study resources — practice papers, notes, flashcards, mocks and study guides. Free for anyone studying, no account needed. Search runs on our own index; opening a resource takes you to its hosted file.</p>
    <h2 style="font-size:16px;margin-top:24px">Access</h2>
    <p style="color:var(--mut)">Every resource is open to everyone — no account, no login. You will be asked to accept the Terms &amp; Conditions when you open your first resource in each browser tab.</p>
    <h2 style="font-size:16px;margin-top:24px">Privacy &amp; cookies</h2>
    <p style="color:var(--mut)">We use cookies and local storage to remember your theme, library, decks and study progress. We don't sell personal data and we don't run third-party advertising. Anonymous usage counts (resource opens, searches) auto-delete after 30 days. Your library and progress stay in your own browser unless you choose to export them — clearing site data removes them.</p>
    <p style="color:var(--mut)">Admin sign-in uses a per-tab token (closing the tab locks it again). Contact the site operator if you want your data removed.</p></div>`;
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

// ---- native SEHS prep pages (server-only, files + native banks) ----
export function examGuidePage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:860px" id="main">
    <p class="crumb"><a href="/">Home</a> › Exam guide</p>
    <h1 style="font-family:var(--disp)">SEHS exam guide (ACER 2026 format)</h1>
    <p style="color:var(--mut)">Year 8 → Year 9 entry. Three timed blocks, 2h 35m of tasks, ~4h on the day. Year-8 curriculum cap, no calculator, paper booklets.</p>
    <section class="disc-section"><div class="disc-head"><h2>The three blocks</h2></div>
      <div class="disc-grid">
        <div class="disc-tile"><h3>Block 1 — Maths + Quant (60 min)</h3><p>Curriculum maths (number, algebra, geometry, stats) + patterns, series, matrices, Venn, spatial. ~90s/Q. Two passes: easy first, mark-and-return.</p><a class="btn small" href="/mocks/maths-qr-60">Start block →</a></div>
        <div class="disc-tile"><h3>Block 2 — Reading + Verbal (55 min)</h3><p>6-8 passages + analogies, synonyms, odd-one-out, codes, deductions. ~44s/Q in 2026 (75Q). Evidence-pointer for reading.</p><a class="btn small" href="/mocks/reading-vr-55">Start block →</a></div>
        <div class="disc-tile"><h3>Block 3 — Writing (40 min)</h3><p>2 handwritten tasks (~20 min each), usually persuasive + narrative. 5 plan / 13 write / 2 check.</p><a class="btn small" href="/writing">Writing studio →</a></div>
      </div></section>
    <section class="disc-section"><div class="disc-head"><h2>Schools</h2></div>
      <div class="disc-sub">
        <div class="disc-tile"><h3>Melbourne High</h3><p>Boys, South Yarra.</p></div>
        <div class="disc-tile"><h3>Mac.Robertson Girls'</h3><p>Girls, Melbourne.</p></div>
        <div class="disc-tile"><h3>Nossal</h3><p>Co-ed, Berwick.</p></div>
        <div class="disc-tile"><h3>Suzanne Cory</h3><p>Co-ed, Werribee.</p></div>
      </div></section>
    <section class="disc-section"><div class="disc-head"><h2>12-week plan</h2></div>
      <div class="disc-tile"><p style="color:var(--mut)">Wk1-2: vocab foundation + maths facts + 1 diagnostic. Wk3-6: VR/QR one type per day + weekly mini. Wk7-10: full blocks timed + mistake bank. Wk11-12: 2 full mocks + writing 2×/week + taper. Crash (4wk): daily 30 vocab + 20 VR + 20 QR + 1 passage + 1 prompt plan.</p>
      <p><a class="link-btn" href="/study">Open study hub →</a> <a class="link-btn" href="/drills">Maths drills →</a></p></div></section>
    <section class="disc-section"><div class="disc-head"><h2>Ask about the exam</h2></div>
      <div class="disc-tile"><div style="display:flex;gap:8px"><input id="tutor-q" maxlength="800" placeholder="e.g. How do I pace the 55-min block?" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit" aria-label="Ask the tutor"><button class="btn small" id="tutor-go">Ask</button></div>
      <p id="tutor-a" style="white-space:pre-wrap;font-size:14px" hidden></p></div></section>
    <section class="disc-section"><div class="disc-head"><h2>FAQ</h2></div>
      <div class="disc-tile"><p><strong>Calculator?</strong> No.</p><p><strong>Question counts?</strong> ACER doesn't publish them — train to minutes, not counts.</p><p><strong>Writing?</strong> Usually 1 persuasive + 1 narrative in 40 min.</p><p><strong>Scoring?</strong> ~85% rank / 10% equity / 5% principal discretion.</p></div></section>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/tutor.js" defer></script>`;
  return layout({ title: 'SEHS exam guide', desc: 'ACER 3-block format, pacing, schools, plans.', body, active: '/exam-guide', session });
}

export function mocksPage(ctx) {  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px" id="main">
    <p class="crumb"><a href="/">Home</a> › Mocks</p>
    <h1 style="font-family:var(--disp)">Timed mocks</h1>
    <p style="color:var(--mut)">Exact block timing. Flag, skip, review. Instant scoring with explanations. Best scores stay in this browser.</p>
    <div class="disc-grid" id="mocks-grid"><div class="sk"><i style="height:16px;width:60%"></i></div></div>
  </div>
  <script src="/mocks.js" defer></script>`;
  return layout({ title: 'Timed mocks', body, active: '/mocks', session });
}

export function mockRunnerPage(ctx, id) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:860px" id="main" data-mock="${esc(id)}">
    <p class="crumb"><a href="/mocks">Mocks</a> › <span id="mock-crumb">${esc(id)}</span></p>
    <h1 id="mock-title" style="font-family:var(--disp)">Loading mock…</h1>
    <p id="mock-desc" style="color:var(--mut)"></p>
    <div id="mock-area"></div>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/mocks.js" defer></script>`;
  return layout({ title: 'Mock', body, active: '/mocks', session });
}

export function writingPage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:860px" id="main">
    <p class="crumb"><a href="/">Home</a> › Writing</p>
    <h1 style="font-family:var(--disp)">Writing studio</h1>
    <p style="color:var(--mut)">80 prompts (40 persuasive + 40 creative). 20:00 timer per task, word counter (target 250-350), 8-criteria self-rubric. Drafts stay in this browser.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
      <button class="btn small" id="prompt-random">Random prompt</button>
      <button class="btn small secondary" data-kind="persuasive">Persuasive</button>
      <button class="btn small secondary" data-kind="creative">Creative</button>
      <button class="btn small secondary" id="prompt-ai" title="Unlimited AI-written prompts">✦ New AI prompt</button>
    </div>
    <div class="disc-tile" id="prompt-card"><h3 id="prompt-title">Pick a prompt to start</h3><p id="prompt-stim" style="color:var(--mut)"></p><p id="prompt-plan" style="color:var(--faint);font-size:13px"></p></div>
    <div style="display:flex;gap:12px;align-items:center;margin:14px 0;flex-wrap:wrap">
      <div id="write-timer" style="font-family:var(--disp);font-size:28px;font-weight:800">20:00</div>
      <button class="btn small secondary" id="timer-start">Start</button>
      <button class="btn small secondary" id="timer-reset">Reset</button>
      <span id="word-count" style="color:var(--mut)">0 words</span>
    </div>
    <textarea id="write-box" rows="12" placeholder="Write here…" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line2);background:var(--panel);color:inherit"></textarea>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
      <button class="btn small" id="ai-feedback">Get AI feedback</button>
      <button class="btn small secondary" id="ai-grade">Grade my writing</button>
      <span style="color:var(--faint);font-size:12px">Optional · free shared AI · don't include your name · ~20s between requests</span>
    </div>
    <div class="disc-tile" id="ai-out" hidden style="margin-top:10px"><h3>AI feedback</h3><p id="ai-text" style="white-space:pre-wrap"></p></div>
    <div class="disc-tile" id="grade-out" hidden style="margin-top:10px"><h3>Grade</h3><div id="grade-bars"></div><p id="grade-note" style="color:var(--mut);font-size:13px"></p></div>
    <section class="disc-section"><div class="disc-head"><h2>Self-rubric (tick before you finish)</h2></div>
      <div class="disc-tile" id="rubric">
        <label class="check-row"><input type="checkbox"> <span>Clear position / story problem by line 5</span></label>
        <label class="check-row"><input type="checkbox"> <span>Paragraphs: 1 idea each, linked</span></label>
        <label class="check-row"><input type="checkbox"> <span>2+ persuasive devices / 3+ senses (creative)</span></label>
        <label class="check-row"><input type="checkbox"> <span>Varied sentences (short punch + long flow)</span></label>
        <label class="check-row"><input type="checkbox"> <span>Precise vocab (no repeats)</span></label>
        <label class="check-row"><input type="checkbox"> <span>Spelling + punctuation checked</span></label>
      </div></section>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/writing.js" defer></script>`;
  return layout({ title: 'Writing studio', body, active: '/writing', session });
}

export function readingPage(ctx) {
  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:860px" id="main">
    <p class="crumb"><a href="/">Home</a> › Reading</p>
    <h1 style="font-family:var(--disp)">Reading studio</h1>
    <p style="color:var(--mut)">Built-in passages plus unlimited AI-written passages with questions. <span id="read-score" style="font-weight:700">Session: 0/0</span></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0" id="read-list"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:center">
      <select id="read-genre" aria-label="Genre" style="padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit">
        <option value="">Any genre (rotates)</option>
        <option value="fiction">Fiction</option>
        <option value="nonfiction">Non-fiction</option>
        <option value="opinion">Opinion</option>
        <option value="poetry">Poetry</option>
        <option value="informational">Informational</option>
      </select>
      <button class="btn small" id="read-ai">✦ New AI passage</button>
    </div>
    <div id="read-area"></div>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/reading.js" defer></script>`;
  return layout({ title: 'Reading studio', body, active: '/reading', session });
}

export function drillsPage(ctx) {  const { session } = ctx;
  const body = `<div class="wrap" style="padding:28px 20px 40px;max-width:860px" id="main">
    <p class="crumb"><a href="/">Home</a> › Drills</p>
    <h1 style="font-family:var(--disp)">Maths drills (infinite)</h1>
    <p style="color:var(--mut)">Generative Year-8 drills with instant working: fractions, %, algebra, angles, BODMAS, sequences. Streak stays in this browser.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0" id="drill-kinds">
      <button class="btn small" data-drill="fraction">Fractions</button>
      <button class="btn small secondary" data-drill="percent">Percent</button>
      <button class="btn small secondary" data-drill="algebra">Algebra</button>
      <button class="btn small secondary" data-drill="bodmas">BODMAS</button>
      <button class="btn small secondary" data-drill="sequence">Sequences</button>
      <button class="btn small secondary" id="drill-ai" title="Fresh AI-written set at your level">✦ AI set</button>
    </div>
    <div class="disc-tile" id="drill-card"><h3 id="drill-q">Pick a drill to start</h3><p id="drill-a" style="color:var(--mut)"></p>
      <div style="display:flex;gap:8px;margin-top:10px"><input id="drill-in" placeholder="Your answer" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit"><button class="btn small" id="drill-check">Check</button><button class="btn small secondary" id="drill-next">Next</button></div>
      <p id="drill-msg" style="font-size:13px"></p></div>
  </div>
  <script src="/ai.js" defer></script>
  <script src="/drills.js" defer></script>`;
  return layout({ title: 'Maths drills', body, active: '/drills', session });
}
