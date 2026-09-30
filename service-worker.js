const CACHE_PREFIX = 'october-2026-group-challenge-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = [
  './',
  './index.html',
  './group-challenge.css',
  './group-challenge.js',
  './firebase-config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const shellUrls = APP_SHELL.map((path) => new URL(path, self.registration.scope).href);
  // Only cache this app shell, never Firebase responses or sibling apps.
  if (!shellUrls.includes(`${url.origin}${url.pathname}`)) return;

  event.respondWith(
    // Revalidate page loads so reopening does not reuse stale HTTP-cached HTML.
    fetch(request, request.mode === 'navigate' ? { cache: 'no-cache' } : {}).then((response) => {
      const copy = response.clone();
      if (response.ok) {
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match(new URL('./index.html', self.registration.scope).href);
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
