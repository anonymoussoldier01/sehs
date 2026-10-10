// Study-hub AI tools: deck generator, study plan, mistake coach. All personal
// data stays in the browser; only counts/patterns are sent for plans.
(function () {
  'use strict';
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function show(text) {
    document.getElementById('ai-study-out').hidden = false;
    document.getElementById('ai-study-body').textContent = text;
    document.getElementById('ai-study-out').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  var deckGo = document.getElementById('ai-deck-go');
  if (deckGo) deckGo.onclick = async function () {
    var topic = document.getElementById('ai-deck-topic').value.trim();
    var msg = document.getElementById('ai-deck-msg');
    if (topic.length < 3) { msg.textContent = 'Name a topic first.'; return; }
    msg.textContent = 'Making cards…';
    try {
      const j = await post('/api/ai/flashcards', { topic });
      var decks = [];
      try { decks = JSON.parse(localStorage.getItem('sehs-decks') || '[]'); } catch (e) {}
      decks.push({ title: 'AI: ' + topic.slice(0, 60), cards: j.cards });
      localStorage.setItem('sehs-decks', JSON.stringify(decks));
      msg.textContent = 'Saved ' + j.cards.length + ' cards to Your decks below — reload the decks list to study.';
      show('Deck "' + topic + '" ready with ' + j.cards.length + ' cards.' + (j.cached ? ' (instant)' : ''));
    } catch (e) { msg.textContent = 'AI unavailable: ' + e.message; }
  };
  var planGo = document.getElementById('ai-plan-go');
  if (planGo) planGo.onclick = async function () {
    var msg = document.getElementById('ai-plan-msg');
    msg.textContent = 'Building plan…';
    var stats = window.SEHS_AI.mistakes.stats();
    var weak = Object.keys(stats.misses).sort((a, b) => stats.misses[b] - stats.misses[a]).slice(0, 4);
    try {
      const j = await post('/api/ai/plan', { weeks: Number(document.getElementById('ai-plan-weeks').value) || 8, weak, strong: [], minsPerDay: 45 });
      show((j.cached ? '(instant)\n' : '') + j.plan);
      msg.textContent = 'Plan ready below. Screenshot or print it — it lives only here.';
    } catch (e) { msg.textContent = 'AI unavailable: ' + e.message; }
  };
  var coachGo = document.getElementById('ai-coach-go');
  if (coachGo) coachGo.onclick = async function () {
    var all = window.SEHS_AI.mistakes.all();
    if (!all.length) { show('No mistakes logged yet — do a mock or drills first, then I can coach you.'); return; }
    var byStrand = {};
    all.forEach(function (m) { byStrand[m.strand] = (byStrand[m.strand] || 0) + 1; });
    var top = Object.keys(byStrand).sort((a, b) => byStrand[b] - byStrand[a]).slice(0, 3);
    show('Coaching…');
    try {
      const t = await window.SEHS_AI.chat('tutor',
        'My SEHS mistake counts by strand: ' + top.map(s => s + ' ×' + byStrand[s]).join(', ') +
        '. Recent misses: ' + all.slice(0, 4).map(m => m.stem).join(' | ') +
        '. Give my top 3 gaps and exactly what to drill this week (name drill kinds/decks). Under 150 words.');
      show(t);
    } catch (e) { show('AI unavailable (' + e.message + '). Meanwhile: drill ' + top.join(', ') + ' — ' + all.length + ' misses logged.'); }
  };
})();
