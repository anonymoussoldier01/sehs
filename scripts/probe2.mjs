const urls = ['/search?q=maths', '/mocks', '/mocks/maths-qr-60', '/writing', '/drills', '/study', '/api/search?q=analogy', '/api/writing', '/api/reading', '/api/guides', '/subjects', '/about', '/feed.xml'];
for (const u of urls) {
  try {
    const r = await fetch('http://localhost:8080' + u);
    const t = await r.text();
    console.log(r.status, u, 'len=' + t.length);
  } catch (e) { console.log('ERR', u, e.message); }
}
