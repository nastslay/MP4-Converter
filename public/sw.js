// Service Worker dla PWA — AnimConverter
const CACHE_VERSION = 'v2';  // <-- Zwiększaj ręcznie przy każdym deployu lub użyj timestamp
const CACHE_NAME = `animconverter-${CACHE_VERSION}`;

// Pliki do pre-cache (powłoka aplikacji)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: pre-cache i natychmiastowe przejęcie
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn('SW: Pre-cache partial failure:', err))
      .then(() => self.skipWaiting())
  );
});

// Activate: usuń stare caches i przejmij kontrolę
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first dla HTML/manifest, cache-first dla assetów
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;

  // Nie cache'uj zewnętrznych CDN ani API
  if (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Dla nawigacji (HTML) i manifest – zawsze pobieraj z sieci
  if (request.mode === 'navigate' || url.pathname === '/manifest.json' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Zapisz świeżą kopię do cache na przyszłość (opcjonalnie)
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline – wróć do cache (jeśli istnieje)
          return caches.match(request);
        })
    );
    return;
  }

  // Dla pozostałych zasobów (JS, CSS, obrazy) – cache-first, potem sieć
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request)
        .then(response => {
          // Cache'uj tylko udane odpowiedzi
          if (response && response.status === 200 && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Jeśli offline i brak cache – zwróć index.html (dla SPA)
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        })
      )
  );
});
