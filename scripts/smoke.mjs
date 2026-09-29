// Smoke test: dataset integrity + search engine sanity. Run: npm test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, search, suggest, normalizeQuery, cleanDisplayName, computeStats } from '../search.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'links.json'), 'utf8'));
const idx = buildIndex(links);
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra}`); };

// dataset integrity
ok('dataset loads (1641)', links.length === 1641, ` (${links.length})`);
ok('all urls are drive links', links.every(r => /^https:\/\/drive\.google\.com\//.test(r.url)));
ok('ids unique', new Set(links.map(r => r.id)).size === links.length);
// engine basics
ok('index builds', idx.total === 1641 && idx.vocab.size > 100);
const R = (q, opts) => search(idx, q, opts);
ok('exact: vsse', R('vsse').results.length === 15);
ok('multi-term + order invariance',
  R('capricorn practice paper').results.length >= 1 &&
  R('capricorn practice paper').results[0]?.rec.id === R('practice paper capricorn').results[0]?.rec.id);
ok('phrase outranks partial', /capricorn practice paper/i.test(R('capricorn practice paper').results[0]?.displayTitle || ''));
ok('typo rescued (capricon)', R('capricon').mode === 'fuzzy' && R('capricon').corrected === 'capricorn');
ok('normalisation (practise/math/_-)', R('practise paper').results.length > 0 && R('math').results.length > 100 &&
  R('practice_test').results.length === R('practice test').results.length);
ok('intent (papers with answers)', R('papers with answers').results.slice(0, 5).every(x => (x.rec.tags || []).includes('answers')));
ok('nonsense → none', R('zzzznothinghere').mode === 'none' && R('zzzznothinghere').results.length === 0);
ok('double-typo correction', !!R('capricon practce').corrected);
ok('suggestions dataset-derived', suggest(idx, 'cap').length > 0 && suggest(idx, 'acc').some(s => s.label === 'acer'));
ok('titles clean', idx.docs.every(d => !/~\$|20\d{6}T\d{6}Z|\.pdf$|\.docx$/i.test(d.displayTitle)));
const st = computeStats(links);
ok('stats live', st.total === 1641 && st.subjects > 0 && st.providers > 0, ` (${st.subjects} subjects, ${st.providers} providers)`);
// perf
const qs = ['vsse', 'maths answers', 'capricorn practice paper', 'science homework', ''];
const p0 = performance.now();
for (let i = 0; i < 40; i++) for (const q of qs) search(idx, q);
const ms = performance.now() - p0;
ok('200 searches <1s', ms < 1000, ` (${ms.toFixed(0)}ms)`);
// frontend wiring: every js-referenced id exists in html
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...js.matchAll(/els\['([^']+)'\]|\$\('([^']+)'\)/g)].flatMap(m => m.slice(1).filter(Boolean)));
const missing = [...used].filter(u => !ids.has(u) && u !== 'dym-apply' && u !== 'm-copy');
ok('frontend ids wired', missing.length === 0, missing.length ? ` missing: ${missing}` : '');
void normalizeQuery; void cleanDisplayName;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
