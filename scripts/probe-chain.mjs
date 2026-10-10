const base = 'http://localhost:8080';
async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}
let r = await post('/api/ai/chat', { mode: 'tutor', input: 'What is an analogy in one sentence?' });
console.log('chat:', r.status, JSON.stringify(String(r.body.text || r.body.error).slice(0, 150)));
