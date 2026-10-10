// Shared open flow: per-tab Terms acceptance, then single-use grant URL.
(function () {
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  async function grant(id) {
    var r = await fetch('/api/access/' + encodeURIComponent(id), { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
    var j = await r.json().catch(function () { return {}; });
    if (r.ok && j.openUrl) return j.openUrl;
    if (r.status === 410) toast('This resource is temporarily unavailable');
    else if (r.status === 429) toast('Too many requests — slow down');
    else toast('Resource unavailable right now');
    return null;
  }
  async function openResource(id, btn) {
    var label = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }
    // Open the tab SYNCHRONOUSLY in the click gesture: browsers block
    // window.open() calls made after awaits (Terms fetch + grant POST).
    // We navigate the placeholder once the grant URL is ready.
    var w = null;
    try { w = window.open('about:blank', '_blank'); } catch (e) { w = null; }
    if (!w) toast('Popup blocked — allow popups for this site, then try again');
    else {
      // so the new tab never looks dead while the grant is minted
      try {
        w.document.write('<!DOCTYPE html><title>Opening…</title><body style="font-family:sans-serif;background:#0b0b28;color:#f2f2fb;display:grid;place-items:center;height:100vh;margin:0"><p>Opening your file…</p></body>');
        w.document.close();
      } catch (e) { /* cross-browser quirks: skip */ }
    }
    try {
      if (window.__sehsTerms) {
        var ok = await window.__sehsTerms.ensure();
        if (!ok) { if (w) w.close(); return; } // declined: do not open
      }
      var url = await grant(id);
      if (url && w) w.location.replace(url);
      else if (url && !w) location.href = url; // last resort: same tab
      else if (w) w.close();
    } catch (e) {
      if (w) w.close();
      toast('Could not open resource');
    } finally {
      if (btn) { btn.disabled = false; if (label !== null) btn.textContent = label; }
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open]');
    if (b) { e.preventDefault(); openResource(b.getAttribute('data-open'), b); }
  });
  window.__sehsOpen = openResource;
})();
