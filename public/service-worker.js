// Cache version
const CACHE_VERSION = '1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json'
];

const IMAGE_ASSETS = [
  '/assets/images/hogwarts-bg.jpg',
  '/assets/images/Gryffindor.png',
  '/assets/images/Hufflepuff.png',
  '/assets/images/Ravenclaw.png',
  '/assets/images/Slytherin.png',
  '/assets/images/IncreasePoint.png',
  '/assets/images/DecreasePoint.png',
  '/assets/images/Hogwarts logo.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(IMAGE_CACHE).then(cache => cache.addAll(IMAGE_ASSETS))
    ])
  );
});

// Fetch event with improved caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Image handling
  if (request.destination === 'image') {
      event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(fetchResponse => {
          return caches.open(IMAGE_CACHE).then(cache => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
          })
      );
      return;
    }
    
  // Static assets
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(response => response || fetch(request))
    );
      return;
    }
    
  // Dynamic content
  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request).then(fetchResponse => {
        return caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
        );
});
