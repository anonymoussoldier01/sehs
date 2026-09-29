// Admin unlock: password → bearer token kept in THIS TAB ONLY (sessionStorage).
// Closing the tab locks it again. No cookies are used anywhere on this site.
(function () {
  'use strict';
  var KEY = 'sehs-admin-token';
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(KEY, t);
      else sessionStorage.removeItem(KEY);
    } catch (e) { /* storage unavailable: token lives for this page only */ }
    window.__sehsAdmin = t || null;
  }
  try { window.__sehsAdmin = sessionStorage.getItem(KEY); } catch (e) { window.__sehsAdmin = null; }
  window.__sehsSetAdmin = setToken;

  function status() {
    var box = document.getElementById('unlock-status');
    if (!box) return;
    if (window.__sehsAdmin) {
      box.innerHTML = '<p><span class="badge cat">Admin unlocked in this tab</span></p>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><a class="btn small" href="/admin">Open dashboard →</a>' +
        '<button class="btn small secondary" id="unlock-logout">Lock this tab</button></div>';
      var f = document.getElementById('unlock-form');
      if (f) f.hidden = true;
    }
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#unlock-logout')) {
      var t = window.__sehsAdmin;
      setToken(null);
      fetch('/api/logout', { method: 'POST', headers: { 'X-Requested-With': 'fetch', ...(t ? { Authorization: 'Bearer ' + t } : {}) } }).catch(function () {});
      location.reload();
    }
  });
  document.addEventListener('submit', async function (e) {
    if (!e.target || e.target.id !== 'unlock-form') return;
    e.preventDefault();
    var pw = document.getElementById('unlock-pw');
    var err = document.getElementById('unlock-err');
    err.hidden = true;
    try {
      var r = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ password: pw.value }),
      });
      var j = await r.json().catch(function () { return {}; });
      if (r.ok && j.ok && j.token) {
        setToken(j.token);
        window.location.href = '/admin';
        return;
      }
      err.textContent = j.retryAfter
        ? 'Too many attempts — try again in ' + j.retryAfter + 's.'
        : 'Incorrect password. Please try again.';
      err.hidden = false;
      pw.value = '';
      pw.focus();
    } catch (ex) {
      err.textContent = 'Could not reach the server. Try again.';
      err.hidden = false;
    }
  });
  status();
})();
