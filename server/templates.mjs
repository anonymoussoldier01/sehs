// Server-rendered HTML: shared layout + components. All dynamic values escaped.
import { fmtBytes } from './content.mjs';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const NAV = [['/', 'Home'], ['/search', 'Browse'], ['/subjects', 'Subjects'], ['/providers', 'Providers'], ['/about', 'About']];

export function layout({ title, desc = '', body, active = '', session = null, extraHead = '' }) {
  // No per-visitor state on the server (no cookies): the header always shows
  // a neutral Admin link; admin.js reveals state once a bearer token exists.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — SEHS Study Directory</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
<meta name="theme-color" content="#4f46e5">
<link rel="icon" href="https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
${extraHead}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar" role="banner">
  <div class="wrap topbar-inner">
    <a class="brand" href="/" aria-label="SEHS Study Directory home">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="28" height="28"><rect x="2" y="2" width="28" height="28" rx="8" fill="#4f46e5"/><path d="M10 12.5A6 6 0 0 1 22 12.5c0 4-4.5 4.5-4.5 8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="17.5" cy="23.5" r="1.6" fill="#fff"/></svg></span>
      <span class="brand-text"><strong>SEHS Study Directory</strong><small>Practice papers · notes · study resources</small></span>
    </a>
    <nav class="topnav" aria-label="Sections">
      ${NAV.map(([h, l]) => `<a href="${h}"${active === h ? ' aria-current="page" class="on"' : ''}>${l}</a>`).join('')}
    </nav>
    <div class="top-actions">
      <button id="filters-toggle" class="btn secondary only-mobile" aria-expanded="false" aria-controls="filters" hidden>Filters</button>
      <a class="btn secondary small" href="/unlock">Admin</a>
      <button id="theme-toggle" class="icon-btn" title="Toggle dark mode" aria-label="Toggle dark mode" aria-pressed="false">◐</button>
    </div>
  </div>
</header>
<main id="main">${body}</main>
<footer class="wrap foot">
  <div class="about">
    <h2>About this directory</h2>
    <p>A searchable collection of SEHS selective-entry study resources. Search runs on our index — opening a resource takes you to its hosted file.</p>
  </div>
  <div class="foot-actions"><a class="link-btn" href="/about">About</a><a class="link-btn" href="/saved">Saved</a><a class="link-btn" href="/unlock">Admin</a></div>
</footer>
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
<script src="/ux.js" defer></script>
<script src="/suggest.js" defer></script>
</body>
</html>`;
}

export function pretty(s) {
  return String(s || '').split(/[-_\s]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const TYPE_LABEL = { pdf: 'PDF', docx: 'Word', image: 'Image', folder: 'Folder', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'File' };
const TYPE_CLASS = { pdf: 'fi-pdf', docx: 'fi-docx', image: 'fi-image', folder: 'fi-folder', archive: 'fi-archive', webpage: 'fi-webpage', code: 'fi-code', other: 'fi-other' };

export function typeTile(t) {
  const abbr = { pdf: 'PDF', docx: 'DOC', image: 'IMG', folder: 'DIR', archive: 'ZIP', webpage: 'WEB', code: 'CODE', other: 'FILE' }[t] || 'FILE';
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
  const size = v.sizeBytes ? ` · ${fmtBytes(v.sizeBytes)}` : '';
  const year = v.year ? ` · ${esc(v.year)}` : '';
  const tags = (v.tags || []).slice(0, 4).map(t => `<span class="tagstatic">${esc(pretty(t))}</span>`).join('');
  return `<article class="card" data-id="${esc(v.id)}">
    ${typeTile(v.fileType)}
    <div class="card-body">
      <h3><a href="/r/${esc(v.id)}">${highlight(displayTitle, tokens)}</a></h3>
      <div class="meta-row"><span class="crumb">${esc(subj)}${v.provider ? ` › ${esc(pretty(v.provider))}` : ''}</span></div>
      ${showDesc && v.description ? `<p class="desc">${highlight(v.description, tokens)}</p>` : ''}
      <div class="meta-row">
        <span class="badge">${esc(TYPE_LABEL[v.fileType] || v.fileType)}</span>
        ${v.answersIncluded ? `<span class="badge ans">Answers included</span>` : ''}
        ${v.status && v.status !== 'available' ? `<span class="badge st-${esc(v.status === 'needs_verification' ? 'unknown' : v.status)}">● ${esc(pretty(v.status))}</span>` : ''}
        <span class="filemeta">${esc(TYPE_LABEL[v.fileType] || '')}${size}${year}</span>
      </div>
      ${tags ? `<div class="meta-row">${tags}</div>` : ''}
      <div class="card-foot">
        <span class="date">${v.year ? esc(v.year) : ''}${v.sizeBytes ? ` · ${fmtBytes(v.sizeBytes)}` : ''}</span>
        <span><button class="btn small secondary" data-save="${esc(v.id)}" aria-label="Save ${esc(displayTitle)}" title="Save">☆</button>
        <button class="btn small secondary" data-copylink="/r/${esc(v.id)}" aria-label="Copy link">⧉</button>
        <a class="btn small secondary" href="/r/${esc(v.id)}">Details</a>
        <button class="btn small" data-open="${esc(v.id)}">Open resource →</button></span>
      </div>
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

export const QUICK = [['vsse', 'VSSE'], ['maths answers', 'Maths + answers'], ['numerical reasoning', 'Numerical'], ['reading comprehension', 'Reading'], ['capricorn practice paper', 'Capricorn papers']];
