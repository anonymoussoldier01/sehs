// Retired: this service worker now unregisters itself and clears the legacy
// cache (sehs-v1/v2 used cache-first page strategies that would serve stale
// HTML over the React SPA). Kept as a file so existing registrations update.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});
