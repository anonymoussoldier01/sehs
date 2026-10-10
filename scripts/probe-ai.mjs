const base = 'http://localhost:8080';
async function post(path, body, headers = {}) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}
// 1. tutor happy path
let r = await post('/api/ai/chat', { mode: 'tutor', input: 'What is an analogy in one sentence?' });
console.log('tutor:', r.status, JSON.stringify(String(r.body.text || r.body.error).slice(0, 120)));
// 2. bad mode rejected (no upstream cost)
r = await post('/api/ai/chat', { mode: 'nope', input: 'hi' });
console.log('badmode:', r.status, JSON.stringify(r.body));
// 3. empty input rejected
r = await post('/api/ai/chat', { mode: 'tutor', input: ' ' });
console.log('empty:', r.status, JSON.stringify(r.body));
// 4. missing CSRF header rejected
const r4 = await fetch(base + '/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'tutor', input: 'hi there' }) });
console.log('nocsrf:', r4.status);
// 5. over-long input sliced, not rejected (write 1 word check happens client-side)
r = await post('/api/ai/chat', { mode: 'writing', input: 'x'.repeat(5000) });
console.log('long:', r.status, 'cached=' + r.body.cached, JSON.stringify(String(r.body.text || r.body.error).slice(0, 80)));
// 6. second identical call should be a cache hit (no upstream wait)
r = await post('/api/ai/chat', { mode: 'tutor', input: 'What is an analogy in one sentence?' });
console.log('cache:', r.status, 'cached=' + r.body.cached);
