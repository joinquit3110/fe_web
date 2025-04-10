// Cache name with version
const CACHE_NAME = 'inequality-web-v1';

// Files to cache - add your critical assets here
const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  // Add other essential assets here
];

// Install service worker and cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Cache and update strategy
self.addEventListener('fetch', event => {
  // Skip non-GET requests and requests to other origins
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Special handling for API requests
  if (event.request.url.includes('/api/')) {
    // For API requests, try network first, then fall back to cache if available
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response to use it and cache it
          const responseToCache = response.clone();
          
          // Only cache successful responses
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        })
        .catch(() => {
          // If network fails, try to get from cache
          return caches.match(event.request);
        })
    );
  } else {
    // For other requests (static assets), use cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Cache hit - return response
          if (response) {
            return response;
          }
          
          // Clone the request - request is a stream and can only be consumed once
          const fetchRequest = event.request.clone();
          
          return fetch(fetchRequest).then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            
            return response;
          });
        })
    );
  }
});

// Clean up old caches when a new service worker is activated
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete outdated caches
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle background sync for offline operations
self.addEventListener('sync', event => {
  if (event.tag === 'sync-magic-points') {
    event.waitUntil(syncMagicPoints());
  }
});

// Function to sync magic points in the background
async function syncMagicPoints() {
  try {
    // Get pending operations from localStorage
    const pendingOpsJson = localStorage.getItem('pendingOperations');
    
    if (pendingOpsJson) {
      const pendingOps = JSON.parse(pendingOpsJson);
      
      if (pendingOps.length > 0) {
        console.log(`[SW] Background sync: Processing ${pendingOps.length} pending operations`);
        
        // Get auth token
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('[SW] No auth token available, aborting sync');
          return Promise.resolve(); // Don't treat as failure
        }
        
        // Use the sync endpoint directly instead of calculating locally
        const response = await fetch('/api/user/magic-points/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            operations: pendingOps
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`[SW] Sync successful, new point value: ${result.magicPoints}`);
        
        // Update local storage with new value
        localStorage.setItem('magicPoints', result.magicPoints.toString());
        localStorage.setItem('magicPointsTimestamp', result.timestamp || new Date().toISOString());
        
        // Clear pending operations
        localStorage.removeItem('pendingOperations');
        console.log('[SW] Cleared pending operations after successful sync');
      } else {
        console.log('[SW] No operations to sync');
      }
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    // Don't automatically retry for certain errors
    if (error.message && (
      error.message.includes('401') || 
      error.message.includes('403') || 
      error.message.includes('Authentication')
    )) {
      console.log('[SW] Auth error, not retrying');
      return Promise.resolve();
    }
    
    // For other errors, reject to allow browser to retry
    return Promise.reject(error);
  }
}
