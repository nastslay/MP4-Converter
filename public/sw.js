// Service Worker dla PWA — AnimConverter
const CACHE_NAME = 'animconverter-v1';

// Pliki do cache'owania przy instalacji (shell aplikacji)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('SW: Pre-cache partial failure (ok in dev):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first dla API/CDN, cache-first dla shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nie cachuj: CDN ffmpeg (za duże), API proxy
  if (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first dla shell assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (response && response.status === 200 && event.request.method === 'GET') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
