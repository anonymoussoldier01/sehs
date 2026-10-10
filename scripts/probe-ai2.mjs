const base = 'http://localhost:8080';
async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// grade (heuristic always answers, even if AI is busy)
let r = await post('/api/ai/grade', { kind: 'persuasive', essay: 'School should start later. First, teenagers need sleep because their brains grow at night. For example, my friend falls asleep in maths. However, some say buses would clash. Finally, healthy students learn faster, so the change is worth it. '.repeat(4) });
console.log('grade:', r.status, 'overall=' + r.body?.auto?.overall, 'ai=' + (r.body?.ai ? 'yes(band ' + r.body.ai.overall + ')' : 'no') , r.body?.note || '');
// wait out the shared throttle
await sleep(17000);
r = await post('/api/ai/questions', { strand: 'maths', topic: 'fractions', n: 3 });
console.log('questions:', r.status, 'count=' + (r.body?.questions?.length ?? '-'), (r.body?.questions?.[0]?.stem || r.body?.error || '').slice(0, 80));
await sleep(17000);
r = await post('/api/ai/flashcards', { topic: 'analogies' });
console.log('flashcards:', r.status, 'count=' + (r.body?.cards?.length ?? '-'), (r.body?.cards?.[0]?.front || r.body?.error || '').slice(0, 80));
await sleep(17000);
r = await post('/api/ai/chat', { mode: 'tutor', input: 'What is an analogy in one sentence?' });
console.log('chat:', r.status, (r.body?.text || r.body?.error || '').slice(0, 100));
