// Thin wrappers over the platform JSON API (same origin in prod,
// Vite dev-proxy in development).
const POST_H = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };

async function get(path) {
  const r = await fetch(path);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: POST_H, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) {
    const err = new Error(j.error || `Request failed (${r.status})`);
    err.status = r.status;
    err.retryAfter = j.retryAfter;
    throw err;
  }
  return j;
}

export const api = {
  stats: () => get('/api/stats'),
  search: (params) => get('/api/search?' + new URLSearchParams(params)),
  suggest: (prefix) => get('/api/suggest?prefix=' + encodeURIComponent(prefix)),
  byIds: (ids) => get('/api/by-ids?ids=' + encodeURIComponent(ids.join(','))),
  trending: () => get('/api/trending'),
  fresh: () => get('/api/new'),
  decks: () => get('/api/decks'),
  deck: (id) => get('/api/decks/' + encodeURIComponent(id)),
  mocks: () => get('/api/mocks'),
  mock: (id) => get('/api/mocks/' + encodeURIComponent(id)),
  writing: () => get('/api/writing'),
  reading: () => get('/api/reading'),
  announcement: () => get('/api/announcement').catch(() => ({ body: null })),
  terms: () => get('/api/terms'),
  access: (id) => post('/api/access/' + encodeURIComponent(id), {}),
  report: (resourceId, reason, detail) => post('/api/reports', { resourceId, reason, detail }),
  request: (title, detail) => post('/api/requests', { title, detail }),
  unlock: (password) => post('/api/unlock', { password }),
  aiChat: (mode, input) => post('/api/ai/chat', { mode, input }),
  aiGrade: (kind, essay) => post('/api/ai/grade', { kind, essay }),
  aiQuestions: (strand, topic, n) => post('/api/ai/questions', { strand, topic, n }),
  aiFlashcards: (topic) => post('/api/ai/flashcards', { topic }),
  aiPassage: (genre, seed) => post('/api/ai/passage', { genre, seed }),
  aiPrompt: (kind, theme) => post('/api/ai/prompt', { kind, theme }),
  aiPlan: (weeks, weak, strong, minsPerDay) => post('/api/ai/plan', { weeks, weak, strong, minsPerDay }),
  aiVariants: (misses) => post('/api/ai/variants', { misses }),
};

export function pretty(s) {
  const ACR = { vsse: 'VSSE', acer: 'ACER', vcaa: 'VCAA', naplan: 'NAPLAN' };
  return String(s || '')
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((w) => ACR[w.toLowerCase()] || w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function esc(s) {
  return String(s ?? '');
}
