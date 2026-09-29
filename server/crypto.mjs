// Auth + abuse-protection primitives (built-ins only).
import crypto from 'node:crypto';

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEYLEN = 64;

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return { hash, salt };
}
export function verifyPassword(password, hash, salt) {
  try {
    const h = crypto.scryptSync(String(password), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    return h.length === hash.length && crypto.timingSafeEqual(h, hash);
  } catch {
    return false;
  }
}

// URL-safe random token (256-bit default). Returned raw; store only its hash.
export function newToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
export function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest();
}
// Short human-readable password: GEN-xxxx-xxxx... (generated once at setup)
export function generatePasswordwords(words = 5) {
  const parts = [];
  for (let i = 0; i < words; i++) parts.push(crypto.randomBytes(3).toString('base64url').replace(/[^A-Za-z0-9]/g, '').padEnd(4, 'x').slice(0, 4));
  return 'SEHS-' + parts.join('-').toUpperCase();
}

// HMAC-free IP pseudonymisation: salt rotated monthly via meta.
export function ipHash(ip, salt) {
  return crypto.createHash('sha256').update(salt + '|' + String(ip)).digest('hex').slice(0, 32);
}
export function uaFamily(ua) {
  const s = String(ua || '').toLowerCase();
  if (s.includes('edg/')) return 'edge';
  if (s.includes('chrome/') && !s.includes('chromium')) return 'chrome';
  if (s.includes('firefox/')) return 'firefox';
  if (s.includes('safari/') && s.includes('version/')) return 'safari';
  if (s.includes('curl') || s.includes('wget') || s.includes('python')) return 'bot-like';
  return 'other';
}

// In-process token bucket rate limiter: key → {allow(), state}. No timers (lazy expiry).
export function rateLimiter({ capacity, refillPerSec }) {
  const buckets = new Map();
  return {
    allow(key) {
      const now = Date.now() / 1000;
      let b = buckets.get(key);
      if (!b) { b = { tokens: capacity, last: now }; buckets.set(key, b); }
      const elapsed = now - b.last;
      b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
      b.last = now;
      if (b.tokens >= 1) { b.tokens -= 1; return { ok: true, remaining: Math.floor(b.tokens) }; }
      if (buckets.size > 20000) { for (const [k, v] of buckets) if (now - v.last > 3600) buckets.delete(k); }
      return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / refillPerSec) };
    },
    reset(key) { buckets.delete(key); },
  };
}

// Failed-attempt tracker with escalating lockout (for /api/unlock).
export function lockoutTracker({ baseDelaySec = 60, maxDelaySec = 3600 } = {}) {
  const m = new Map();
  return {
    recordFail(key) {
      const e = m.get(key) || { fails: 0, lockedUntil: 0 };
      e.fails += 1;
      e.lockedUntil = Date.now() + Math.min(maxDelaySec, baseDelaySec * 2 ** Math.min(e.fails - 1, 6)) * 1000;
      m.set(key, e);
      return e;
    },
    recordSuccess(key) { m.delete(key); },
    locked(key) {
      const e = m.get(key);
      if (!e) return 0;
      const ms = e.lockedUntil - Date.now();
      if (ms <= 0) { if (e.fails >= 5) m.delete(key); return 0; }
      return Math.ceil(ms / 1000);
    },
  };
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, { maxAgeSec, secure }) {
  const parts = [`sehs_session=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
export function clearSessionCookie(secure) {
  const parts = ['sehs_session=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
