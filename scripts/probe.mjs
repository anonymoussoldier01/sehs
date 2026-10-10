const urls = ['/api/health', '/api/stats', '/', '/api/mocks', '/api/native-stats', '/exam-guide', '/api/decks'];
for (const u of urls) {
  try {
    const r = await fetch('http://localhost:8080' + u);
    const t = await r.text();
    console.log(r.status, u, 'len=' + t.length, JSON.stringify(t.slice(0, 100)));
  } catch (e) { console.log('ERR', u, e.message); }
}
