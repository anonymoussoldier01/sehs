// Theme toggle (no secrets, no storage before consent — defaults to system).
(function () {
  // Consent-aware: no localStorage writes until the cookie gate is accepted.
  function consented() { return /(?:^|;\s*)sehs_consent=v1/.test(document.cookie || ''); }
  var saved = null;
  try { if (consented()) saved = localStorage.getItem('sehs-theme'); } catch (e) { /* storage unavailable */ }
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : '';
  function sync() {
    var b = document.getElementById('theme-toggle');
    if (b) b.setAttribute('aria-pressed', String(dark));
  }
  sync();
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#theme-toggle')) {
      dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : '';
      try { if (consented()) localStorage.setItem('sehs-theme', dark ? 'dark' : 'light'); } catch (err) { /* consent-gated */ }
      sync();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) {
      var q = document.querySelector('input[name="q"]');
      if (q) { e.preventDefault(); q.focus(); }
    }
  });
})();
