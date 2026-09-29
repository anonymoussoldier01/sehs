// Unlock page: role tabs + password form (generic errors only).
(function () {
  var role = 'viewer';
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-tab]');
    if (!t) return;
    role = t.getAttribute('data-tab');
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      var on = b === t;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
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
        body: JSON.stringify({ which: role, password: pw.value }),
      });
      var j = await r.json().catch(function () { return {}; });
      if (r.ok && j.ok) { window.location.href = role === 'admin' ? '/admin' : '/search'; return; }
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
  // logout form posts natively; nothing needed here
})();
