const g = process.env.GROQ_API_KEY || '', z = process.env.ZHIPU_API_KEY || '';
// keys come from .env via ai.mjs loader pattern
import fs from 'node:fs';
try {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}
const G = process.env.GROQ_API_KEY || '', Z = process.env.ZHIPU_API_KEY || '';
console.log('keys present:', !!G, !!Z);
async function t(name, url, key, model) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 8 }) });
    console.log(name, 'STATUS', r.status, (await r.text()).slice(0, 120));
  } catch (e) { console.log(name, 'NET-ERR', e.message); }
}
await t('groq-qwen', 'https://api.groq.com/openai/v1/chat/completions', G, 'qwen/qwen3.8-27b');
await t('groq-oss', 'https://api.groq.com/openai/v1/chat/completions', G, 'openai/gpt-oss-20b');
await t('zhipu-flash', 'https://api.z.ai/api/paas/v4/chat/completions', Z, 'glm-4.7-flash');
