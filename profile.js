// On-device adaptive profile: subject/provider affinity from opens + saves.
// NOTHING leaves the browser. Tuning is a tie-break boost via ?aff=, with a
// visible chip + reset. Session memory (this tab) weighs more than history.
(function () {
  'use strict';
  var PKEY = 'sehs-profile-v1';
  var SKEY = 'sehs-session-aff-v1';
  var HALF_LIFE_MS = 30 * 86400000;
  function load(k, fb) {
    try {
      var v = k === SKEY ? sessionStorage.getItem(k) : localStorage.getItem(k);
      return v ? JSON.parse(v) : fb;
    } catch (e) { return fb; }
  }
  function save(k, v) {
    try {
      var s = JSON.stringify(v);
      if (k === SKEY) sessionStorage.setItem(k, s); else localStorage.setItem(k, s);
    } catch (e) { /* storage unavailable */ }
  }
  function decayed(count, at) {
    var age = Date.now() - (at || Date.now());
    return count * Math.pow(0.5, age / HALF_LIFE_MS);
  }
  function topAffinities() {
    var p = load(PKEY, { subjects: {}, providers: {}, at: {} });
    var s = load(SKEY, { subjects: {}, providers: {} });
    var out = [];
    var push = function (kind, key, w) {
      if (w < 0.75) return;
      out.push(kind + ':' + key + ':' + Math.min(10, Math.round(w)));
    };
    for (const k of Object.keys(p.subjects || {})) push('s', k, decayed(p.subjects[k], (p.at || {})[k]) + ((s.subjects || {})[k] || 0) * 2);
    for (const k of Object.keys(p.providers || {})) push('t', k, decayed(p.providers[k], (p.at || {})[k]) + ((s.providers || {})[k] || 0) * 2);
    for (const k of Object.keys(s.subjects || {})) if (!p.subjects || !p.subjects[k]) push('s', k, s.subjects[k] * 2);
    for (const k of Object.keys(s.providers || {})) if (!p.providers || !p.providers[k]) push('t', k, s.providers[k] * 2);
    return out.slice(0, 12).join(',');
  }
  function affParam() {
    var a = topAffinities();
    return a ? '&aff=' + encodeURIComponent(a) : '';
  }
  // Record an open: resolve subjects/providers once via /api/by-ids (cached).
  var metaCache = {};
  function trackOpen(id) {
    if (!id || metaCache[id] === null) return;
    var apply = function (subjects, providers) {
      var p = load(PKEY, { subjects: {}, providers: {}, at: {} });
      var s = load(SKEY, { subjects: {}, providers: {} });
      var now = Date.now();
      subjects.forEach(function (x) {
        x = String(x).toLowerCase();
        p.subjects[x] = (p.subjects[x] || 0) + 1; p.at[x] = now;
        s.subjects[x] = (s.subjects[x] || 0) + 1;
      });
      providers.forEach(function (x) {
        x = String(x).toLowerCase();
        p.providers[x] = (p.providers[x] || 0) + 1; p.at[x] = now;
        s.providers[x] = (s.providers[x] || 0) + 1;
      });
      save(PKEY, p); save(SKEY, s);
      paintChip();
    };
    if (metaCache[id]) { var m = metaCache[id]; apply(m.s, m.p); return; }
    fetch('/api/by-ids?ids=' + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var v = j && j.results && j.results[0];
        if (!v) { metaCache[id] = null; return; }
        var entry = { s: v.subject ? [v.subject] : [], p: v.provider ? [v.provider] : [] };
        metaCache[id] = entry;
        apply(entry.s, entry.p);
      }).catch(function () { /* offline: skip */ });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open]');
    if (b) trackOpen(b.getAttribute('data-open'));
    var t = e.target.closest && e.target.closest('#tuned-reset');
    if (t) {
      try { localStorage.removeItem(PKEY); sessionStorage.removeItem(SKEY); } catch (err) {}
      location.href = location.pathname + location.search.replace(/&?aff=[^&]*/g, '').replace(/\?$/, '');
    }
  });
  // Saved items also tune the profile (lightly).
  document.addEventListener('click', function (e) {
    var sv = e.target.closest && e.target.closest('[data-save]');
    if (sv && sv.textContent === '☆') trackOpen(sv.getAttribute('data-save'));
  });
  function paintChip() {
    var host = document.getElementById('active-chips') || document.querySelector('.toolbar');
    if (!host || document.getElementById('tuned-chip')) return;
    if (!topAffinities()) return;
    var el = document.createElement('span');
    el.className = 'pill-x';
    el.id = 'tuned-chip';
    el.innerHTML = 'Tuned for you <button id="tuned-reset" aria-label="Reset personal tuning">✕</button>';
    el.title = 'Ranking gently tuned to subjects and providers you open. Stored only in this browser.';
    if (host.id === 'active-chips') host.appendChild(el);
    else host.appendChild(el);
  }
  // Inject ?aff= into same-origin search navigations + forms.
  function withAff(url) {
    try {
      var u = new URL(url, location.origin);
      if (u.origin !== location.origin || !u.pathname.startsWith('/search')) return url;
      var a = topAffinities();
      if (a) u.searchParams.set('aff', a);
      else u.searchParams.delete('aff');
      return u.pathname + (u.search ? '?' + u.searchParams.toString() : '');
    } catch (e) { return url; }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="/search"]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      var nu = withAff(a.getAttribute('href'));
      if (nu !== a.getAttribute('href')) { e.preventDefault(); location.href = nu; }
    }
  }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.action && f.action.includes('/search')) {
      var a = topAffinities();
      if (!a) return;
      var h = f.querySelector('input[name="aff"]');
      if (!h) { h = document.createElement('input'); h.type = 'hidden'; h.name = 'aff'; f.appendChild(h); }
      h.value = a;
    }
  });
  window.__sehsAff = affParam;
  // Tuned-for-you shelf on the landing page: quick links from top affinities.
  (function tunedShelf() {
    var shelf = document.getElementById('tuned-shelf');
    var grid = document.getElementById('tuned-grid');
    if (!shelf || !grid) return;
    var p = load(PKEY, { subjects: {}, providers: {}, at: {} });
    var scored = [];
    for (const k of Object.keys(p.subjects || {})) {
      var w = decayed(p.subjects[k], (p.at || {})[k]);
      if (w >= 1.5) scored.push({ label: k, w: w });
    }
    for (const k of Object.keys(p.providers || {})) {
      var w2 = decayed(p.providers[k], (p.at || {})[k]);
      if (w2 >= 1.5) scored.push({ label: k, w: w2 });
    }
    if (!scored.length) return;
    scored.sort(function (a, b) { return b.w - a.w; });
    grid.innerHTML = scored.slice(0, 6).map(function (s) {
      var pretty = s.label.split(/[-_\s]/).map(function (w) { return w ? w[0].toUpperCase() + w.slice(1) : w; }).join(' ');
      return '<div class="disc-tile"><h3>' + pretty.replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) +
        '</h3><p>Because you have been opening these</p><a class="link-btn" href="/search?q=' +
        encodeURIComponent(s.label) + '">Explore →</a></div>';
    }).join('');
    shelf.hidden = false;
  })();
  paintChip();
})();
