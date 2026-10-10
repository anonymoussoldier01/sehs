// Server-rendered HTML: shared layout + components. All dynamic values escaped.
import { fmtBytes } from './content.mjs';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SIDE_MAIN = [
  ['/', 'Home', '⌂'],
  ['/saved', 'Your library', '▤'],
  ['/search', 'Browse', '⚲'],
  ['/search?type=pdf', 'PDF papers', '❏'],
  ['/study', 'Study hub', '✎'],
];
const SIDE_START = [
  ['/study', 'Flashcards', '▢'],
  ['/mocks', 'Timed mocks', '◷'],
  ['/exam-guide', 'Study guides', '≡'],
  ['/drills', 'Games & drills', '▦'],
  ['/writing', 'Writing studio', '✒'],
  ['/reading', 'Reading room', '☰'],
];
const SIDE_MORE = [
  ['/subjects', 'Subjects', '○'],
  ['/providers', 'Providers', '○'],
  ['/request', 'Request', '＋'],
  ['/about', 'About', 'ⓘ'],
];

function sideLink(h, l, ico, active) {
  const on = active === h || (h !== '/' && String(active || '').startsWith(h + '/'));
  return `<a class="side-link${on ? ' on' : ''}" href="${h}"${on ? ' aria-current="page"' : ''}><span class="side-ico" aria-hidden="true">${ico}</span>${l}</a>`;
}

export function layout({ title, desc = '', body, active = '', session = null, extraHead = '' }) {
  // Per-tab admin token lives in sessionStorage; the shell always renders the
  // same neutral links. Progress + library live in the browser (cookies +
  // local storage) — see the cookie notice + /about.
  const q = '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — SEHS Study Directory</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
<meta name="theme-color" content="#15132e">
<link rel="icon" href="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icon.svg">
<meta name="mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script type="speculationrules">{"prerender": [{"source": "document", "where": {"and": [{"href_matches": "/*"}, {"not": {"href_matches": ["/open/*", "/api/*", "/admin*"]}}]}, "eagerness": "moderate"}]}</script>
${extraHead}
</head>
<body>
<div id="scroll-progress" aria-hidden="true"></div>
<a class="skip" href="#main">Skip to content</a>
<div class="app">
  <aside class="side" id="side" aria-label="Primary">
    <a class="brand side-brand" href="/" aria-label="SEHS Study Directory home">
      <span class="brand-mark" aria-hidden="true">Q</span>
      <span class="brand-text"><strong>SEHS Study</strong><small>Flashcards · mocks · papers</small></span>
    </a>
    <nav class="side-nav" aria-label="Sections">
      ${SIDE_MAIN.map(([h, l, i]) => sideLink(h, l, i, active)).join('')}
      <p class="side-h">Start here</p>
      ${SIDE_START.map(([h, l, i]) => sideLink(h, l, i, active)).join('')}
      <p class="side-h">More</p>
      ${SIDE_MORE.map(([h, l, i]) => sideLink(h, l, i, active)).join('')}
    </nav>
    <div class="side-foot">
      <a class="side-new" href="/saved#list-new">＋ New folder</a>
      <div id="side-lists"></div>
      <p class="side-note">Progress saves in this browser.</p>
    </div>
  </aside>
  <div class="drawer-scrim" id="side-scrim" hidden></div>
  <div class="app-main">
    <header class="topbar" role="banner">
      <div class="wrap topbar-inner">
        <button id="side-toggle" class="icon-btn" aria-label="Open menu" aria-expanded="false">☰</button>
        <form class="topsearch" action="/search" method="get" role="search">
          <svg class="search-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input name="q" type="search" placeholder="Search papers, decks, topics…" autocomplete="off" aria-label="Search study resources" value="${esc(q)}">
        </form>
        <div class="top-actions">
          <button id="filters-toggle" class="btn secondary only-mobile" aria-expanded="false" aria-controls="filters" hidden>Filters</button>
          <button id="palette-open" class="icon-btn" title="Quick search (Ctrl+K)" aria-label="Quick search">⌘K</button>
          <button id="avatar-btn" class="avatar" title="Your profile" aria-label="Your profile">G</button>
          <button id="theme-toggle" class="icon-btn" title="Toggle light / dark" aria-label="Toggle light and dark mode" aria-pressed="false">◐</button>
        </div>
      </div>
    </header>
    <main id="main">${body}</main>
    <footer class="wrap foot">
      <div class="about">
        <h2>About this directory</h2>
        <p>A searchable collection of selective-entry study resources — past papers, notes, flashcards, mocks and guides. Free for anyone studying, no account needed.</p>
        <p class="foot-meta">We use cookies + local storage to remember your theme, library and progress. Anonymous usage counts auto-delete after 30 days. <a class="link-btn" href="/about">Privacy &amp; cookies</a></p>
      </div>
      <div class="foot-actions"><a class="link-btn" href="/about">About</a><a class="link-btn" href="/saved">Library</a><a class="link-btn" href="/study">Study hub</a><a class="link-btn" href="/request">Request</a><a class="link-btn" href="/unlock">Admin</a></div>
    </footer>
  </div>
</div>
<div class="modal-backdrop" id="terms-modal" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
    <h2 id="terms-title">Terms &amp; Conditions <span id="terms-version" style="font-size:13px;color:var(--faint)"></span></h2>
    <p id="terms-summary" style="color:var(--mut);font-weight:600"></p>
    <div id="terms-body" style="max-height:40vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:13.5px;color:var(--mut)"></div>
    <label class="check-row" style="margin-top:12px"><input type="checkbox" id="terms-agree"> <span>I have read and agree to these Terms &amp; Conditions</span></label>
    <div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
      <button class="btn" id="terms-accept">Accept &amp; continue</button>
      <button class="btn secondary" id="terms-decline">Decline</button>
    </div>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<button id="to-top" class="icon-btn" aria-label="Back to top" title="Back to top" hidden>↑</button>
<div class="modal-backdrop" id="shortcuts-modal" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sc-title" style="max-width:440px">
    <button class="icon-btn modal-x" id="shortcuts-x" aria-label="Close">✕</button>
    <h2 id="sc-title">Keyboard shortcuts</h2>
    <dl class="kv">
      <dt><kbd>/</kbd></dt><dd>Focus search</dd>
      <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move through suggestions</dd>
      <dt><kbd>Enter</kbd></dt><dd>Open highlighted suggestion / search</dd>
      <dt><kbd>Esc</kbd></dt><dd>Close menus and dialogs</dd>
      <dt><kbd>?</kbd></dt><dd>This panel</dd>
    </dl>
  </div>
</div>
<script src="/theme.js" defer></script>
<script src="/gate.js" defer></script>
<script src="/open.js" defer></script>
<script src="/request.js" defer></script>
<script src="/ux.js" defer></script>
<script src="/pwa.js" defer></script>
<script src="/suggest.js" defer></script>
<script src="/profile.js" defer></script>
<script src="/palette.js" defer></script>
<script src="/lists.js" defer></script>
<script src="/insights.js" defer></script>
<script src="/confetti.js" defer></script>
</body>
</html>`;
}

export function pretty(s) {
  const ACR = { vsse: 'VSSE', acer: 'ACER', vcaa: 'VCAA', naplan: 'NAPLAN' };
  return String(s || '').split(/[-_\s]/).filter(Boolean).map(w => ACR[w.toLowerCase()] || w[0].toUpperCase() + w.slice(1)).join(' ');
}

const TYPE_LABEL = { pdf: 'PDF', docx: 'Word', image: 'Image', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'File' };
const TYPE_CLASS = { pdf: 'fi-pdf', docx: 'fi-docx', image: 'fi-image', archive: 'fi-archive', webpage: 'fi-webpage', code: 'fi-code', other: 'fi-other' };

export function typeTile(t) {
  const abbr = { pdf: 'PDF', docx: 'DOC', image: 'IMG', archive: 'ZIP', webpage: 'WEB', code: 'CODE', other: 'FILE' }[t] || 'FILE';
  return `<div class="file-ico ${TYPE_CLASS[t] || 'fi-other'}" aria-hidden="true">${abbr}</div>`;
}

// view = publicView(row) + displayTitle; tokens = highlight terms (already escaped-safe alnum)
export function highlight(text, tokens) {
  let out = esc(text);
  for (const t of (tokens || []).filter(x => x && x.length >= 2)) {
    try { out = out.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*)`, 'gi'), '<mark>$1</mark>'); } catch { /* noop */ }
  }
  return out;
}

export function resultRow(v, displayTitle, tokens = [], showDesc = true) {
  const subj = v.subject ? pretty(v.subject) : pretty(v.category);
  const tags = (v.tags || []).slice(0, 4).map(t => `<span class="tagstatic">${esc(pretty(t))}</span>`).join('');
  // skip descriptions that only echo the title ("1.1. Practice material.")
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tn = norm(displayTitle), dn = norm(v.description);
  const filler = /^(practice material|practice materials|worksheet|worksheets|homework|test|tests|notes?|study material|revision)$/;
  const echoDesc = dn === tn || (tn.length >= 2 && dn.startsWith(tn) && filler.test(dn.slice(tn.length).trim()));
  return `<article class="card" data-id="${esc(v.id)}">
    ${typeTile(v.fileType)}
    <div class="card-body">
      <h3><a href="/r/${esc(v.id)}">${highlight(displayTitle, tokens)}</a></h3>
      <div class="meta-row"><span class="crumb">${esc(subj)}${v.provider ? ` › ${esc(pretty(v.provider))}` : ''}</span></div>
      ${showDesc && v.description && !echoDesc ? `<p class="desc">${highlight(v.description, tokens)}</p>` : ''}
      <div class="meta-row">
        <span class="badge">${esc(TYPE_LABEL[v.fileType] || v.fileType)}</span>
        ${v.answersIncluded ? `<span class="badge ans">Answers included</span>` : ''}
        ${v.status && v.status !== 'available' ? `<span class="badge st-${esc(v.status === 'needs_verification' ? 'unknown' : v.status)}">● ${esc(pretty(v.status))}</span>` : ''}
      </div>
      ${tags ? `<div class="meta-row">${tags}</div>` : ''}
      <div class="card-foot">
        <span class="date">${v.year ? esc(v.year) : ''}${v.year && v.sizeBytes ? ' · ' : ''}${v.sizeBytes ? fmtBytes(v.sizeBytes) : ''}</span>
        <span class="card-btns"><button class="btn small secondary icon-only" data-save="${esc(v.id)}" aria-label="Save ${esc(displayTitle)}" title="Save">☆</button>
        <button class="btn small secondary icon-only" data-listadd="${esc(v.id)}" aria-label="Add to list" title="Add to list">+</button>
        <button class="btn small secondary icon-only" data-copylink="/r/${esc(v.id)}" aria-label="Copy link" title="Copy link">⧉</button>
        <a class="btn small secondary" href="/r/${esc(v.id)}">Details</a></span>
      </div>
      <button class="btn small open-full" data-open="${esc(v.id)}">${v.fileType === 'pdf' ? 'Open PDF →' : 'Open resource →'}</button>
    </div>
  </article>`;
}

export function pagerHtml(base, page, pages, total, per) {
  if (pages <= 1) {
    return `<div class="pager bottom"><span class="showing">Showing ${total} of ${total} resources</span></div>`;
  }
  const link = (p, label, cur = false, dis = false, aria = '') => dis
    ? `<button disabled>${label}</button>`
    : `<a href="${base}page=${p}"${cur ? ' class="cur" aria-current="page"' : ''}${aria ? ` aria-label="${aria}"` : ''}>${label}</a>`;
  const win = new Set([1, page - 1, page, page + 1, pages]);
  const sorted = [...win].filter(p => p >= 1 && p <= pages).sort((a, b) => a - b);
  let h = `<div class="pager bottom">` + link(Math.max(1, page - 1), '← Previous', false, page <= 1, 'Previous page');
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) h += `<span class="dots">…</span>`;
    h += link(p, String(p), p === page);
    prev = p;
  }
  h += link(Math.min(pages, page + 1), 'Next →', false, page >= pages, 'Next page');
  const from = (page - 1) * per + 1, to = Math.min(total, page * per);
  h += `<span class="showing">Showing ${from}–${to} of ${total}</span></div>`;
  return h;
}

export function emptyBlock({ title = 'No exact matches', msg = '', corrected = null, correctHref = '', chips = [] }) {
  return `<div class="empty">
    <div class="empty-ico" aria-hidden="true">🔍</div>
    <h2>${esc(title)}</h2>
    <p>${esc(msg)}</p>
    ${corrected ? `<div class="dym">Did you mean: <a href="${correctHref}">“${esc(corrected)}”</a>?</div>` : ''}
    <div class="empty-actions"><a class="btn" href="/search">Clear search &amp; filters</a></div>
    ${chips.length ? `<div class="empty-suggest"><span class="quick-label">Try:</span> ${chips.map(([q, l]) => `<a class="quick-chip" href="/search?q=${encodeURIComponent(q)}">${esc(l)}</a>`).join('')}</div>` : ''}
  </div>`;
}

export const QUICK = [['vsse', 'VSSE'], ['maths answers', 'Maths + answers'], ['numerical reasoning', 'Numerical'], ['reading comprehension', 'Reading'], ['verbal reasoning analogy', 'Verbal'], ['writing prompt', 'Writing'], ['exam guide', 'Exam guide'], ['vocab', 'Vocab']];
