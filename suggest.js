// Autocomplete for server-rendered search boxes + recent searches.
// Suggestions come from /api/suggest (dataset-derived, tier-aware).
(function () {
  'use strict';
  var input = document.querySelector('input[name="q"]');
  if (!input) return;
  function consented() { return /(?:^|;\s*)sehs_consent=v1/.test(document.cookie || ''); }
  // build dropdown next to the search box
  var wrap = input.closest('.search-wrap') || input.parentElement;
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  var box = document.createElement('div');
  box.className = 'suggest';
  box.id = 'suggest';
  box.setAttribute('role', 'listbox');
  box.hidden = true;
  wrap.appendChild(box);
  var items = [], sel = -1, timer = null;

  function recents() {
    var out = [];
    if (!consented()) return out;
    try {
      var raw = localStorage.getItem('sehs-recent-searches') || '[]';
      out = JSON.parse(raw).filter(Boolean).slice(0, 4);
    } catch (e) { /* noop */ }
    return out;
  }
  function pushRecent(q) {
    if (!consented() || !q) return;
    try {
      var list = JSON.parse(localStorage.getItem('sehs-recent-searches') || '[]');
      list = [q].concat(list.filter(function (x) { return x !== q; })).slice(0, 8);
      localStorage.setItem('sehs-recent-searches', JSON.stringify(list));
    } catch (e) { /* noop */ }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function render(sugg, showRecent) {
    items = [];
    var html = '';
    if (showRecent && !input.value.trim()) {
      var rc = recents();
      if (rc.length) {
        html += '<div style="padding:6px 14px 2px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)">Recent</div>';
        rc.forEach(function (q) {
          items.push({ label: q, kind: 'recent' });
          html += '<button class="sugg" role="option" data-i="' + (items.length - 1) + '"><span class="k">↻</span><span class="lbl">' + esc(q) + '</span></button>';
        });
      }
    }
    sugg.forEach(function (s) {
      items.push(s);
      html += '<button class="sugg" role="option" data-i="' + (items.length - 1) + '"><span class="k">' + esc(s.kind) + '</span><span class="lbl">' + esc(s.label) + '</span>' +
        (s.count ? '<span class="c">' + s.count + '</span>' : '') + '</button>';
    });
    sel = -1;
    if (!html) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    box.innerHTML = html;
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    box.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); apply(Number(b.getAttribute('data-i'))); });
    });
  }
  function hide() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; }
  function apply(i) {
    var s = items[i];
    hide();
    if (!s) return;
    if (s.kind === 'resource') {
      // navigate via search for the exact title
      location.href = '/search?q=' + encodeURIComponent(s.label);
      return;
    }
    var parts = input.value.split(/\s+/);
    parts[parts.length - 1] = s.label;
    var q = (parts.join(' ') + ' ').replace(/^\s+/, '');
    pushRecent(q.trim());
    var form = input.closest('form');
    if (form) { input.value = q; form.submit(); }
    else location.href = '/search?q=' + encodeURIComponent(q.trim());
  }
  function fetchSugg() {
    var v = input.value;
    var last = v.split(/\s+/).pop() || '';
    if (document.activeElement !== input) { hide(); return; }
    if (!last || last.length < 2) { render([], true); return; }
    fetch('/api/suggest?prefix=' + encodeURIComponent(last.slice(0, 40)))
      .then(function (r) { return r.json(); })
      .then(function (j) { render((j && j.suggestions) || [], false); })
      .catch(function () { hide(); });
  }
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'suggest');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(fetchSugg, 90); });
  input.addEventListener('focus', fetchSugg);
  input.addEventListener('blur', function () { setTimeout(hide, 120); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      sel = e.key === 'ArrowDown' ? (sel + 1) % items.length : (sel - 1 + items.length) % items.length;
      box.querySelectorAll('.sugg').forEach(function (b, i) {
        b.classList.toggle('sel', i === sel);
        b.setAttribute('aria-selected', String(i === sel));
      });
    } else if (e.key === 'Enter' && sel >= 0 && items[sel]) {
      e.preventDefault();
      apply(sel);
    } else if (e.key === 'Escape') {
      hide();
    }
  });
  var form = input.closest('form');
  if (form) form.addEventListener('submit', function () { pushRecent(input.value.trim()); });
  document.addEventListener('sehs:consent', fetchSugg);
})();
