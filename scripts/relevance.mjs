// Graded relevance fixture: proves ranking quality + blocks regressions.
// Run: node scripts/relevance.mjs   (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, search, suggest, moreLikeThis } from '../search.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'links.json'), 'utf8'));
const idx = buildIndex(links);
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra}`); };
const R = (q, opts) => search(idx, q, opts);
const titles = (r, n = 3) => r.results.slice(0, n).map(x => x.displayTitle);

// exact + order invariance + phrase dominance
let a = R('capricorn practice paper');
ok('phrase top is exact title', /capricorn practice paper/i.test(a.results[0]?.displayTitle || ''), ` top=${a.results[0]?.displayTitle}`);
ok('order invariance', R('practice paper capricorn').results[0]?.rec.id === a.results[0]?.rec.id);
ok('practice tests broad', R('practice tests').results.length >= 100);
ok('capricorn docx intent', R('capricorn docx').results[0]?.type === 'docx');
ok('papers-with-answers intent', R('papers with answers').results.slice(0, 5).every(x => (x.rec.tags || []).includes('answers')));
// normalisation / typos
ok('typo rescued', R('capricon').corrected === 'capricorn' && R('capricon').results.length > 0);
ok('practise', R('practise paper').results.length >= 10);
ok('math expansion', R('math').results.length >= 200);
ok('concat split', R('practicepaper').results.length === R('practice paper').results.length);
for (const v of ['practice-test', 'practice_test']) ok(`norm ${v}`, R(v).results.length === R('practice test').results.length);
ok('case-insensitive', R('CAPRICORN').results.length === R('capricorn').results.length);
// partial + nonsense
let p = R('VSSE maths answers');
ok('partial fallback', p.mode === 'partial' && p.results.length > 50);
ok('nonsense none', R('zzzznothinghere').mode === 'none' && R('zzzznothinghere').results.length === 0);
ok('double-typo correction', !!R('capricon practce').corrected);
// field recall
for (const [q, min] of [['acer', 90], ['vsse', 10], ['homework', 90], ['science', 150], ['numerical reasoning', 50], ['reading comprehension', 20], ['written expression', 40], ['jmss', 50], ['methods practice', 1], ['algebra', 1]]) {
  ok(`recall ${q}`, R(q).results.length >= min, ` (${R(q).results.length})`);
}
// known winners (top-1 / top-3)
ok('winner numerical', /numerical reasoning/i.test(titles(R('numerical reasoning'), 1)[0] || ''));
ok('winner reading', /reading comprehension/i.test(titles(R('reading comprehension'), 1)[0] || ''));
ok('winner written', /written expression/i.test(titles(R('written expression'), 1)[0] || ''));
ok('winner acer set', /acer/i.test(titles(R('acer'), 1)[0] || ''));
// smart: concept substitution, syntax, prefix, drop, MLT
let alg = R('algebra');
ok('concept algebra→maths', alg.results.length > 50 && alg.related.some(r => r.startsWith('algebra')), ` (${alg.results.length}, rel=${alg.related})`);
let pv = R('provider:acer');
ok('syntax provider', pv.results.length > 0 && pv.results.slice(0, 10).every(x => (x.rec.tags || []).includes('acer')));
let tp = R('type:pdf');
ok('syntax type', tp.results.length > 100 && tp.results.slice(0, 10).every(x => x.type === 'pdf'));
ok('prefix practic', R('practic').results.length > 50);
let dr = R('vsse maths answers unicornxyz');
ok('drop-or-partial survives junk', dr.results.length > 0, ` mode=${dr.mode}`);
let an = R('answers:no');
ok('answers:no gate', an.results.length > 0 && an.results.slice(0, 10).every(x => !(x.rec.tags || []).includes('answers')));
// suggestions + perf
ok('suggest provider', suggest(idx, 'cap').some(s => s.label === 'capricorn'));
ok('suggest typo-tolerant', suggest(idx, 'acc').some(s => s.label === 'acer'));
let mlt = moreLikeThis(idx, links[0].id, 6);
ok('mlt returns similar', mlt.length === 6 && mlt.every(x => x.score > 0));
const t0 = performance.now();
for (let i = 0; i < 200; i++) search(idx, ['vsse', 'maths answers', 'science homework'][i % 3]);
const ms = performance.now() - t0;
ok('perf 200 <1s', ms < 1000, ` (${ms.toFixed(0)}ms)`);
console.log(`\n${pass} passed, ${fail} failed (index ${idx.total} docs)`);
process.exit(fail ? 1 : 0);
