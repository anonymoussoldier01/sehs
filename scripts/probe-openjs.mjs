const base = 'http://localhost:8080';
const r = await fetch(base + '/');
const t = await r.text();
console.log('landing:', r.status, 'loads-open.js:', t.includes('/open.js'), 'loads-request.js:', t.includes('/request.js'));
const r2 = await fetch(base + '/r/2829e322ac43aef7f53dcb3aedadc9d4');
const t2 = await r2.text();
console.log('resource:', r2.status, 'loads-open.js:', t2.includes('/open.js'), 'has-data-open:', t2.includes('data-open'));
