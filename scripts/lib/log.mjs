import fs from 'node:fs';
import { nowIso } from './store.mjs';

let logFile = null;
export function setLogFile(p) { logFile = p; }
export function log(level, msg, extra = {}) {
  const line = `[${nowIso()}] ${level.toUpperCase()} ${msg}` + (Object.keys(extra).length ? ' ' + JSON.stringify(extra) : '');
  console.log(line);
  if (logFile) {
    try { fs.appendFileSync(logFile, line + '\n', 'utf8'); } catch {}
  }
}
export function redact(s) {
  if (!s) return s;
  // mask anything that looks like a key in logs
  return String(s).replace(/AIza[0-9A-Za-z\-_]{10,}/g, 'AIza***REDACTED***').replace(/ghp_[0-9A-Za-z]{10,}/g, 'ghp_***REDACTED***');
}
