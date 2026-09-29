// Orchestrator: expand -> fetch -> enrich -> build
// Flags: --initial --update --refresh --retry-failed --limit=N --skip-expand --skip-fetch --skip-enrich
import { spawn } from 'node:child_process';

function args() {
  return Object.fromEntries(process.argv.slice(2).map(s => {
    const m = s.match(/^--([^=]+)(=(.*))?$/);
    return m ? [m[1], m[3] ?? true] : [s, true];
  }));
}
function run(cmd, a) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${cmd} ${a.join(' ')} ===`);
    const p = spawn(process.execPath, [cmd, ...a], { stdio: 'inherit' });
    p.on('close', c => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}
const a = args();
const passthrough = [];
if (a.limit) passthrough.push(`--limit=${a.limit}`);
if (a.refresh || a.initial === false) { /* handled below */ }
const enrichArgs = [...passthrough];
if (a.refresh) enrichArgs.push('--refresh');
if (a['retry-failed']) enrichArgs.push('--retry-failed');
// --update (default): no extra flags, uses checkpoint to skip existing
// --initial: force refresh all
if (a.initial) enrichArgs.push('--refresh');

try {
  if (!a['skip-expand']) await run('scripts/expand-drive.mjs', []);
  if (!a['skip-fetch']) await run('scripts/fetch-meta.mjs', a.refresh ? ['--refresh'] : []);
  if (!a['skip-enrich']) await run('scripts/enrich-gemini.mjs', enrichArgs);
  await run('scripts/build-data.mjs', []);
  await run('scripts/validate.mjs', []);
  console.log('\nINGEST COMPLETE -> data/links.json + data/categories.json');
} catch (e) {
  console.error('\ningest failed:', e.message);
  process.exit(1);
}
