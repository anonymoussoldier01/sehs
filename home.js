// Landing: today's session picker (local stats) + cached question of the day.
(function () {
  'use strict';
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // next best move from local data only (no AI call needed)
  try {
    var misses = [];
    try { misses = JSON.parse(localStorage.getItem('sehs-mistakes') || '[]'); } catch (e) {}
    var byStrand = {};
    misses.forEach(function (m) { byStrand[m.strand] = (byStrand[m.strand] || 0) + 1; });
    var top = Object.keys(byStrand).sort(function (a, b) { return byStrand[b] - byStrand[a]; })[0];
    var go = document.getElementById('home-go');
    var next = document.getElementById('home-next');
    if (next) {
      if (top && byStrand[top] >= 2) { next.textContent = 'Your misses pile up in ' + top + ' — hit drills or a mock.'; if (go) go.href = '/drills'; }
      else if (misses.length) { next.textContent = 'Review ' + misses.length + ' logged misses in the study hub.'; if (go) go.href = '/study'; }
      else { next.textContent = 'Take the free diagnostic to find your gaps.'; if (go) go.href = '/mocks/diagnostic-50'; }
    }
  } catch (e) {}
  // question of the day: fixed input → server cache makes it ~1 upstream call/day
  (async function () {
    var q = document.getElementById('home-qotd');
    if (!q) return;
    var day = new Date().toISOString().slice(0, 10);
    try {
      const r = await fetch('/api/ai/questions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ strand: 'verbal', topic: 'question of the day ' + day, n: 3 }) });
      const j = await r.json();
      if (!r.ok || !j.ok || !j.questions.length) throw new Error(j.error || 'failed');
      var item = j.questions[0];
      q.textContent = item.stem + ' — ' + item.options.join(' / ');
      var a = document.getElementById('home-qotd-a');
      var rev = document.getElementById('home-qotd-reveal');
      a.textContent = 'Answer: ' + item.options[item.answer] + '. ' + item.explain;
      rev.hidden = false;
      rev.onclick = function () { a.hidden = false; rev.hidden = true; };
    } catch (e) { q.textContent = 'Question of the day is resting — try drills instead.'; }
  })();
})();
