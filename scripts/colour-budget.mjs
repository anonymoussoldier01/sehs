// Colour budget gate (no browser needed).
// Fails if client/src or client/dist CSS still uses banned hues outside tokens.
// Allowed: neutral navy/ivory/paper vars, sky accent vars, success/error vars
// (only in feedback contexts), plus deprecated aliases that now point at accent.
// Banned: amber/yellow/orange hex, per-school hues, blue/purple/red/green decor,
// gradients between two hues, multi-colour glows, rainbow confetti/charts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '..');
const srcDir = path.join(repo, 'client', 'src');
const distCssDir = path.join(repo, 'client', 'dist', 'assets');

const BANNED_HEX = [
  '#F5B83D', '#f5b83d', // amber retired
  '#4C8DFF', '#4c8dff', // Mac.Rob blue
  '#2FBF8F', '#2fbf8f', // Nossal green
  '#D64550', '#d64550', // MHS red
  '#8B6CF0', '#8b6cf0', // SC purple
  '#b45309', '#B45309',
  '#38bdf8', '#38BDF8',
  '#1d4ed8', '#0e7490', '#7c3aed', '#a855f7', '#ec4899',
  '#F59E0B', '#FDE68A', '#10B981', '#5b8cff', '#5b6cff',
];

const BANNED_RE = [
  /amber-\d+|amber(?![-_]*(ink)?\b)/i,
  /red-\d+|purple-\d+|green-\d+|blue-\d+|yellow-\d+|orange-\d+|pink-\d+|violet-\d+|cyan-\d+|emerald-\d+|lime-\d+|fuchsia-\d+|teal-\d+/,
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|css|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

let failures = [];
// 1. Source scan: banned hex must not appear in styling positions.
// Allow: comments mentioning retired hex, DESIGN docs, colour-budget itself,
// success/error token definitions, and the confetti calm ramp (#7DB2FF etc).
const allowFiles = new Set(['colour-budget.mjs', 'landing-teardown.md']);
for (const f of walk(srcDir)) {
  const rel = path.relative(repo, f);
  if ([...allowFiles].some((a) => rel.endsWith(a))) continue;
  const txt = fs.readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  lines.forEach((line, i) => {
    const stripped = line.trim();
    if (stripped.startsWith('//') || stripped.startsWith('*') || stripped.startsWith('/*')) return;
    // Allow Design colours page to name retired hues in before/after copy.
    if (rel.endsWith('pages/Design.jsx') && /retired|Before|After/.test(line)) return;
    for (const hex of BANNED_HEX) {
      if (line.includes(hex)) {
        // Allow the calm confetti ramp + accent ramp definitions in index.css
        if (rel.endsWith('index.css') && ['#7DB2FF', '#B9D2FF', '#F4F0E6', '#A7B0C6'].includes(hex)) continue;
        failures.push(`${rel}:${i + 1} banned hex ${hex}`);
      }
    }
    for (const re of BANNED_RE) {
      const m = line.match(re);
      if (m) {
        // Allow --amber-ink / --amber aliases (now point at accent) + docs
        if (/--amber-ink|--amber\b|--brand\b/.test(line) && !/amber-\d+/.test(line)) continue;
        if (/Tailwind classes such as/.test(line)) continue;
        failures.push(`${rel}:${i + 1} banned hue class/token ${m[0]}`);
      }
    }
    // Two-hue gradients: linear/conic with two distinct colour stops (not accent-soft fades)
    if (/linear-gradient|conic-gradient/.test(line) && /#38bdf8|#ec4899|#1d4ed8|#0e7490|#a855f7|#7c3aed/i.test(line)) {
      failures.push(`${rel}:${i + 1} two-hue gradient`);
    }
  });
}

// 2. Built CSS scan (if dist exists): same banned hex must be gone from output.
if (fs.existsSync(distCssDir)) {
  for (const e of fs.readdirSync(distCssDir)) {
    if (!e.endsWith('.css')) continue;
    const txt = fs.readFileSync(path.join(distCssDir, e), 'utf8');
    for (const hex of ['#F5B83D', '#f5b83d', '#4C8DFF', '#2FBF8F', '#D64550', '#8B6CF0', '#38bdf8', '#ec4899']) {
      if (txt.includes(hex)) failures.push(`client/dist/assets/${e} still contains ${hex}`);
    }
  }
}

if (failures.length) {
  console.error('COLOUR BUDGET FAIL:');
  for (const f of failures.slice(0, 60)) console.error(' - ' + f);
  if (failures.length > 60) console.error(` ... +${failures.length - 60} more`);
  console.error('\nRule: hues outside {neutral navy 200-250°, sky accent, ivory/cream} only inside [data-feedback].');
  process.exit(1);
} else {
  console.log('Colour budget OK: no banned hues in client/src (+ dist).');
}
