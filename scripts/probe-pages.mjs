const base = 'http://localhost:8080';
async function check(path, needles) {
  const r = await fetch(base + path);
  const t = await r.text();
  const missing = needles.filter(n => !t.includes(n));
  console.log(r.status, path, missing.length ? 'MISSING ' + missing.join(',') : 'OK all hooks');
}
await check('/', ['home-qotd', 'home-go', 'moremenu', 'Library']);
await check('/study', ['ai-deck-go', 'ai-plan-go', 'ai-coach-go', 'ai-study-out']);
await check('/reading', ['read-ai', 'read-genre', 'read-area']);
await check('/writing', ['ai-grade', 'grade-out', 'prompt-ai']);
await check('/drills', ['drill-ai']);
await check('/exam-guide', ['tutor-go', 'tutor-a']);
await check('/search?q=maths', ['explain-results']);
await check('/mocks/diagnostic-50', ['mock-area']);
