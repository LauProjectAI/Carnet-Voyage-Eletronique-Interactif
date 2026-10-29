const CACHE_NAME = 'carnet-girardot-v10';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './conducteur.html',
  './style.css',
  './app.js',
  './admin.js',
  './conducteur.js',
  './data.js',
  './cruise_fleet.js',
  './gemini_service.js',
  './voyages/index_voyages.js',
  './manifest.json',
  './icon-girardot.svg',
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
  const url = event.request.url;
  // Let map tiles and cross-origin images/CDNs fetch naturally without service worker interference
  if (url.includes('tile.openstreetmap.org') || url.includes('basemaps.cartocdn.com') || url.includes('openstreetmap.fr')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          if (event.request.method === 'GET' && url.startsWith('http')) {
            try {
              cache.put(event.request, fetchRes.clone());
            } catch(e) {}
          }
          return fetchRes;
        });
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
