// Native AI provider layer: Groq + Zhipu (free keys) → Pollinations anonymous
// (no key) → plain-GET fallback. First success wins; failures fall through.
//
// Honesty note: free shared quotas are not an SLA. Every feature built on
// this MUST have a local fallback (see callers). Prompt content is never
// logged and never stored — cache rows are keyed by hash only. API keys
// live in server env only and never leave the machine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Minimal .env loader (no deps): local gitignored secrets for the AI chain.
// Runs at import time — before boot finishes — so lazy readers below always
// see values even when the process was started without env vars set.
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env — keyless chain still works */ }

const env = (k, fb) => process.env[k] || fb;
function keyedProviders() {
  return [
    { id: 'groq', base: 'https://api.groq.com/openai/v1/chat/completions', key: env('GROQ_API_KEY', ''), model: env('GROQ_MODEL', 'qwen/qwen3.8-27b') },
    { id: 'groq-oss', base: 'https://api.groq.com/openai/v1/chat/completions', key: env('GROQ_API_KEY', ''), model: 'openai/gpt-oss-20b' },
    { id: 'zhipu', base: 'https://api.z.ai/api/paas/v4/chat/completions', key: env('ZHIPU_API_KEY', ''), model: env('ZHIPU_MODEL', 'glm-4.7-flash') },
  ];
}
const pollBase = () => env('POLLINATIONS_BASE', 'https://text.pollinations.ai/openai');
const pollGetBase = () => (env('POLLINATIONS_BASE_GET', 'https://text.pollinations.ai')).replace(/\/$/, '');
const pollModels = () => [env('POLLINATIONS_MODEL', 'openai-fast'), 'openai-fast'];
const geminiModel = () => env('GEMINI_AI_MODEL', 'gemini-2.0-flash');
const coolUntil = new Map(); // provider/model -> timestamp ms (skip after 401/402/404/429)
let lastUpstreamAt = 0;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const nowIso = () => new Date().toISOString();

// ---- persistent cache (sync handle, same style as the rest of the server) ----
export function aiCacheGet(db, key) {
  try {
    const row = db.prepare('SELECT text, created_at FROM ai_cache WHERE key = ?').get(key);
    if (!row) return null;
    if (Date.now() - Date.parse(row.created_at) > 24 * 3600 * 1000) return null; // 24h TTL
    return row.text;
  } catch { return null; }
}
export function aiCacheSet(db, key, mode, text) {
  try {
    db.prepare('INSERT INTO ai_cache(key, mode, text, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET text = excluded.text, created_at = excluded.created_at')
      .run(key, mode, text, nowIso());
    db.prepare('DELETE FROM ai_cache WHERE rowid NOT IN (SELECT rowid FROM ai_cache ORDER BY created_at DESC LIMIT 500)').run();
  } catch { /* cache must never break requests */ }
}

// ---- upstream ---------------------------------------------------------------
// Provider chain: Gemini (free key, generous quota) → Pollinations anonymous
// models → plain-GET fallback. First success wins; failures fall through.
// Returns { text, via } or throws { status } where status is 'busy'|'down'.
async function geminiText(messages, maxTokens, temperature) {
  const key = env('GEMINI_AI_KEY', '');
  if (!key) throw { status: 'skip' };
  if ((coolUntil.get('gemini') || 0) > Date.now()) throw { status: 'busy' };
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 25000);
  try {
    // Key travels server→Google only; never exposed to the browser.
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n') || 'You are a helpful tutor.' }] },
        contents: messages.filter(m => m.role !== 'system').map(m => ({ parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
      signal: ctl.signal,
    });
    if (r.status === 429) { coolUntil.set('gemini', Date.now() + 70 * 1000); throw { status: 'busy' }; }
    if (!r.ok) throw { status: 'down' };
    const j = await r.json();
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('').trim();
    if (!text) throw { status: 'down' };
    return { text, via: 'gemini:' + geminiModel() };
  } catch (e) {
    if (e && e.status) throw e;
    throw { status: 'down' };
  } finally { clearTimeout(to); }
}
async function openaiPost(entry, messages, maxTokens, temperature, anonymous) {
  const id = anonymous ? 'poll:' + entry : entry.id + ':' + entry.model;
  if ((coolUntil.get(id) || 0) > Date.now()) throw { status: 'busy' };
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 25000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    let url, payload;
    if (anonymous) {
      // NOTE: no Authorization header — the free anonymous tier rejects keyed calls.
      url = pollBase();
      payload = { model: entry, messages, max_tokens: maxTokens, temperature };
    } else {
      if (!entry.key) throw { status: 'skip' };
      url = entry.base;
      headers.Authorization = 'Bearer ' + entry.key;
      payload = { model: entry.model, messages, max_tokens: maxTokens, temperature };
    }
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctl.signal });
    if ([401, 402, 404, 429].includes(r.status)) {
      // 429 = slow down briefly; 401/402/404 = wrong key, no budget, dead
      // model — park longer. Never log prompts, only outcomes.
      coolUntil.set(id, Date.now() + (r.status === 429 ? 70 : 600) * 1000);
      throw { status: r.status === 401 ? 'down' : 'busy' };
    }
    if (!r.ok) throw { status: 'down' };
    const j = await r.json();
    const text = String(j?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw { status: 'down' };
    return { text, via: id };
  } catch (e) {
    if (e && e.status) throw e;
    throw { status: 'down' };
  } finally { clearTimeout(to); }
}

async function getFallback(prompt, maxChars) {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(pollGetBase() + '/' + encodeURIComponent(prompt.slice(0, 1500)), { signal: ctl.signal });
      if (!r.ok) throw { status: 'down' };
      const text = (await r.text()).trim().slice(0, maxChars);
      if (!text) throw { status: 'down' };
      return { text, via: 'get' };
    } finally { clearTimeout(to); }
  } catch (e) {
    if (e && e.status) throw e;
    throw { status: 'down' };
  }
}

// Main entry. Uses the shared 16s upstream throttle via the caller's gate;
// throws { status:'busy' } when the shared quota is hot, { status:'down' }
// when every provider failed.
export async function aiText(messages, { maxTokens = 400, temperature = 0.7, maxChars = 1500, json = false } = {}) {
  if (Date.now() - lastUpstreamAt < 16000) throw { status: 'busy' };
  lastUpstreamAt = Date.now();
  let lastErr = { status: 'down' };
  try {
    const r = await geminiText(messages, maxTokens, temperature);
    return { text: r.text.slice(0, maxChars), via: r.via };
  } catch (e) { lastErr = e && e.status ? e : { status: 'down' }; }
  if (lastErr.status === 'skip') lastErr = { status: 'down' };
  for (const entry of keyedProviders()) {
    try {
      const r = await openaiPost(entry, messages, maxTokens, temperature, false);
      return { text: r.text.slice(0, maxChars), via: r.via };
    } catch (e) { lastErr = e && e.status ? e : { status: 'down' }; }
  }
  for (const model of [...new Set(pollModels())]) {
    try {
      const r = await openaiPost(model, messages, maxTokens, temperature, true);
      return { text: r.text.slice(0, maxChars), via: r.via };
    } catch (e) { lastErr = e && e.status ? e : { status: 'down' }; }
  }
  try {
    // Plain-GET fallback: flatten messages into one prompt.
    const flat = messages.map(m => m.content).join('\n\n').slice(0, 1500);
    const r = await getFallback((json ? 'Reply with ONLY valid JSON, no other text. ' : '') + flat, maxChars);
    return r;
  } catch (e) { lastErr = e && e.status ? e : { status: 'down' }; }
  lastUpstreamAt = 0; // our fault, not the quota's — don't penalise next caller
  throw lastErr;
}
export function aiCacheKey(mode, input) { return sha(mode + '\n' + input); }

// Parse a JSON array/object out of model output (tolerates prose wrapping).
export function extractJson(text) {
  const m = String(text).match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
