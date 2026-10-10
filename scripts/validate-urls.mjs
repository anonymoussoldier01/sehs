// URL validation: rate-limited checker reporting ok, broken, restricted, or unchecked.
// Default is a dry run (reports everything as unchecked). Live checks need --live
// and are capped (default 50, --all for the full set, 1 request per ~500ms).
// Usage: node scripts/validate-urls.mjs [--live] [--all] [--out state/url-check.json]
// Reports real results only; never modifies records.
import fs from 'node:fs';

const args = new Set(process.argv.slice(2));
const live = args.has('--live');
const all = args.has('--all');
const outIdx = process.argv.indexOf('--out');
const out = outIdx > -1 ? process.argv[outIdx + 1] : 'state/url-check.json';

const links = JSON.parse(fs.readFileSync(new URL('../data/links.json', import.meta.url), 'utf8'));
const targets = all ? links : links.slice(0, 50);

const results = [];
if (!live) {
  for (const r of targets) results.push({ id: r.id, url: r.url, status: 'unchecked', note: 'dry run: pass --live to check' });
} else {
  let i = 0;
  for (const r of targets) {
    i++;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      // Drive file links: a lightweight range request avoids downloading bodies.
      const res = await fetch(r.url, { redirect: 'manual', signal: ctrl.signal, headers: { Range: 'bytes=0-0' } });
      clearTimeout(t);
      const s = res.status;
      let status = 'ok';
      if (s === 403 || s === 401) status = 'restricted';
      else if (s === 404 || s === 410) status = 'broken';
      else if (s >= 500) status = 'broken';
      else if (s >= 300 && s < 400) status = 'ok'; // Drive redirects to viewer for shared files
      results.push({ id: r.id, url: r.url, status, http: s });
      try { await res.arrayBuffer().catch(() => {}); } catch { /* noop */ }
    } catch (e) {
      results.push({ id: r.id, url: r.url, status: e?.name === 'AbortError' ? 'unchecked' : 'broken', note: String(e?.message || e).slice(0, 120) });
    }
    process.stdout.write(`\r${i}/${targets.length}`);
    await new Promise((r2) => setTimeout(r2, 500));
  }
  process.stdout.write('\n');
}

const counts = {};
for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
console.log(`validate-urls: checked=${results.length}/${links.length} ` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
if (live) {
  fs.mkdirSync('state', { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), counts, results }, null, 2));
  console.log(`report: ${out}`);
} else {
  console.log('dry run: no report written. Pass --live to check (rate-limited).');
}
