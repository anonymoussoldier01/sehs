const base = 'http://localhost:8080';
async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}
async function get(path) {
  const r = await fetch(base + path);
  return { status: r.status, len: (await r.text()).length };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
console.log('--- pages ---');
for (const u of ['/', '/reading', '/study', '/exam-guide', '/search?q=maths']) {
  const r = await get(u);
  console.log(r.status, u, 'len=' + r.len);
}
console.log('--- ai endpoints (spaced) ---');
let r = await post('/api/ai/grade', { kind: 'persuasive', essay: 'School should start later. First, teenagers need sleep because their brains grow at night. For example, my friend falls asleep in maths. However, some say buses would clash. Finally, healthy students learn faster, so the change is worth it. '.repeat(4) });
console.log('grade:', r.status, 'auto=' + r.body?.auto?.overall, 'ai=' + (r.body?.ai ? 'band ' + r.body.ai.overall + ' via?' : 'fallback'), r.body?.note || '');
await sleep(17000);
r = await post('/api/ai/questions', { strand: 'verbal', topic: 'analogies', n: 3 });
console.log('questions:', r.status, 'n=' + (r.body?.questions?.length ?? '-'), (r.body?.questions?.[0]?.stem || r.body?.error || '').slice(0, 70));
await sleep(17000);
r = await post('/api/ai/passage', { genre: 'fiction', seed: 'a lighthouse' });
console.log('passage:', r.status, 'title=' + (r.body?.passage?.title || r.body?.error || '').slice(0, 60), 'qs=' + (r.body?.passage?.questions?.length ?? '-'));
await sleep(17000);
r = await post('/api/ai/prompt', { kind: 'creative', theme: 'a storm' });
console.log('prompt:', r.status, (r.body?.prompt?.prompt || r.body?.error || '').slice(0, 70));
await sleep(17000);
r = await post('/api/ai/plan', { weeks: 4, weak: ['verbal'], strong: ['maths'], minsPerDay: 30 });
console.log('plan:', r.status, (r.body?.plan || r.body?.error || '').slice(0, 80).replace(/\n/g, ' '));
await sleep(17000);
r = await post('/api/ai/variants', { misses: [{ stem: 'Next: 2, 4, 8, 16, ?', strand: 'quant' }] });
console.log('variants:', r.status, 'n=' + (r.body?.questions?.length ?? '-'), (r.body?.questions?.[0]?.stem || r.body?.error || '').slice(0, 70));
await sleep(17000);
r = await post('/api/ai/flashcards', { topic: 'BODMAS rules' });
console.log('flashcards:', r.status, 'n=' + (r.body?.cards?.length ?? '-'), (r.body?.cards?.[0]?.front || r.body?.error || '').slice(0, 70));
