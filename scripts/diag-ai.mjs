import { aiText } from '../server/ai.mjs';
// direct upstream sanity first
try {
  const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai-fast', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 8 }) });
  console.log('direct openai-fast:', r.status);
} catch (e) { console.log('direct NET-ERR', e.message); }
try {
  const r = await fetch('https://text.pollinations.ai/Say%20OK');
  console.log('direct GET:', r.status);
} catch (e) { console.log('direct GET NET-ERR', e.message); }
// layer
try {
  const out = await aiText([{ role: 'user', content: 'Say OK' }], { maxTokens: 8 });
  console.log('aiText OK via', out.via, JSON.stringify(out.text.slice(0, 60)));
} catch (e) { console.log('aiText threw:', JSON.stringify(e)); }
