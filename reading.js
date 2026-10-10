// Reading studio: built-in passages + unlimited AI passages with questions.
(function () {
  'use strict';
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  var staticPassages = [];
  var cur = null;
  var score = { ok: 0, n: 0 };
  function showPassage(p) {
    cur = p;
    var host = document.getElementById('read-area');
    host.innerHTML = '<div class="disc-tile"><p style="font-size:12px;color:var(--faint)">' + esc(p.genre || 'passage') + (p.cached ? ' · instant' : '') + '</p>' +
      '<h3>' + esc(p.title || 'Practice passage') + '</h3>' +
      '<p style="white-space:pre-wrap;max-width:70ch">' + esc(p.text) + '</p></div>' +
      '<div id="read-qs">' + p.questions.map(function (q, i) {
        return '<div class="disc-tile" style="margin-top:8px"><p><strong>Q' + (i + 1) + '</strong> ' + esc(q.stem) + '</p>' +
          '<div style="display:grid;gap:6px">' + q.options.map(function (o, k) { return '<button class="btn secondary small" data-ropt="' + i + ':' + k + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
          '<p class="rfb" style="font-size:13px" hidden></p></div>';
      }).join('') + '</div>';
    host.querySelectorAll('[data-ropt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-ropt').split(':');
        var qi = Number(parts[0]), picked = Number(parts[1]);
        var q = p.questions[qi];
        var fb = b.closest('.disc-tile').querySelector('.rfb');
        fb.hidden = false;
        score.n++;
        var ok = picked === q.answer;
        if (ok) { score.ok++; fb.textContent = '✓ Correct. ' + q.explain; fb.style.color = 'var(--ok)'; }
        else {
          fb.textContent = '✗ Correct: ' + q.options[q.answer] + '. ' + q.explain;
          fb.style.color = 'var(--bad)';
          window.SEHS_AI.mistakes.record({ stem: q.stem, strand: 'reading', picked, correct: q.answer });
        }
        paintScore();
      });
    });
    document.getElementById('read-score').textContent = 'Session: ' + score.ok + '/' + score.n;
  }
  function paintScore() { document.getElementById('read-score').textContent = 'Session: ' + score.ok + '/' + score.n; }
  fetch('/api/reading').then(function (r) { return r.json(); }).then(function (j) {
    staticPassages = j.passages || [];
    var grid = document.getElementById('read-list');
    grid.innerHTML = staticPassages.map(function (p, i) {
      return '<button class="btn small secondary" data-pass="' + i + '">' + esc(p.title) + ' <span style="color:var(--faint)">(' + esc(p.genre) + ')</span></button>';
    }).join('');
    grid.querySelectorAll('[data-pass]').forEach(function (b) {
      b.onclick = function () { showPassage(staticPassages[Number(b.getAttribute('data-pass'))]); };
    });
    if (staticPassages.length) showPassage(staticPassages[0]);
  }).catch(function () { document.getElementById('read-list').innerHTML = '<p>Could not load passages.</p>'; });
  var genBtn = document.getElementById('read-ai');
  if (genBtn) {
    genBtn.onclick = async function () {
      var genre = (document.getElementById('read-genre') || {}).value || '';
      var host = document.getElementById('read-area');
      host.innerHTML = '<p style="color:var(--mut)">Writing a fresh passage…</p>';
      try {
        const r = await fetch('/api/ai/passage', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ genre: genre, seed: 'exam practice' }) });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
        showPassage({ title: j.passage.title, genre: j.genre + (j.cached ? ' · AI' : ' · ✦ AI'), text: j.passage.text, questions: j.passage.questions, cached: j.cached });
      } catch (e) { host.innerHTML = '<p>AI unavailable: ' + esc(e.message) + '</p>'; }
    };
  }
})();
