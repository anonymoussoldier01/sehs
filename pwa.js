// PWA registration (offline app shell; hosted files stay online-only).
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* offline unsupported */ });
  });
})();
