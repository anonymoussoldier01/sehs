// Entry gates: hard cookie block + per-session Terms acceptance.
// Zero storage is touched before consent. No secrets here.
(function () {
  'use strict';
  var CONSENT_RE = /(?:^|;\s*)sehs_consent=v1/;
  function hasConsent() { return CONSENT_RE.test(document.cookie || ''); }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- cookie gate ---------- */
  var gate = document.getElementById('consent-gate');
  function showGate() {
    if (!gate || hasConsent()) return;
    gate.hidden = false;
    document.body.style.overflow = 'hidden';
    var btn = document.getElementById('consent-accept');
    if (btn) btn.focus();
  }
  function hideGate() {
    if (!gate) return;
    gate.hidden = true;
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#consent-details-toggle')) {
      var d = document.getElementById('consent-details');
      if (d) d.hidden = !d.hidden;
      return;
    }
    if (e.target.closest && e.target.closest('#consent-accept')) {
      fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ accept: true }),
      }).then(function (r) {
        if (!r.ok) throw new Error('no');
        hideGate();
        document.dispatchEvent(new CustomEvent('sehs:consent'));
      }).catch(function () { toast('Could not save preference. Try again.'); });
      return;
    }
    if (e.target.closest && e.target.closest('#cookie-settings')) {
      e.preventDefault();
      fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ accept: false }),
      }).then(function () {
        try {
          Object.keys(localStorage).filter(function (k) { return k.indexOf('sehs-') === 0; })
            .forEach(function (k) { localStorage.removeItem(k); });
        } catch (err) { /* noop */ }
        location.reload();
      });
    }
  });

  /* ---------- terms gate ---------- */
  var modal = document.getElementById('terms-modal');
  function renderTerms(t) {
    document.getElementById('terms-summary').textContent = t.summary || '';
    // body is server-sanitised plain text/markdown-lite; render as paragraphs
    var body = String(t.body || '').split(/\n{2,}/).map(function (para) {
      var p = para.replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; });
      p = p.replace(/^#{1,3}\s*(.+)$/gm, '<strong>$1</strong>').replace(/\n/g, '<br>');
      return '<p>' + p + '</p>';
    }).join('');
    document.getElementById('terms-body').innerHTML = body;
    document.getElementById('terms-version').textContent = 'Version ' + t.version;
    document.getElementById('terms-agree').checked = false;
  }
  function showTerms() {
    return fetch('/api/terms').then(function (r) { return r.json(); }).then(function (t) {
      if (!t || !t.version) throw new Error('no-terms');
      renderTerms(t);
      modal.hidden = false;
      return new Promise(function (resolve) {
        function done(val) {
          modal.hidden = true;
          document.getElementById('terms-accept').onclick = null;
          document.getElementById('terms-decline').onclick = null;
          resolve(val);
        }
        document.getElementById('terms-accept').onclick = function () {
          if (!document.getElementById('terms-agree').checked) {
            toast('Please tick the agreement box first');
            return;
          }
          fetch('/api/terms/accept', { method: 'POST', headers: { 'X-Requested-With': 'fetch' } })
            .then(function (r) { done(r.ok); if (!r.ok) toast('Could not record acceptance'); })
            .catch(function () { done(false); toast('Could not record acceptance'); });
        };
        document.getElementById('terms-decline').onclick = function () { done(false); };
        document.getElementById('terms-agree').focus();
      });
    }).catch(function () { toast('Could not load Terms'); return false; });
  }
  // Resolves true once the current Terms are accepted this session.
  window.__sehsTerms = {
    ensure: function () {
      return fetch('/api/terms/status').then(function (r) { return r.json(); }).then(function (s) {
        if (s && s.accepted) return true;
        return showTerms();
      }).catch(function () { return showTerms(); });
    },
  };

  showGate();
})();
