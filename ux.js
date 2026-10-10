// Everyday quality-of-life: density, bookmarks, recents, back-to-top, shortcuts,
// copy-link buttons, client-side facet search, scroll progress, reveal on scroll.
// Browser storage only (cookies + local storage).
(function () {
  'use strict';
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
      return true;
    } catch (e) { return false; }
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* scroll progress */
  var prog = document.getElementById('scroll-progress');
  function syncProg() {
    if (!prog) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    prog.style.width = max > 0 ? (100 * h.scrollTop / max).toFixed(2) + '%' : '0';
  }
  window.addEventListener('scroll', syncProg, { passive: true });
  syncProg();

  /* reveal on scroll for cards + tiles */
  var revealIO = null;
  try {
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
  } catch (e) { revealIO = null; }
  function armReveals(root) {
    if (!revealIO) return;
    (root || document).querySelectorAll('.card, .disc-tile').forEach(function (el) {
      if (!el.classList.contains('reveal') && !el.classList.contains('in')) {
        el.classList.add('reveal');
        revealIO.observe(el);
      }
    });
  }
  armReveals(document);
  // cards injected later (mocks/decks/hydration) get revealed too
  var mo = null;
  try {
    mo = new MutationObserver(function () { armReveals(document); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) { /* older browser: skip */ }

  /* press feedback for every button */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn, .icon-btn, .quick-chip, .seg-btn');
    if (b) b.style.transform = 'scale(.97)';
  }, { passive: true });
  document.addEventListener('pointerup', function (e) {
    var b = e.target.closest && e.target.closest('.btn, .icon-btn, .quick-chip, .seg-btn');
    if (b) b.style.transform = '';
  }, { passive: true });

  /* density */
  var dens = store('sehs-density') || 'comfortable';
  if (dens === 'compact') document.body.classList.add('compact');
  function syncDens(btn) { if (btn) btn.textContent = document.body.classList.contains('compact') ? 'Comfortable' : 'Compact'; }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#density-toggle')) {
      var c = document.body.classList.toggle('compact');
      store('sehs-density', c ? 'compact' : 'comfortable');
      syncDens(e.target.closest('#density-toggle'));
      toast(c ? 'Compact rows on' : 'Comfortable cards on');
    }
  });

  /* bookmarks */
  function saved() {
    try { return JSON.parse(store('sehs-saved') || '[]'); } catch (e) { return []; }
  }
  function setSaved(list) { store('sehs-saved', JSON.stringify(list.slice(0, 500))); paintSaved(); }
  function paintSaved() {
    var s = new Set(saved());
    document.querySelectorAll('[data-save]').forEach(function (b) {
      var on = s.has(b.getAttribute('data-save'));
      b.textContent = on ? '★ Saved' : '☆ Save';
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    var n = document.getElementById('saved-count');
    if (n) { n.textContent = s.size; n.hidden = s.size === 0; }
  }
  // recently viewed (record pages expose data-record-id on body or main)
  function pushRecent(id, title) {
    if (!id) return;
    var list = [];
    try { list = JSON.parse(store('sehs-recent') || '[]'); } catch (e) { list = []; }
    list = [{ id: id, title: title || id, at: Date.now() }].concat(list.filter(function (x) { return x.id !== id; })).slice(0, 12);
    store('sehs-recent', JSON.stringify(list));
  }
  var recMain = document.querySelector('[data-record-id]');
  if (recMain) {
    pushRecent(recMain.getAttribute('data-record-id'), document.title.replace(/ — SEHS.*$/, ''));
    if (window.__sehsInsights && window.__sehsInsights.bump) window.__sehsInsights.bump('opens');
  }

  document.addEventListener('click', function (e) {
    var sv = e.target.closest && e.target.closest('[data-save]');
    if (sv) {
      var id = sv.getAttribute('data-save');
      var list = saved();
      if (list.includes(id)) { list = list.filter(function (x) { return x !== id; }); toast('Removed from saved'); }
      else { list.unshift(id); toast('Saved — find it under Saved'); }
      setSaved(list);
      if (window.__sehsInsights && window.__sehsInsights.bump) window.__sehsInsights.bump('saves');
      return;
    }
    var cp = e.target.closest && e.target.closest('[data-copylink]');
    if (cp) {
      var url = new URL(cp.getAttribute('data-copylink'), location.origin).href;
      var done = function () { toast('Link copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
      else done();
      return;
    }
    // record-page copy button uses an id in some templates
    if (e.target.closest && e.target.closest('#copy-link')) {
      var done2 = function () { toast('Link copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done2, done2);
      else done2();
    }
  });

  /* back to top */
  var toTop = document.getElementById('to-top');
  function syncTop() { if (toTop) toTop.hidden = window.scrollY < 600; }
  window.addEventListener('scroll', syncTop, { passive: true });
  syncTop();
  if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* shortcuts overlay */
  var sc = document.getElementById('shortcuts-modal');
  function scOpen() { if (sc) { sc.hidden = false; var x = document.getElementById('shortcuts-x'); if (x) x.focus(); } }
  function scClose() { if (sc) sc.hidden = true; }
  document.addEventListener('keydown', function (e) {
    if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); scOpen(); }
    if (e.key === 'Escape' && sc && !sc.hidden) scClose();
  });
  document.addEventListener('click', function (e) {
    if (!sc || sc.hidden) return;
    if ((e.target.closest && e.target.closest('#shortcuts-x')) || e.target === sc) scClose();
  });

  /* client-side facet search */
  document.addEventListener('input', function (e) {
    if (!e.target.matches || !e.target.matches('.facet-search')) return;
    var q = e.target.value.toLowerCase().trim();
    var list = e.target.closest('.f-section').querySelectorAll('.check-row');
    list.forEach(function (row) {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  /* animated stat count-ups (respects reduced motion) */
  function countups() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('[data-countup]').forEach(function (el) {
      if (el._counted) return;
      el._counted = true;
      var target = Number(el.getAttribute('data-countup')) || 0;
      if (target <= 0) return;
      var t0 = null, dur = 900;
      function frame(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (k < 1) requestAnimationFrame(frame);
      }
      try {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { io.disconnect(); requestAnimationFrame(frame); }
          });
        });
        io.observe(el);
      } catch (e) { requestAnimationFrame(frame); }
    });
  }

  /* saved page + recents strip hydration via /api/by-ids */
  function cardHtml(v) {
    var title = esc(v.displayTitle || v.title || 'Untitled');
    return '<article class="card"><div class="card-body"><h3><a href="/r/' + esc(v.id) + '">' + title +
      '</a></h3><div class="meta-row"><span class="badge">' + esc(v.fileType || v.file_type || 'File') + '</span>' +
      (v.answersIncluded ? '<span class="badge ans">Answers included</span>' : '') +
      '</div><div class="card-foot"><span class="date"></span><span><button class="btn small secondary" data-save="' + esc(v.id) + '">☆ Save</button>' +
      '<a class="btn small" href="/r/' + esc(v.id) + '">Details →</a></span></div></div></article>';
  }
  function hydrateIds(el, ids) {
    if (!el) return;
    if (!ids.length) { el.innerHTML = '<p style="color:var(--mut)">Nothing here yet — tap ☆ Save on any resource and it will show up here.</p>'; return; }
    el.innerHTML = '<div class="sk"><i style="height:16px;width:60%"></i><i style="height:12px;width:90%;margin-top:10px"></i></div>';
    fetch('/api/by-ids?ids=' + encodeURIComponent(ids.slice(0, 100).join(',')))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.results || !j.results.length) { el.innerHTML = '<p style="color:var(--mut)">Those saved items are no longer available.</p>'; return; }
        el.innerHTML = j.results.map(cardHtml).join('');
        paintSaved();
        armReveals(el);
      }).catch(function () { el.innerHTML = '<p style="color:var(--mut)">Could not load saved items — check your connection.</p>'; });
  }
  var savedGrid = document.getElementById('saved-grid');
  if (savedGrid) hydrateIds(savedGrid, saved());
  var recentStrip = document.getElementById('recent-strip');
  if (recentStrip) {
    var rec = [];
    try { rec = JSON.parse(store('sehs-recent') || '[]'); } catch (e) { rec = []; }
    if (rec.length) {
      recentStrip.hidden = false;
      var fb0 = document.getElementById('recent-fallback');
      if (fb0) fb0.hidden = true;
      hydrateIds(document.getElementById('recent-grid'), rec.map(function (x) { return x.id; }));
    }
  }

  /* sidebar drawer (mobile) */
  (function sideDrawer() {
    var btn = document.getElementById('side-toggle');
    var side = document.getElementById('side');
    var scrim = document.getElementById('side-scrim');
    if (!btn || !side) return;
    function set(open) {
      side.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (scrim) scrim.hidden = !open;
    }
    btn.addEventListener('click', function () { set(!side.classList.contains('open')); });
    if (scrim) scrim.addEventListener('click', function () { set(false); });
    side.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a') && window.innerWidth <= 960) set(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  })();

  /* avatar: local profile initial + quick menu (no account needed) */
  (function avatar() {
    var b = document.getElementById('avatar-btn');
    if (!b) return;
    var name = null;
    try { name = localStorage.getItem('sehs-name') || null; } catch (e) {}
    b.textContent = (name ? name.trim()[0] : 'G').toUpperCase();
    b.addEventListener('click', function () {
      var cur = null;
      try { cur = localStorage.getItem('sehs-name') || ''; } catch (e) {}
      var next = prompt('Display name (stored only in this browser):', cur || '');
      if (next === null) return;
      next = String(next).trim().slice(0, 24);
      try {
        if (next) localStorage.setItem('sehs-name', next);
        else localStorage.removeItem('sehs-name');
      } catch (e) {}
      b.textContent = (next ? next[0] : 'G').toUpperCase();
      toast(next ? 'Hi, ' + next : 'Profile cleared');
    });
  })();

  /* cookie notice: one tap, remembered in this browser */
  (function cookies() {
    var ok = null;
    try { ok = localStorage.getItem('sehs-cookie-ok'); } catch (e) { ok = '1'; }
    if (ok) return;
    var bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>We use cookies + local storage to remember your theme, library and progress.</span>' +
      '<span style="display:flex;gap:8px"><a class="link-btn" style="color:inherit" href="/about">Details</a>' +
      '<button class="btn small" id="cookie-ok">Got it</button></span>';
    document.body.appendChild(bar);
    document.getElementById('cookie-ok').addEventListener('click', function () {
      try { localStorage.setItem('sehs-cookie-ok', '1'); } catch (e) {}
      bar.remove();
    });
  })();

  paintSaved();
  countups();
  var dt = document.getElementById('density-toggle');
  syncDens(dt);
  // new arrivals shelf (landing)
  (function newArrivals() {
    var grid = document.getElementById('new-grid');
    if (!grid) return;
    fetch('/api/new').then(function (r) { return r.json(); }).then(function (j) {
      if (!j.results || !j.results.length) { grid.innerHTML = '<p style="color:var(--mut)">Nothing new yet — check back after the next dataset update.</p>'; return; }
      grid.innerHTML = j.results.map(cardHtml).join('');
      paintSaved();
      armReveals(grid);
    }).catch(function () { grid.innerHTML = ''; });
  })();
  // site announcement banner (public feed, dismissible per version)
  (function announcement() {
    fetch('/api/announcement').then(function (r) { return r.json(); }).then(function (j) {
      if (!j.body) return;
      var seen = null;
      try { seen = localStorage.getItem('sehs-ann-seen'); } catch (e) {}
      var key = String(j.body).slice(0, 120);
      if (seen === key) return;
      var main = document.getElementById('main');
      if (!main) return;
      var bar = document.createElement('div');
      bar.className = 'notice';
      bar.setAttribute('role', 'status');
      bar.style.margin = '12px 20px 0';
      bar.innerHTML = '<span></span> <button class="link-btn" id="ann-hide">Dismiss</button>';
      bar.querySelector('span').textContent = j.body;
      main.before(bar);
      document.getElementById('ann-hide').addEventListener('click', function () {
        try { localStorage.setItem('sehs-ann-seen', key); } catch (e) {}
        bar.remove();
      });
    }).catch(function () { /* offline: skip */ });
  })();
})();
