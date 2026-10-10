import { examGuidePage, mocksPage, writingPage, drillsPage } from '../server/pages.mjs';
for (const [name, fn] of [['exam-guide', examGuidePage], ['mocks', mocksPage], ['writing', writingPage], ['drills', drillsPage]]) {
  const html = fn({ session: null });
  const ok = html.includes('id="main"') && html.length > 2000;
  console.log((ok ? 'PASS' : 'FAIL') + ' page ' + name + ' (' + html.length + ' chars)');
  if (!ok) process.exitCode = 1;
}
import fs from 'node:fs';
for (const f of ['data/native/vocab.json','data/native/verbal.json','data/native/quant.json','data/native/maths.json','data/native/grammar.json','data/native/reading.json','data/native/writing.json','data/native/mocks.json']) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const n = (j.cards || j.prompts || j.passages || j.mocks || []).length;
  console.log((n > 0 ? 'PASS' : 'FAIL') + ' native ' + f + ' (' + n + ')');
  if (!n) process.exitCode = 1;
}
{
  const j = JSON.parse(fs.readFileSync('data/native/guides.json', 'utf8'));
  const ok = j.exam && j.schools && j.schools.length === 4;
  console.log((ok ? 'PASS' : 'FAIL') + ' native data/native/guides.json (exam+schools)');
  if (!ok) process.exitCode = 1;
}
for (const f of ['mocks.js','writing.js','drills.js']) {
  const ok = fs.existsSync(f) && fs.statSync(f).size > 1000;
  console.log((ok ? 'PASS' : 'FAIL') + ' client ' + f);
  if (!ok) process.exitCode = 1;
}
