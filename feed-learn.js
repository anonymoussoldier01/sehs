// Home "Learn questions" preview: one real MCQ from the mock bank.
// No AI call, no account — answer right here, then jump into a full mode.
(function () {
  'use strict';
  var qEl = document.getElementById('feed-learn-q');
  if (!qEl) return;
  var box = document.getElementById('feed-learn-opts');
  var fb = document.getElementById('feed-learn-fb');
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  fetch('/api/mocks').then(function (r) { return r.json(); }).then(function (j) {
    var first = j.mocks && j.mocks[0];
    if (!first) throw new Error('no-mocks');
    return fetch('/api/mocks/' + encodeURIComponent(first.id)).then(function (r) { return r.json(); });
  }).then(function (j) {
    var q = j.mock && j.mock.questions && j.mock.questions[Math.floor(Math.random() * j.mock.questions.length)];
    if (!q) throw new Error('no-q');
    qEl.textContent = q.stem;
    box.innerHTML = q.options.map(function (o, k) {
      return '<button class="opt" data-fq="' + k + '">' + esc(o) + '</button>';
    }).join('');
    box.querySelectorAll('[data-fq]').forEach(function (b) {
      b.addEventListener('click', function () {
        var picked = Number(b.getAttribute('data-fq'));
        var ok = picked === q.answer;
        box.querySelectorAll('[data-fq]').forEach(function (x) {
          x.disabled = true;
          if (Number(x.getAttribute('data-fq')) === q.answer) x.classList.add('right');
        });
        if (!ok) b.classList.add('wrong');
        else b.classList.add('sel');
        fb.hidden = false;
        fb.textContent = (ok ? 'Correct. ' : 'Not quite — the answer is highlighted. ') + (q.explain || '');
        fb.style.color = ok ? 'var(--ok)' : 'var(--mut)';
        if (window.__sehsInsights && window.__sehsInsights.bump) window.__sehsInsights.bump('learn-preview');
        if (!ok && window.SEHS_AI && window.SEHS_AI.mistakes) {
          try { window.SEHS_AI.mistakes.record({ stem: q.stem, strand: q.strand || 'mixed' }); } catch (e) {}
        }
      });
    });
  }).catch(function () {
    qEl.textContent = 'What does asexual reproduction involve?';
    box.innerHTML = ['Two parents', 'One parent', 'Both parents'].map(function (o, k) {
      return '<button class="opt" data-fq="' + k + '">' + o + '</button>';
    }).join('');
    box.querySelectorAll('[data-fq]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ok = b.textContent.trim() === 'One parent';
        box.querySelectorAll('[data-fq]').forEach(function (x) { x.disabled = true; });
        b.classList.add(ok ? 'right' : 'wrong');
        fb.hidden = false;
        fb.textContent = ok ? 'Correct — one parent, no fertilisation.' : 'The answer is “One parent”.';
      });
    });
  });
})();
