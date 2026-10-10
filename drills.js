// Infinite Year-8 maths drills (deterministic RNG, local streak).
(function () {
  'use strict';
  var cur = null, kind = 'fraction';
  var streak = 0;
  function rnd(n) { return Math.floor(Math.random() * n); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function gen(k) {
    if (k === 'fraction') {
      var a = 2 + rnd(10), b = 2 + rnd(10);
      var g = gcd(a, b);
      return { q: 'Simplify ' + a + '/' + b, a: (a / g) + '/' + (b / g), why: 'Divide by ' + g + '.' };
    }
    if (k === 'percent') {
      var p = [10, 20, 25, 50, 75][rnd(5)], n = (1 + rnd(12)) * 10;
      return { q: p + '% of ' + n + '?', a: String(n * p / 100), why: p + '% = ' + p + '/100.' };
    }
    if (k === 'algebra') {
      var x = 2 + rnd(9), m = 2 + rnd(5), c = 1 + rnd(9);
      return { q: 'Solve ' + m + 'x+' + c + '=' + (m * x + c), a: 'x=' + x, why: '−' + c + ' then ÷' + m + '.' };
    }
    if (k === 'bodmas') {
      var a2 = 2 + rnd(8), b2 = 2 + rnd(8), c2 = 2 + rnd(8);
      return { q: a2 + '+' + b2 + '×' + c2 + '?', a: String(a2 + b2 * c2), why: '× before +.' };
    }
    var s = 2 + rnd(6), d = 2 + rnd(5);
    var seq = [s, s + d, s + 2 * d, s + 3 * d];
    return { q: 'Next: ' + seq.join(', ') + ', ?', a: String(s + 4 * d), why: '+' + d + ' each step.' };
  }
  function next() {
    cur = gen(kind);
    document.getElementById('drill-q').textContent = cur.q;
    document.getElementById('drill-a').textContent = 'Streak: ' + streak + ' 🔥';
    document.getElementById('drill-in').value = '';
    document.getElementById('drill-msg').textContent = '';
    document.getElementById('drill-in').focus();
  }
  function check() {
    if (!cur) return;
    if (cur.mcq) return checkMcq();
    var v = document.getElementById('drill-in').value.trim().replace(/\s+/g, '');
    var ok = v === cur.a.replace(/\s+/g, '') || v.toLowerCase() === cur.a.toLowerCase().replace(/\s+/g, '');
    if (ok) { streak++; bumpStrand(kind, true); document.getElementById('drill-msg').textContent = '✓ Correct. ' + cur.why; document.getElementById('drill-msg').style.color = 'var(--ok)'; }
    else { streak = 0; bumpStrand(kind, false); window.SEHS_AI.mistakes.record({ stem: cur.q, strand: strandOf(kind), picked: v, correct: cur.a }); document.getElementById('drill-msg').textContent = '✗ Answer: ' + cur.a + '. ' + cur.why; document.getElementById('drill-msg').style.color = 'var(--bad)'; }
    document.getElementById('drill-a').textContent = 'Streak: ' + streak + ' 🔥 · ' + autoLevel();
  }
  function strandOf(k) { return k === 'sequence' ? 'quant' : (k === 'fraction' || k === 'percent' || k === 'algebra' || k === 'bodmas') ? 'maths' : 'mixed'; }
  function bumpStrand(k, ok) {
    try {
      var s = JSON.parse(localStorage.getItem('sehs-drill-strands') || '{}');
      var e = s[k] || { ok: 0, n: 0 };
      e.n++; if (ok) e.ok++;
      s[k] = e;
      localStorage.setItem('sehs-drill-strands', JSON.stringify(s));
    } catch (e) {}
  }
  function autoLevel() {
    try {
      var s = JSON.parse(localStorage.getItem('sehs-drill-strands') || '{}');
      var e = s[kind];
      if (!e || e.n < 5) return 'warmup';
      var acc = e.ok / e.n;
      return acc >= 0.85 ? 'stretch' : acc >= 0.6 ? 'exam' : 'warmup';
    } catch (e) { return 'warmup'; }
  }
  /* ---------- AI question sets (server proxy, validated MCQ) ---------- */
  var aiSet = null, aiPos = 0;
  function strandForAi() {
    return kind === 'fraction' || kind === 'percent' ? 'maths' : kind === 'sequence' ? 'quant' : kind === 'algebra' || kind === 'bodmas' ? 'maths' : 'maths';
  }
  async function aiNext() {
    var msg = document.getElementById('drill-msg');
    msg.textContent = 'Asking AI for a fresh set…';
    msg.style.color = 'var(--mut)';
    try {
      const r = await fetch('/api/ai/questions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ strand: strandForAi(), topic: kind + ' (' + autoLevel() + ')', n: 5 }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
      aiSet = j.questions; aiPos = 0;
      showMcq();
    } catch (e) { msg.textContent = 'AI unavailable: ' + e.message; msg.style.color = 'var(--bad)'; }
  }
  function showMcq() {
    var q = aiSet[aiPos % aiSet.length];
    cur = { mcq: true, q: q };
    document.getElementById('drill-q').textContent = q.stem + '  (AI set ' + ((aiPos % aiSet.length) + 1) + '/' + aiSet.length + ')';
    document.getElementById('drill-a').textContent = 'Streak: ' + streak + ' 🔥 · AI';
    var inp = document.getElementById('drill-in');
    inp.value = '';
    inp.placeholder = 'Tap an option below (A-D) or type it';
    document.getElementById('drill-msg').innerHTML = '';
    var host = document.getElementById('drill-msg');
    q.options.forEach(function (o, k) {
      var b = document.createElement('button');
      b.className = 'btn secondary small';
      b.style.margin = '4px 4px 0 0';
      b.textContent = 'ABCD'[k] + '. ' + o;
      b.onclick = function () { document.getElementById('drill-in').value = 'ABCD'[k]; checkMcq(); };
      host.appendChild(b);
    });
    inp.focus();
  }
  function checkMcq() {
    var q = cur.q;
    var v = document.getElementById('drill-in').value.trim().toUpperCase().replace(/[^A-D]/g, '').slice(-1);
    var map = { A: 0, B: 1, C: 2, D: 3 };
    var msg = document.getElementById('drill-msg');
    if (!(v in map)) { msg.textContent = 'Pick A, B, C or D.'; msg.style.color = 'var(--mut)'; return; }
    var ok = map[v] === q.answer;
    if (ok) { streak++; bumpStrand(kind, true); msg.textContent = '✓ Correct. ' + q.explain; msg.style.color = 'var(--ok)'; }
    else { streak = 0; bumpStrand(kind, false); window.SEHS_AI.mistakes.record({ stem: q.stem, strand: strandForAi(), picked: map[v], correct: q.answer }); msg.textContent = '✗ Correct: ' + 'ABCD'[q.answer] + '. ' + q.explain; msg.style.color = 'var(--bad)'; }
    document.getElementById('drill-a').textContent = 'Streak: ' + streak + ' 🔥 · AI';
    aiPos++;
    setTimeout(function () { if (aiSet) showMcq(); }, ok ? 900 : 2200);
  }
  document.querySelectorAll('[data-drill]').forEach(function (b) {
    b.onclick = function () {
      kind = b.getAttribute('data-drill');
      aiSet = null;
      document.querySelectorAll('[data-drill]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      next();
    };
  });
  document.getElementById('drill-check').onclick = check;
  document.getElementById('drill-next').onclick = function () { if (aiSet) { showMcq(); } else next(); };
  var aiBtn = document.getElementById('drill-ai');
  if (aiBtn) aiBtn.onclick = aiNext;
  document.getElementById('drill-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (!cur) next(); else if (!document.getElementById('drill-msg').textContent) check(); else next(); } });
})();
