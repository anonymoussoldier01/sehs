// Terms gate: per-tab acceptance, zero cookies, zero persistence.
// The flag lives in this tab's memory only: a new tab asks again. This is
// stated plainly in the modal copy — acceptance is an agreement step, and the
// server independently logs every resource open. No secrets here.
(function () {
  'use strict';
  var acceptedVersion = 0; // per-tab memory
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

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
    document.getElementById('terms-version').textContent = 'Version ' + t.version +
      ' · applies to this browser tab only';
    document.getElementById('terms-agree').checked = false;
    return t.version;
  }
  function showTerms() {
    return fetch('/api/terms').then(function (r) { return r.json(); }).then(function (t) {
      if (!t || !t.version) throw new Error('no-terms');
      var v = renderTerms(t);
      if (acceptedVersion >= v) return true;
      modal.hidden = false;
      return new Promise(function (resolve) {
        function done(val) {
          modal.hidden = true;
          document.getElementById('terms-accept').onclick = null;
          document.getElementById('terms-decline').onclick = null;
          if (val) acceptedVersion = v;
          resolve(val);
        }
        document.getElementById('terms-accept').onclick = function () {
          if (!document.getElementById('terms-agree').checked) {
            toast('Please tick the agreement box first');
            return;
          }
          done(true);
        };
        document.getElementById('terms-decline').onclick = function () { done(false); };
        document.getElementById('terms-agree').focus();
      });
    }).catch(function () { toast('Could not load Terms'); return false; });
  }
  // Resolves true once the current Terms are accepted in this tab.
  window.__sehsTerms = { ensure: showTerms };
})();
