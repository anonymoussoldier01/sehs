const r = await fetch('http://localhost:8080/open.js');
const t = await r.text();
console.log('open.js status:', r.status, 'has-sync-open:', t.includes("window.open('about:blank'"));
const r2 = await fetch('http://localhost:8080/api/terms');
const j = await r2.json();
console.log('terms:', r2.status, 'v' + j.version);
