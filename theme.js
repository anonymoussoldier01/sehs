  // Default to dark (deep-navy study theme) unless the visitor chose otherwise.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('sehs-theme'); } catch (e) { /* storage unavailable */ }
  var dark = saved ? saved === 'dark' : true;
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
      try { localStorage.setItem('sehs-theme', dark ? 'dark' : 'light'); } catch (err) { /* ignore */ }
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
