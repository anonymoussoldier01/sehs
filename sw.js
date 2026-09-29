// Offline shell: app pages + saved data endpoints. Hosted files stay online-only.
const CACHE = 'sehs-v1';
const SHELL = ['/', '/styles.css', '/theme.js', '/ux.js', '/suggest.js', '/profile.js', '/palette.js', '/lists.js', '/study.js', '/gate.js', '/open.js', '/record.js', '/manifest.json', '/icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // API: network-first, cache fallback for idempotent reads
  if (u.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || Response.json({ ok: false, error: 'offline' }, { status: 503 }))));
    return;
  }
  // pages + assets: cache-first, then network
  e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match('/'))));
});
