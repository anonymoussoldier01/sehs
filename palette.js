// Command palette: Cmd/Ctrl+K — live results, taxonomy, recents, saved, actions.
(function () {
  'use strict';
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  var overlay = null, input = null, list = null, items = [], sel = -1, timer = null;
  function aff() { return (window.__sehsAff && window.__sehsAff()) || ''; }
  function build() {
    overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.id = 'palette';
    overlay.hidden = true;
    overlay.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Quick search" style="max-width:600px">' +
      '<input id="palette-q" type="search" placeholder="Search resources, subjects, actions…" autocomplete="off" aria-label="Quick search" ' +
      'style="width:100%;padding:12px 14px;border-radius:10px;border:1.5px solid var(--line2);background:var(--panel);color:inherit;font-size:16px">' +
      '<div id="palette-list" role="listbox" aria-label="Results" style="margin-top:10px;max-height:50vh;overflow:auto"></div>' +
      '<p style="color:var(--faint);font-size:12px;margin:10px 0 0">↑↓ navigate · Enter open · Esc close</p></div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('#palette-q');
    list = overlay.querySelector('#palette-list');
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(update, 110); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        sel = e.key === 'ArrowDown' ? (sel + 1) % items.length : (sel - 1 + items.length) % items.length;
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (sel >= 0 && items[sel]) go(items[sel]);
        else if (input.value.trim()) go({ kind: 'search', label: input.value.trim() });
      } else if (e.key === 'Escape') { close(); }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    list.addEventListener('mousedown', function (e) {
      var b = e.target.closest && e.target.closest('[data-pi]');
      if (b) { e.preventDefault(); go(items[Number(b.getAttribute('data-pi'))]); }
    });
  }
  function actions(q) {
    var a = aff();
    return [
      { kind: 'action', label: 'Search for "' + q + '"', href: '/search?q=' + encodeURIComponent(q) + (a ? '&aff=' + encodeURIComponent(a) : '') },
      { kind: 'action', label: 'Browse subjects', href: '/subjects' },
      { kind: 'action', label: 'Browse providers', href: '/providers' },
      { kind: 'action', label: 'Saved resources', href: '/saved' },
      { kind: 'action', label: 'Toggle theme', run: function () { var b = document.getElementById('theme-toggle'); if (b) b.click(); } },
      { kind: 'action', label: 'Copy share link', run: function () {
        var done = function () { toast('Link copied'); };
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
      } },
    ].filter(function (x) { return !q || x.label.toLowerCase().includes(q.toLowerCase()) || x.kind !== 'action' || x.label.indexOf('Search for') === 0; });
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2000);
  }
  function update() {
    var q = input.value.trim();
    var recents = [];
    try { recents = JSON.parse(localStorage.getItem('sehs-recent-searches') || '[]').filter(Boolean).slice(0, 3); } catch (e) {}
    var sugP = q.length >= 2
      ? fetch('/api/suggest?prefix=' + encodeURIComponent(q.split(/\s+/).pop().slice(0, 40)))
          .then(function (r) { return r.json(); }).then(function (j) { return (j.suggestions || []).slice(0, 5); }).catch(function () { return []; })
      : Promise.resolve([]);
    var resP = q.length >= 2
      ? fetch('/api/search?q=' + encodeURIComponent(q) + '&per=5' + (aff() ? '&aff=' + encodeURIComponent(aff()) : ''))
          .then(function (r) { return r.json(); }).then(function (j) { return (j.results || []).slice(0, 5); }).catch(function () { return []; })
      : Promise.resolve([]);
    Promise.all([sugP, resP]).then(function (parts) {
      var sugg = parts[0], res = parts[1];
      items = [];
      sugg.forEach(function (s) { items.push({ kind: s.kind, label: s.label, count: s.count }); });
      res.forEach(function (v) { items.push({ kind: 'resource', label: v.displayTitle || v.title, id: v.id }); });
      if (!q) recents.forEach(function (r) { items.push({ kind: 'recent', label: r }); });
      actions(q).forEach(function (a) { items.push(a); });
      sel = items.length ? 0 : -1;
      paint();
    });
  }
  function paint() {
    list.innerHTML = items.map(function (s, i) {
      var sub = s.kind === 'resource' ? '' : s.kind === 'action' ? '' : (s.count ? ' · ' + s.count : '');
      return '<button class="sugg' + (i === sel ? ' sel' : '') + '" role="option" data-pi="' + i + '" aria-selected="' + (i === sel) + '">' +
        '<span class="k">' + esc(s.kind) + '</span><span class="lbl">' + esc(s.label) + sub + '</span></button>';
    }).join('') || '<p style="color:var(--mut);padding:10px 14px">No matches — press Enter to search.</p>';
  }
  function go(s) {
    if (!s) return;
    if (s.run) { close(); s.run(); return; }
    if (s.href) { location.href = s.href; return; }
    if (s.kind === 'resource' && s.id) { location.href = '/r/' + s.id; return; }
    var a = aff();
    location.href = '/search?q=' + encodeURIComponent(s.label) + (a ? '&aff=' + encodeURIComponent(a) : '');
  }
  function open() {
    if (!overlay) build();
    overlay.hidden = false;
    input.value = '';
    update();
    setTimeout(function () { input.focus(); }, 30);
  }
  function close() { if (overlay) overlay.hidden = true; sel = -1; }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay && !overlay.hidden) close(); else open();
    }
    if (e.key === 'Escape' && overlay && !overlay.hidden) close();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#palette-open')) { e.preventDefault(); open(); }
  });
})();
