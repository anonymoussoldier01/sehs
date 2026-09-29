// Shared grant-based open flow: POST /api/access/:id → open grant URL.
(function () {
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  async function openResource(id, btn) {
    if (btn) btn.disabled = true;
    try {
      var r = await fetch('/api/access/' + encodeURIComponent(id), { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
      var j = await r.json().catch(function () { return {}; });
      if (r.status === 403 && j.termsRequired) {
        toast('Please accept the Terms first');
        if (window.__sehsTerms) {
          var ok = await window.__sehsTerms.ensure();
          if (ok) {
            toast('Terms accepted — opening…');
            var r2 = await fetch('/api/access/' + encodeURIComponent(id), { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
            var j2 = await r2.json().catch(function () { return {}; });
            if (r2.ok && j2.openUrl) { window.open(j2.openUrl, '_blank', 'noopener'); return; }
          }
        }
        return;
      }
      if (r.status === 401 || r.status === 403) { window.location.href = '/unlock'; return; }
      if (!r.ok || !j.openUrl) { toast('Resource unavailable right now'); return; }
      window.open(j.openUrl, '_blank', 'noopener');
    } catch (e) {
      toast('Could not open resource');
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open]');
    if (b) { e.preventDefault(); openResource(b.getAttribute('data-open'), b); }
  });
  window.__sehsOpen = openResource;
})();
