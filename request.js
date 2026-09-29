// Report + request forms (anonymous, server rate-limited).
(function () {
  'use strict';
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  // record-page report modal
  var currentId = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-report]');
    if (b) {
      currentId = b.getAttribute('data-report');
      document.getElementById('report-modal').hidden = false;
      return;
    }
    if (e.target.closest && (e.target.closest('#report-x') || e.target.id === 'report-modal')) {
      document.getElementById('report-modal').hidden = true;
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'report-form') {
      e.preventDefault();
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({
          resourceId: currentId,
          reason: document.getElementById('report-reason').value,
          detail: document.getElementById('report-detail').value,
        }),
      }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); }).then(function (x) {
        if (x.r.ok) {
          document.getElementById('report-modal').hidden = true;
          document.getElementById('report-detail').value = '';
          toast('Thanks — report received');
        } else toast((x.j && x.j.error) || 'Could not send report');
      }).catch(function () { toast('Could not send report'); });
    }
    if (e.target.id === 'request-form') {
      e.preventDefault();
      var msg = document.getElementById('req-msg');
      fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ title: document.getElementById('req-title').value, detail: document.getElementById('req-detail').value }),
      }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); }).then(function (x) {
        if (x.r.ok) {
          msg.textContent = 'Received — thank you.';
          e.target.reset();
        } else msg.textContent = (x.j && x.j.error) || 'Could not send.';
      }).catch(function () { msg.textContent = 'Could not send.'; });
    }
  });
})();
