// Study hub + deck modes. All personal data in this browser (localStorage).
// Modes: flip (flashcards) · learn (Leitner MCQ→recall) · test (timed mock).
(function () {
  'use strict';
  var esc = function (s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  function load(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- goals + streak ---------- */
  (function goals() {
    var cd = document.getElementById('exam-countdown');
    if (!cd) return;
    var st = document.getElementById('streak-count');
    var mc = document.getElementById('mastered-count');
    // streak: count consecutive UTC days with any study activity
    function touchStreak() {
      var s = load('sehs-streak', { days: [] });
      var today = new Date().toISOString().slice(0, 10);
      if (!s.days.includes(today)) {
        var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        s.days = s.days.includes(y) || !s.days.length ? [...s.days, today] : [today];
        s.days = s.days.slice(-365);
        save('sehs-streak', s);
      }
      return s.days.length;
    }
    function paint() {
      var ex = load('sehs-exam-date', null);
      if (ex) {
        var diff = Math.ceil((new Date(ex + 'T00:00:00') - Date.now()) / 86400000);
        cd.textContent = diff >= 0 ? diff + (diff === 1 ? ' day' : ' days') : 'Done 🎉';
        document.getElementById('exam-date').value = ex;
      } else cd.textContent = '—';
      st.textContent = touchStreak() + ' 🔥';
      var leit = load('sehs-leitner', {});
      var mastered = 0;
      Object.values(leit).forEach(function (d) { Object.values(d).forEach(function (b) { if (b >= 3) mastered++; }); });
      mc.textContent = mastered;
    }
    document.getElementById('exam-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('exam-date').value;
      if (v) save('sehs-exam-date', v);
      paint();
    });
    document.getElementById('exam-clear').addEventListener('click', function () {
      try { localStorage.removeItem('sehs-exam-date'); } catch (e) {}
      document.getElementById('exam-date').value = '';
      paint();
    });
    paint();
  })();

  /* ---------- hub: deck lists + local decks ---------- */
  (function hub() {
    var grid = document.getElementById('deck-grid');
    if (!grid) return;
    fetch('/api/decks').then(function (r) { return r.json(); }).then(function (j) {
      grid.innerHTML = (j.decks || []).map(function (d) {
        return '<div class="disc-tile"><h3>' + esc(d.title) + '</h3><p>' + esc(d.description || '') + '</p>' +
          '<p style="color:var(--faint);font-size:12.5px">' + d.count + ' cards · ' + esc(d.source) + '</p>' +
          '<a class="btn small" href="/study/' + encodeURIComponent(d.id) + '">Study →</a></div>';
      }).join('') || '<p>No decks yet.</p>';
    }).catch(function () { grid.innerHTML = '<p>Could not load decks.</p>'; });
    paintLocal();
    function paintLocal() {
      var decks = load('sehs-decks', []);
      var host = document.getElementById('local-decks');
      var sel = document.getElementById('card-deck');
      host.innerHTML = decks.length ? decks.map(function (d, i) {
        return '<div class="disc-tile"><h3>' + esc(d.title) + '</h3><p>' + d.cards.length + ' cards · yours</p>' +
          '<a class="btn small" href="/study/local-' + i + '">Study →</a> ' +
          '<button class="btn small secondary" data-deld="' + i + '">Delete</button></div>';
      }).join('') : '<p style="color:var(--mut)">No personal decks yet — create one below.</p>';
      sel.innerHTML = decks.map(function (d, i) { return '<option value="' + i + '">' + esc(d.title) + '</option>'; }).join('');
      document.getElementById('card-add').hidden = !decks.length;
    }
    document.getElementById('deck-new').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = document.getElementById('deck-title').value.trim().slice(0, 80);
      if (!t) return;
      var decks = load('sehs-decks', []);
      decks.push({ title: t, cards: [] });
      save('sehs-decks', decks);
      document.getElementById('deck-title').value = '';
      paintLocal();
      toast('Deck created');
    });
    document.getElementById('card-add').addEventListener('submit', function (e) {
      e.preventDefault();
      var decks = load('sehs-decks', []);
      var d = decks[Number(document.getElementById('card-deck').value)];
      if (!d) return;
      d.cards.push({ front: document.getElementById('card-front').value.trim().slice(0, 500), back: document.getElementById('card-back').value.trim().slice(0, 2000) });
      save('sehs-decks', decks);
      e.target.reset();
      paintLocal();
      toast('Card added');
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-deld]');
      if (!b) return;
      var decks = load('sehs-decks', []);
      decks.splice(Number(b.getAttribute('data-deld')), 1);
      save('sehs-decks', decks);
      paintLocal();
    });
    document.getElementById('deck-export').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(load('sehs-decks', []))], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sehs-decks.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    document.getElementById('deck-import').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var arr = JSON.parse(r.result);
          if (!Array.isArray(arr)) throw 0;
          var decks = load('sehs-decks', []);
          arr.slice(0, 20).forEach(function (d) {
            if (d && d.title && Array.isArray(d.cards)) decks.push({ title: String(d.title).slice(0, 80), cards: d.cards.slice(0, 500) });
          });
          save('sehs-decks', decks);
          paintLocal();
          toast('Decks imported');
        } catch (ex) { toast('Invalid deck file'); }
      };
      r.readAsText(f);
      e.target.value = '';
    });
  })();

  /* ---------- deck modes ---------- */
  (function deck() {
    var main = document.querySelector('[data-deck]');
    if (!main) return;
    var deckId = main.getAttribute('data-deck');
    var mode = 'flip', cards = [], deckTitle = '', order = [], pos = 0, flipped = false;
    var leit = load('sehs-leitner', {});
    function box(i) { return (leit[deckId] || {})[cards[i] && cards[i].front] || 1; }
    function setBox(i, b) {
      if (!leit[deckId]) leit[deckId] = {};
      leit[deckId][cards[i].front] = b;
      save('sehs-leitner', leit);
    }
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    function loadDeck() {
      if (deckId.startsWith('local-')) {
        var d = (load('sehs-decks', []))[Number(deckId.slice(6))];
        if (!d) return done('Deck not found.');
        startDeck(d.title, '', d.cards.map(function (c) { return { front: c.front, back: c.back, resourceId: null }; }));
        return;
      }
      fetch('/api/decks/' + encodeURIComponent(deckId)).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.deck) return done('Deck not found.');
        startDeck(j.deck.title, j.deck.description, j.deck.cards);
      }).catch(function () { done('Could not load deck.'); });
    }
    function done(msg) {
      document.getElementById('deck-title').textContent = msg;
      document.getElementById('study-area').innerHTML = '';
    }
    function startDeck(title, desc, list) {
      deckTitle = title; cards = list;
      document.getElementById('deck-title').textContent = title;
      document.getElementById('deck-crumb').textContent = title;
      document.getElementById('deck-desc').textContent = desc + ' · ' + cards.length + ' cards';
      order = shuffle(cards.map(function (_, i) { return i; }));
      pos = 0;
      render();
    }
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-mode');
        document.querySelectorAll('[data-mode]').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', String(on));
        });
        pos = 0; flipped = false;
        if (mode === 'learn') order = cards.map(function (_, i) { return i; }).sort(function (a, b2) { return box(a) - box(b2); });
        if (mode === 'test') { order = shuffle(cards.map(function (_, i) { return i; })); testState = { i: 0, score: 0, total: Math.min(10, cards.length), answers: [] }; }
        render();
      });
    });
    var testState = null;
    function srcLink(c) {
      return c.resourceId ? ' <a class="link-btn" href="/r/' + c.resourceId + '">Open source →</a>' : '';
    }
    function render() {
      var host = document.getElementById('study-area');
      if (!cards.length) { host.innerHTML = '<p style="color:var(--mut)">This deck is empty.</p>'; return; }
      if (mode === 'flip') {
        var i = order[pos % order.length];
        var c = cards[i];
        host.innerHTML = '<div class="disc-tile" style="text-align:center;padding:32px 20px;cursor:pointer" id="flip-card" role="button" tabindex="0" aria-label="Flip card">' +
          '<p style="font-size:12px;color:var(--faint)">Card ' + ((pos % order.length) + 1) + ' of ' + order.length + (box(i) >= 3 ? ' · mastered ✓' : '') + '</p>' +
          '<p style="font-size:20px;font-weight:700">' + esc(flipped ? c.back : c.front) + '</p>' +
          '<p style="color:var(--faint);font-size:13px">' + (flipped ? 'Back — tap to flip' + srcLink(c) : 'Front — tap to reveal') + '</p></div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn secondary small" id="prev-c">← Prev</button>' +
          '<button class="btn small secondary" id="know-c">I knew it ✓</button>' +
          '<button class="btn small secondary" id="miss-c">Still learning</button>' +
          '<button class="btn secondary small" id="next-c">Next →</button></div>';
        var flip = function () { flipped = !flipped; render(); };
        document.getElementById('flip-card').addEventListener('click', flip);
        document.getElementById('prev-c').onclick = function () { pos = (pos - 1 + order.length) % order.length; flipped = false; render(); };
        document.getElementById('next-c').onclick = function () { pos = (pos + 1) % order.length; flipped = false; render(); };
        document.getElementById('know-c').onclick = function () { setBox(i, Math.min(4, box(i) + 1)); pos = (pos + 1) % order.length; flipped = false; render(); };
        document.getElementById('miss-c').onclick = function () { setBox(i, 1); pos = (pos + 1) % order.length; flipped = false; render(); };
      } else if (mode === 'learn') {
        var j = order[pos % order.length];
        var cc = cards[j];
        var distract = shuffle(cards.filter(function (_, k) { return k !== j; })).slice(0, 3).map(function (x) { return x.back; });
        var opts = shuffle([cc.back].concat(distract));
        host.innerHTML = '<p style="color:var(--mut)">Card ' + ((pos % order.length) + 1) + ' of ' + order.length + '</p>' +
          '<div class="disc-tile"><h3>' + esc(cc.front) + '</h3><div style="display:grid;gap:8px;margin-top:12px">' +
          opts.map(function (o) { return '<button class="btn secondary" data-opt="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') +
          '</div></div>';
        host.querySelectorAll('[data-opt]').forEach(function (b) {
          b.addEventListener('click', function () {
            var right = b.getAttribute('data-opt') === cc.back;
            setBox(j, right ? Math.min(4, box(j) + 1) : 1);
            toast(right ? 'Correct ✓' : 'Not quite — answer: ' + cc.back);
            pos = (pos + 1) % order.length;
            setTimeout(render, right ? 500 : 1400);
          });
        });
      } else {
        var t = testState;
        if (t.i >= t.total) {
          host.innerHTML = '<div class="disc-tile" style="text-align:center"><h3>Score: ' + t.score + ' / ' + t.total + '</h3>' +
            '<p style="color:var(--mut)">' + (t.score === t.total ? 'Perfect. 🎉' : t.score >= t.total * 0.7 ? 'Solid — review the misses below.' : 'Keep practising — review below.') + '</p></div>' +
            t.answers.map(function (a) {
              return '<div class="disc-tile" style="margin-top:8px"><p><strong>' + esc(a.front) + '</strong></p><p style="color:' + (a.ok ? 'var(--ok)' : 'var(--bad)') + '">' + (a.ok ? '✓ ' : '✗ ') + esc(a.picked) + (a.ok ? '' : ' — correct: ' + esc(a.back)) + '</p></div>';
            }).join('') +
            '<div style="margin-top:12px"><button class="btn small" id="retake">Retake</button></div>';
          document.getElementById('retake').onclick = function () { testState = { i: 0, score: 0, total: Math.min(10, cards.length), answers: [] }; render(); };
          return;
        }
        var k = order[t.i];
        var ck = cards[k];
        var dd = shuffle(cards.filter(function (_, x) { return x !== k; })).slice(0, 3).map(function (x) { return x.back; });
        var oo = shuffle([ck.back].concat(dd));
        host.innerHTML = '<p style="color:var(--mut)">Question ' + (t.i + 1) + ' of ' + t.total + ' · score ' + t.score + '</p>' +
          '<div class="disc-tile"><h3>' + esc(ck.front) + '</h3><div style="display:grid;gap:8px;margin-top:12px">' +
          oo.map(function (o) { return '<button class="btn secondary" data-ans="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') +
          '</div></div>';
        host.querySelectorAll('[data-ans]').forEach(function (b) {
          b.addEventListener('click', function () {
            var okk = b.getAttribute('data-ans') === ck.back;
            if (okk) t.score++;
            t.answers.push({ front: ck.front, back: ck.back, picked: b.getAttribute('data-ans'), ok: okk });
            t.i++;
            render();
          });
        });
      }
    }
    loadDeck();
  })();
})();
