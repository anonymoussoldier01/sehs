// Timed mocks client (server-only). Progress in localStorage, zero cookies.
(function () {
  'use strict';
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function load(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function toast(msg) { var t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 2200); }

  var grid = document.getElementById('mocks-grid');
  if (grid) {
    fetch('/api/mocks').then(function (r) { return r.json(); }).then(function (j) {
      var best = load('sehs-mocks', {});
      grid.innerHTML = (j.mocks || []).map(function (m) {
        var b = best[m.id];
        return '<div class="disc-tile"><h3>' + esc(m.title) + '</h3><p>' + esc(m.strands.join(' · ')) + ' · ' + m.minutes + ' min · ' + m.count + ' questions</p>' +
          (b ? '<p style="color:var(--ok);font-size:13px">Best: ' + b.score + '/' + b.total + '</p>' : '') +
          '<a class="btn small" href="/mocks/' + encodeURIComponent(m.id) + '">Start →</a></div>';
      }).join('') || '<p>No mocks yet.</p>';
    }).catch(function () { grid.innerHTML = '<p>Could not load mocks.</p>'; });
  }

  var host = document.querySelector('[data-mock]');
  if (!host) return;
  var mockId = host.getAttribute('data-mock');
  var state = { q: [], i: 0, answers: [], secsLeft: 0, timer: null, done: false };
  function fmt(s) { var m = Math.floor(s / 60), ss = s % 60; return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
  fetch('/api/mocks/' + encodeURIComponent(mockId)).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.mock) { document.getElementById('mock-title').textContent = 'Mock not found.'; return; }
    document.getElementById('mock-title').textContent = j.mock.title;
    document.getElementById('mock-crumb').textContent = j.mock.title;
    document.getElementById('mock-desc').textContent = j.mock.strands.join(' · ') + ' · ' + j.mock.minutes + ' min · ' + j.mock.questions.length + ' questions';
    state.q = j.mock.questions;
    state.secsLeft = j.mock.minutes * 60;
    render();
    state.timer = setInterval(function () {
      if (state.done) { clearInterval(state.timer); return; }
      state.secsLeft--;
      var t = document.getElementById('mock-timer');
      if (t) t.textContent = fmt(Math.max(0, state.secsLeft));
      if (state.secsLeft <= 0) finish();
    }, 1000);
  });

  function render() {
    var area = document.getElementById('mock-area');
    if (state.i >= state.q.length) { finish(); return; }
    var q = state.q[state.i];
    area.innerHTML = '<div style="display:flex;gap:12px;align-items:center;margin:10px 0;flex-wrap:wrap"><div id="mock-timer" style="font-family:var(--disp);font-size:26px;font-weight:800">' + fmt(state.secsLeft) + '</div>' +
      '<span style="color:var(--mut)">Q' + (state.i + 1) + '/' + state.q.length + ' · ' + esc(q.strand) + '</span>' +
      '<span style="margin-left:auto;display:flex;gap:6px"><button class="btn small secondary" id="mk-skip">Skip →</button><button class="btn small secondary" id="mk-finish">Finish</button></span></div>' +
      '<div class="disc-tile"><h3>' + esc(q.stem) + '</h3><div style="display:grid;gap:8px;margin-top:12px">' +
      q.options.map(function (o, k) { return '<button class="btn secondary" data-opt="' + k + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
    area.querySelectorAll('[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.answers[state.i] = Number(b.getAttribute('data-opt'));
        state.i++;
        render();
      });
    });
    document.getElementById('mk-skip').onclick = function () { state.answers[state.i] = -1; state.i++; render(); };
    document.getElementById('mk-finish').onclick = finish;
  }
  function finish() {
    if (state.done) return;
    state.done = true;
    if (state.timer) clearInterval(state.timer);
    var score = 0;
    var misses = [];
    state.q.forEach(function (q, i) {
      if (state.answers[i] === q.answer) { score++; return; }
      misses.push({ stem: q.stem, strand: q.strand, picked: state.answers[i], correct: q.answer });
      window.SEHS_AI.mistakes.record({ stem: q.stem, strand: q.strand, picked: state.answers[i], correct: q.answer });
    });
    var best = load('sehs-mocks', {});
    if (!best[mockId] || score > best[mockId].score) { best[mockId] = { score: score, total: state.q.length, at: new Date().toISOString() }; save('sehs-mocks', best); }
    var area = document.getElementById('mock-area');
    area.innerHTML = '<div class="disc-tile" style="text-align:center"><h3>Score: ' + score + ' / ' + state.q.length + '</h3>' +
      '<p style="color:var(--mut)">' + (score === state.q.length ? 'Perfect. 🎉' : score >= state.q.length * 0.7 ? 'Solid — review misses below.' : 'Review below, then retry.') + '</p>' +
      '<p><a class="btn small" href="/mocks">All mocks</a> <button class="btn small secondary" id="mk-retry">Retry</button></p></div>' +
      (misses.length ? '<div class="disc-tile" style="margin-top:8px"><p><button class="btn small secondary" id="mk-coach">✦ Coach my errors</button> <button class="btn small secondary" id="mk-variants">✦ Variants of my misses</button> <button class="btn small secondary" id="mk-todeck">Deck my misses</button></p><div id="mk-coach-out" hidden><p id="mk-coach-text" style="white-space:pre-wrap;font-size:13.5px"></p><div id="mk-variants-out"></div></div></div>' : '') +
      state.q.map(function (q, i) {
        var picked = state.answers[i];
        var ok = picked === q.answer;
        return '<div class="disc-tile" style="margin-top:8px"><p><strong>Q' + (i + 1) + ' (' + esc(q.strand) + ')</strong> ' + esc(q.stem) + '</p>' +
          '<p style="color:' + (ok ? 'var(--ok)' : 'var(--bad)') + '">' + (ok ? '✓ ' : '✗ ') + esc(picked >= 0 ? q.options[picked] : '(skipped)') + (ok ? '' : ' — correct: ' + esc(q.options[q.answer])) + '</p>' +
          '<p style="color:var(--mut);font-size:13px">' + esc(q.explain || '') + '</p>' +
          (ok ? '' : '<div><button class="btn small secondary" data-explain="' + i + '">Explain with AI</button><p class="ai-explain" style="font-size:13px;white-space:pre-wrap" hidden></p></div>') + '</div>';
      }).join('');
    document.getElementById('mk-retry').onclick = function () { location.reload(); };
    var coachBtn = document.getElementById('mk-coach');
    if (coachBtn) {
      coachBtn.onclick = async function () {
        var out = document.getElementById('mk-coach-out');
        var txt = document.getElementById('mk-coach-text');
        out.hidden = false;
        txt.textContent = 'Coaching…';
        var byStrand = {};
        misses.forEach(function (m) { byStrand[m.strand] = (byStrand[m.strand] || 0) + 1; });
        var summary = Object.keys(byStrand).map(function (s) { return s + ' ×' + byStrand[s]; }).join(', ');
        try {
          txt.textContent = await window.SEHS_AI.chat('tutor',
            'I scored ' + score + '/' + state.q.length + ' on a SEHS mock. My misses by strand: ' + summary + '. Missed: ' +
            misses.slice(0, 4).map(function (m) { return m.stem; }).join(' | ') +
            '. Tell me my weakest strand, what to drill this week, and one exam tip. Under 150 words.');
        } catch (e) { txt.textContent = 'AI unavailable: ' + e.message + ' — drill your ' + summary + ' misses in /drills meanwhile.'; }
      };
      document.getElementById('mk-variants').onclick = async function () {
        var out = document.getElementById('mk-coach-out');
        var host = document.getElementById('mk-variants-out');
        out.hidden = false;
        host.innerHTML = '<p style="color:var(--mut)">Writing fresh variants…</p>';
        try {
          const r = await fetch('/api/ai/variants', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ misses: misses.slice(0, 5) }) });
          const j = await r.json();
          if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
          host.innerHTML = '<h3>Fresh variants — same skills, new questions</h3>' + j.questions.map(function (q, i) {
            return '<div class="disc-tile" style="margin-top:8px"><p><strong>V' + (i + 1) + '</strong> ' + esc(q.stem) + '</p>' +
              '<div style="display:grid;gap:6px">' + q.options.map(function (o, k) { return '<button class="btn secondary small" data-vopt="' + i + ':' + k + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
              '<p class="vfb" style="font-size:13px" hidden></p></div>';
          }).join('');
          var vqs = j.questions;
          host.querySelectorAll('[data-vopt]').forEach(function (b) {
            b.addEventListener('click', function () {
              var parts = b.getAttribute('data-vopt').split(':');
              var qi = Number(parts[0]), picked = Number(parts[1]);
              var q = vqs[qi];
              var fb = b.closest('.disc-tile').querySelector('.vfb');
              fb.hidden = false;
              var ok = picked === q.answer;
              fb.textContent = (ok ? '✓ Correct. ' : '✗ Correct: ' + q.options[q.answer] + '. ') + q.explain;
              fb.style.color = ok ? 'var(--ok)' : 'var(--bad)';
              if (!ok) window.SEHS_AI.mistakes.record({ stem: q.stem, strand: q.strand, picked, correct: q.answer });
            });
          });
        } catch (e) { host.innerHTML = '<p>AI unavailable: ' + esc(e.message) + '</p>'; }
      };
      document.getElementById('mk-todeck').onclick = function () {
        try {
          var decks = JSON.parse(localStorage.getItem('sehs-decks') || '[]');
          decks.push({ title: 'Mock misses ' + new Date().toISOString().slice(0, 10), cards: misses.map(function (m) { return { front: m.stem, back: 'Strand: ' + m.strand }; }) });
          localStorage.setItem('sehs-decks', JSON.stringify(decks));
          toast('Saved ' + misses.length + ' misses as a deck — see Study hub → Your decks');
        } catch (e) { toast('Could not save deck'); }
      };
    }
    area.querySelectorAll('[data-explain]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var i = Number(b.getAttribute('data-explain'));
        var q = state.q[i];
        var p = b.nextElementSibling;
        b.disabled = true;
        b.textContent = 'Thinking…';
        p.hidden = false;
        p.textContent = 'Asking the free tutor…';
        try {
          p.textContent = await window.SEHS_AI.chat('explain',
            'Q: ' + q.stem + ' Options: ' + q.options.join(' / ') + ' Correct: ' + q.options[q.answer]);
        } catch (e) {
          p.textContent = 'AI unavailable: ' + e.message;
        }
        b.textContent = 'Explain with AI';
        b.disabled = false;
      });
    });
  }
})();
