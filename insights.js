// Local-first insights: personal progress without an account.
// Everything stays in this browser (cookies + local storage) unless you export
// it. The server separately keeps only anonymous, auto-deleted open counts
// (30-day purge) — see README + /about.
//
// What we record locally: page views per section, searches run, resources opened
// + saved, mocks/drills/writing/reading sessions, study streak days, weak strands
// from the mistake bank. Rendered as "Your progress" (landing + study hub) with
// one-tap export / erase.
(function () {
  'use strict';
  var KEY = 'sehs-insights-v1';
  function today() { return new Date().toISOString().slice(0, 10); }
  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') return v;
    } catch (e) {}
    return { firstSeen: today(), totals: {}, days: {}, strands: {} };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function bump(kind, n) {
    var s = load();
    s.totals[kind] = (s.totals[kind] || 0) + (n || 1);
    var d = today();
    if (!s.days[d]) s.days[d] = {};
    s.days[d][kind] = (s.days[d][kind] || 0) + (n || 1);
    // keep a year of daily buckets, cap size
    var keys = Object.keys(s.days).sort();
    if (keys.length > 365) keys.slice(0, keys.length - 365).forEach(function (k) { delete s.days[k]; });
    save(s);
    paint();
  }
  function noteStrand(strand) {
    if (!strand) return;
    var s = load();
    strand = String(strand).toLowerCase().slice(0, 30);
    s.strands[strand] = (s.strands[strand] || 0) + 1;
    save(s);
  }
  function activeDays() { return Object.keys(load().days || {}).length; }
  function weekOpens() {
    var s = load(), out = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out += ((s.days[d] || {}).opens || 0);
    }
    return out;
  }
  function streak() {
    try {
      var days = JSON.parse(localStorage.getItem('sehs-streak') || '{"days":[]}').days || [];
      return days.length;
    } catch (e) { return 0; }
  }
  function mistakes() {
    try { return JSON.parse(localStorage.getItem('sehs-mistakes') || '[]'); } catch (e) { return []; }
  }
  function summary() {
    var s = load();
    var weak = {};
    mistakes().forEach(function (m) { weak[m.strand] = (weak[m.strand] || 0) + 1; });
    var topWeak = Object.keys(weak).sort(function (a, b) { return weak[b] - weak[a]; }).slice(0, 3);
    return {
      opens: s.totals.opens || 0,
      saves: s.totals.saves || 0,
      searches: s.totals.searches || 0,
      mocks: s.totals.mocks || 0,
      activeDays: activeDays(),
      weekOpens: weekOpens(),
      streak: streak(),
      weak: topWeak,
      firstSeen: s.firstSeen,
    };
  }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function paint() {
    var host = document.getElementById('progress-strip');
    if (!host) return;
    var m = summary();
    if (!m.opens && !m.searches && !m.mocks) {
      host.innerHTML = '<div class="progress-card"><b>Welcome</b><span>Your progress lives here</span><span class="sub2">Opens, saves, mocks — only in this browser. Nothing is uploaded.</span></div>' +
        '<div class="progress-card"><b>—</b><span>Day streak</span><span class="sub2">Study anything to start one.</span></div>' +
        '<div class="progress-card"><b>—</b><span>Weak spots</span><span class="sub2">Missed questions pile up here.</span></div>' +
        '<div class="progress-card"><b>Export</b><span>Your data, your file</span><span class="sub2"><button class="link-btn" id="insights-export">Download JSON</button></span></div>';
    } else {
      host.innerHTML =
        '<div class="progress-card"><b>' + m.opens + '</b><span>Resources opened</span><span class="sub2">' + m.weekOpens + ' in the last 7 days</span></div>' +
        '<div class="progress-card"><b>' + m.streak + ' 🔥</b><span>Day streak</span><span class="sub2">' + m.activeDays + ' active days since ' + esc(m.firstSeen) + '</span></div>' +
        '<div class="progress-card"><b>' + (m.weak.length ? esc(m.weak[0]) : '—') + '</b><span>Needs work</span><span class="sub2">' + (m.weak.length ? esc(m.weak.join(' · ')) : 'No misses logged yet') + '</span></div>' +
        '<div class="progress-card"><b>' + m.saves + ' · ' + m.searches + '</b><span>Saved · searches</span><span class="sub2"><button class="link-btn" id="insights-export">Export</button> · <button class="link-btn" id="insights-erase">Erase</button></span></div>';
    }
    var ex = document.getElementById('insights-export');
    if (ex) ex.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ insights: load(), mistakes: mistakes() }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sehs-my-progress.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    var er = document.getElementById('insights-erase');
    if (er) er.addEventListener('click', function () {
      if (!confirm('Erase all locally stored progress (opens, saves history, streak)? Saved bookmarks stay.')) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      paint();
    });
  }

  // auto-track: page views + searches + opens + saves + practice
  bump('views');
  // scroll progress (works on static + server pages; ux.js also drives it when loaded)
  (function () {
    var prog = document.getElementById('scroll-progress');
    if (!prog) return;
    function sync() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      prog.style.width = max > 0 ? (100 * h.scrollTop / max).toFixed(2) + '%' : '0';
    }
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  })();
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-open]')) { bump('opens'); var id = e.target.closest('[data-open]').getAttribute('data-open'); if (id) noteStrand(null); }
    if (e.target.closest && e.target.closest('[data-save]')) bump('saves');
    if (e.target.closest && e.target.closest('#drill-check, #drill-next, [data-drill]')) bump('drills');
    if (e.target.closest && e.target.closest('#timer-start, #ai-feedback, #ai-grade')) bump('writing');
    if (e.target.closest && e.target.closest('#read-ai, #read-list')) bump('reading');
    if (e.target.closest && e.target.closest('#mock-area, [data-mock]')) bump('mocks');
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.action && String(f.action).includes('/search')) bump('searches');
    if (f && (f.id === 'request-form' || f.id === 'report-form')) bump('feedback');
  });
  // search input commits (landing static app.js also counts via hash writes; dedupe by day is fine)
  window.__sehsInsights = { bump: bump, summary: summary, paint: paint };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
})();
