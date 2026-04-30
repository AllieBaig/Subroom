const VERSION = 'subliminal-v16'; // Increment for update
const CACHE_NAME = `subliminal-player-${VERSION}`;

// Core shell assets for instant startup
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
];

// Essential fonts
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
];

const PRECACHE_ASSETS = [...STATIC_ASSETS, ...EXTERNAL_ASSETS];

// Install: Immediate activation and pre-caching
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(asset => 
          fetch(asset, { cache: 'reload' }).then(response => {
            if (response.ok) return cache.put(asset, response);
          }).catch(() => {})
        )
      );
    })
  );
});

// Activate: Purge old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key.startsWith('subliminal-player-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Logic: 
// 1. Navigation -> Network with rapid fallback to Cache (Shell)
// 2. Static Assets -> Cache-First
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET or cross-origin binary that Safari might choke on in SW
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'blob:') return;
  if (url.pathname.startsWith('/@vite') || url.pathname.includes('hot-update')) return;

  // NAVIGATION: Optimized for iOS 16
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return await cache.match('./index.html') || 
                 await cache.match('./') || 
                 await cache.match('index.html') ||
                 new Response('Offline - Initializing app shell...', { status: 200, headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  // ASSETS: Cache-First with Background Revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && networkResponse.status === 200) {
          const isAsset = url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2|json)$/);
          if (isAsset) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise || new Response('', { status: 404 });
    })
  );
});

