const base = 'http://localhost:8080';
async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let r = await post('/api/ai/prompt', { kind: 'creative', theme: 'a storm' });
console.log('prompt:', r.status, (r.body?.prompt?.prompt || r.body?.error || '').slice(0, 80));
await sleep(25000);
r = await post('/api/ai/plan', { weeks: 4, weak: ['verbal'], strong: ['maths'], minsPerDay: 30 });
console.log('plan:', r.status, (r.body?.plan || r.body?.error || '').slice(0, 90).replace(/\n/g, ' '));
await sleep(25000);
r = await post('/api/ai/variants', { misses: [{ stem: 'Next: 2, 4, 8, 16, ?', strand: 'quant' }] });
console.log('variants:', r.status, 'n=' + (r.body?.questions?.length ?? '-'), (r.body?.questions?.[0]?.stem || r.body?.error || '').slice(0, 70));
await sleep(25000);
r = await post('/api/ai/flashcards', { topic: 'BODMAS rules' });
console.log('flashcards:', r.status, 'n=' + (r.body?.cards?.length ?? '-'), (r.body?.cards?.[0]?.front || r.body?.error || '').slice(0, 70));
