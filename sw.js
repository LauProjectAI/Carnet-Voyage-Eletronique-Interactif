const CACHE_NAME = 'carnet-girardot-v36';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './conducteur.html',
  './style.css',
  './storage_service.js',
  './auth_service.js',
  './admin_access.js',
  './app.js',
  './carnet_export.js',
  './admin.js',
  './conducteur.js',
  './data.js',
  './cruise_fleet.js',
  './gemini_service.js',
  './voyages/index_voyages.js',
  './voyages/access_registry.json',
  './manifest.json',
  './icon-girardot.svg',
  './logo-groupe-girardot.svg',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600;700;800&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Cache addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (!url.startsWith('http')) return;

  // Let GitHub API, map tiles and cross-origin services fetch naturally without service worker interference
  if (url.includes('api.github.com') ||
      url.includes('tile.openstreetmap.org') ||
      url.includes('basemaps.cartocdn.com') ||
      url.includes('openstreetmap.fr')) {
    return;
  }

  // Same-origin application files: Network-First with cache fallback so updates appear immediately when online
  const isSameOrigin = new URL(url).origin === self.location.origin;
  if (isSameOrigin) {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-cache' }).then((fetchRes) => {
        if (fetchRes && fetchRes.status === 200) {
          const resClone = fetchRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(event.request, resClone);
            } catch(e) {}
          });
        }
        return fetchRes;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document' || event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }

  // External CDN assets (fonts, Leaflet, Font Awesome): Cache-First
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          if (fetchRes && fetchRes.status === 200) {
            try {
              cache.put(event.request, fetchRes.clone());
            } catch(e) {}
          }
          return fetchRes;
        });
      });
    })
  );
});
