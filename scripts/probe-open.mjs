const base = 'http://localhost:8080';
// pick a real visible resource via search
let r = await fetch(base + '/api/search?q=maths&per=5');
let j = await r.json();
console.log('search:', r.status, 'total=' + j.total);
const id = j.results?.[0]?.id;
console.log('trying id:', id);
r = await fetch(base + '/api/access/' + id, { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
j = await r.json();
console.log('access:', r.status, JSON.stringify(j).slice(0, 120));
if (j.openUrl) {
  // follow grant WITHOUT auto-following to Drive: inspect redirect target
  const r2 = await fetch(base + j.openUrl, { redirect: 'manual' });
  console.log('grant:', r2.status, 'location=' + (r2.headers.get('location') || '').slice(0, 110));
  const dest = r2.headers.get('location');
  if (dest) {
    // is the Drive file publicly reachable?
    const r3 = await fetch(dest, { redirect: 'follow' });
    const t = await r3.text();
    console.log('drive:', r3.status, 'len=' + t.length);
    console.log('needs-access-page:', /request access|Request access|permission/i.test(t));
    console.log('is-folder-url:', dest.includes('/drive/folders/'));
  }
  // reuse must fail (single-use)
  const r4 = await fetch(base + j.openUrl, { redirect: 'manual' });
  console.log('reuse (want 404):', r4.status);
}
