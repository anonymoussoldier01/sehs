// Shared free-AI helper (server proxy → Pollinations anonymous tier).
// All calls are optional, rate-limited server-side (~1/20s per IP), and never
// include names or personal details — only the study text you submit.
(function () {
  'use strict';
  async function aiChat(mode, input) {
    const r = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ mode, input }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || ('AI request failed (HTTP ' + r.status + ')'));
    return j.text;
  }
  window.SEHS_AI = { chat: aiChat };

  /* ---------- local mistake bank (no server, feeds coach/variants/decks) ---------- */
  function loadMistakes() { try { return JSON.parse(localStorage.getItem('sehs-mistakes') || '[]'); } catch (e) { return []; } }
  function recordMiss(m) {
    try {
      var all = loadMistakes();
      all.unshift({ stem: String(m.stem || '').slice(0, 200), strand: String(m.strand || 'mixed').slice(0, 20), picked: m.picked, correct: m.correct, at: new Date().toISOString() });
      localStorage.setItem('sehs-mistakes', JSON.stringify(all.slice(0, 100)));
    } catch (e) {}
  }
  function strandStats() {
    var m = {}, s = {};
    loadMistakes().forEach(function (x) { m[x.strand] = (m[x.strand] || 0) + 1; });
    try {
      var best = JSON.parse(localStorage.getItem('sehs-mocks') || '{}');
      Object.keys(best).forEach(function (k) { s[k] = best[k].score / Math.max(1, best[k].total); });
    } catch (e) {}
    return { misses: m, mocks: s };
  }
  window.SEHS_AI.mistakes = { all: loadMistakes, record: recordMiss, clear: function () { try { localStorage.removeItem('sehs-mistakes'); } catch (e) {} }, stats: strandStats };
})();
