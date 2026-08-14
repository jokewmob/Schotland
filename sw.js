const CACHE = 'schotland-2026-v8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css?v=8',
  './assets/js/config.js?v=8',
  './assets/js/app.js?v=8',
  './assets/images/hero-highlands.webp',
  './assets/images/highland-landscape.webp',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mapbox/Google/fonts remain online services. Core trip data, layout and local imagery
  // are available offline after the first successful visit.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put('./index.html', copy));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return response;
    }))
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CHECK_OFFLINE') {
    caches.open(CACHE).then(async cache => {
      const checks = await Promise.all(APP_SHELL.map(item => cache.match(item).then(Boolean)));
      event.source?.postMessage({ type: 'OFFLINE_STATUS', ready: checks.every(Boolean) });
    });
  }
});
