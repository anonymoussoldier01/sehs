import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
export function readText(p, fallback = '') {
  try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; }
}
export function writeText(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, s, 'utf8'); }
export function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
export function writeJson(p, obj) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }
export function nowIso() { return new Date().toISOString(); }
export function todayDate() { return new Date().toISOString().slice(0, 10); }
export function stableHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
