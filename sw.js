// Network-first Service Worker for PWA installability (always fetches latest version when online)
const CACHE_NAME = 'budget-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const fetchOptions = event.request.mode === 'navigate' ? { cache: 'no-cache' } : {};
  event.respondWith(
    fetch(event.request, fetchOptions).catch(() => caches.match(event.request))
  );
});
