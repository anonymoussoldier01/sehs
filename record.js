// Record page: copy link button (open flow lives in open.js) + AI study tools.
(function () {
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#copy-link')) {
      var done = function () {
        var t = document.getElementById('toast');
        if (t) { t.textContent = 'Link copied'; t.hidden = false; setTimeout(function () { t.hidden = true; }, 2000); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, done);
      else done();
    }
  });
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  async function post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  var main = document.querySelector('[data-record-id]');
  if (!main) return;
  var topic = (document.querySelector('#main h1') || {}).textContent || '';
  var pendingCards = null;
  function show(html) {
    document.getElementById('res-ai-out').hidden = false;
    document.getElementById('res-ai-body').innerHTML = html;
  }
  var cardsBtn = document.getElementById('res-cards');
  if (cardsBtn) cardsBtn.onclick = async function () {
    show('<p style="color:var(--mut)">Making cards…</p>');
    document.getElementById('res-ai-save').hidden = true;
    try {
      const j = await post('/api/ai/flashcards', { topic: topic.slice(0, 120) });
      pendingCards = j.cards;
      show('<p><strong>' + j.cards.length + ' cards</strong>' + (j.cached ? ' (instant)' : '') + '</p>' +
        j.cards.slice(0, 5).map(function (c) { return '<p style="font-size:13.5px">Q: ' + esc(c.front) + '<br>A: ' + esc(c.back) + '</p>'; }).join('') +
        (j.cards.length > 5 ? '<p style="color:var(--faint);font-size:13px">…plus ' + (j.cards.length - 5) + ' more in the saved deck.</p>' : ''));
      document.getElementById('res-ai-save').hidden = false;
    } catch (e) { show('<p>AI unavailable: ' + esc(e.message) + '</p>'); }
  };
  var quizBtn = document.getElementById('res-quiz');
  if (quizBtn) quizBtn.onclick = async function () {
    show('<p style="color:var(--mut)">Writing a quiz…</p>');
    try {
      const j = await post('/api/ai/questions', { strand: 'verbal', topic: topic.slice(0, 120), n: 4 });
      show(j.questions.map(function (q, i) {
        return '<div class="disc-tile" style="margin-top:8px"><p><strong>Q' + (i + 1) + '</strong> ' + esc(q.stem) + '</p>' +
          '<div style="display:grid;gap:6px">' + q.options.map(function (o, k) { return '<button class="btn secondary small" data-qopt="' + i + ':' + k + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
          '<p class="qfb" style="font-size:13px" hidden></p></div>';
      }).join(''));
      var vqs = j.questions;
      document.querySelectorAll('[data-qopt]').forEach(function (b) {
        b.addEventListener('click', function () {
          var parts = b.getAttribute('data-qopt').split(':');
          var q = vqs[Number(parts[0])], picked = Number(parts[1]);
          var fb = b.closest('.disc-tile').querySelector('.qfb');
          fb.hidden = false;
          var ok = picked === q.answer;
          fb.textContent = (ok ? '✓ Correct. ' : '✗ Correct: ' + q.options[q.answer] + '. ') + q.explain;
          fb.style.color = ok ? 'var(--ok)' : 'var(--bad)';
        });
      });
    } catch (e) { show('<p>AI unavailable: ' + esc(e.message) + '</p>'); }
  };
  var saveBtn = document.getElementById('res-ai-save');
  if (saveBtn) saveBtn.onclick = function () {
    if (!pendingCards) return;
    try {
      var decks = JSON.parse(localStorage.getItem('sehs-decks') || '[]');
      decks.push({ title: 'AI: ' + topic.slice(0, 60), cards: pendingCards });
      localStorage.setItem('sehs-decks', JSON.stringify(decks));
      saveBtn.textContent = 'Saved ✓ — see Study hub';
      setTimeout(function () { saveBtn.textContent = 'Save as personal deck'; }, 2500);
    } catch (e) { saveBtn.textContent = 'Could not save'; }
  };
})();
