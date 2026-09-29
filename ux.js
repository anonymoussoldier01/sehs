// Everyday quality-of-life: density, bookmarks, recents, back-to-top, shortcuts,
// copy-link buttons, client-side facet search. LocalStorage only after consent.
(function () {
  'use strict';
  function consented() { return /(?:^|;\s*)sehs_consent=v1/.test(document.cookie || ''); }
  function store(k, v) {
    if (!consented()) return false;
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
      return true;
    } catch (e) { return false; }
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* density */
  var dens = store('sehs-density') || 'comfortable';
  if (dens === 'compact') document.body.classList.add('compact');
  function syncDens(btn) { if (btn) btn.textContent = document.body.classList.contains('compact') ? 'Comfortable' : 'Compact'; }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#density-toggle')) {
      var c = document.body.classList.toggle('compact');
      store('sehs-density', c ? 'compact' : 'comfortable');
      syncDens(e.target.closest('#density-toggle'));
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
      b.textContent = on ? '★' : '☆';
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
  if (recMain) pushRecent(recMain.getAttribute('data-record-id'), document.title.replace(/ — SEHS.*$/, ''));

  document.addEventListener('click', function (e) {
    var sv = e.target.closest && e.target.closest('[data-save]');
    if (sv) {
      var id = sv.getAttribute('data-save');
      var list = saved();
      if (list.includes(id)) { list = list.filter(function (x) { return x !== id; }); toast('Removed from saved'); }
      else { list.unshift(id); toast('Saved — see your Saved page'); }
      setSaved(list);
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

  /* saved page + recents strip hydration via /api/by-ids */
  function hydrateIds(el, ids) {
    if (!el || !ids.length) { if (el) el.innerHTML = '<p style="color:var(--mut)">Nothing here yet — tap ☆ on any resource to save it.</p>'; return; }
    fetch('/api/by-ids?ids=' + encodeURIComponent(ids.slice(0, 100).join(',')))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.results || !j.results.length) { el.innerHTML = '<p style="color:var(--mut)">Saved items are no longer available.</p>'; return; }
        el.innerHTML = j.results.map(function (v) {
          return '<article class="card"><div class="card-body"><h3><a href="/r/' + v.id + '">' +
            v.title.replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) +
            '</a></h3><div class="meta-row"><span class="badge">' + v.fileType + '</span>' +
            (v.answersIncluded ? '<span class="badge ans">Answers included</span>' : '') +
            '</div><div class="card-foot"><span></span><a class="btn small" href="/r/' + v.id + '">Open →</a></div></div></article>';
        }).join('');
        paintSaved();
      }).catch(function () { el.innerHTML = '<p style="color:var(--mut)">Could not load saved items.</p>'; });
  }
  var savedGrid = document.getElementById('saved-grid');
  if (savedGrid) hydrateIds(savedGrid, saved());
  var recentStrip = document.getElementById('recent-strip');
  if (recentStrip) {
    var rec = [];
    try { rec = JSON.parse(store('sehs-recent') || '[]'); } catch (e) { rec = []; }
    if (rec.length) {
      recentStrip.hidden = false;
      hydrateIds(document.getElementById('recent-grid'), rec.map(function (x) { return x.id; }));
    }
  }

  paintSaved();
  var dt = document.getElementById('density-toggle');
  syncDens(dt);
  document.addEventListener('sehs:consent', function () { paintSaved(); });
})();
