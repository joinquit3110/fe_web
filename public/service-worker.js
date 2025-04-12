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

// Enhanced background sync with better offline/online handling
async function syncMagicPoints() {
  try {
    console.log('[SW] Starting optimized background sync');
    
    // First, check if we need to sync pending operations
    const pendingOpsJson = localStorage.getItem('pendingOperations');
    const lastSyncTimestamp = localStorage.getItem('magicPointsTimestamp');
    
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
        
        // Use the sync endpoint directly
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
        
        // Notify the application that sync has completed
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_COMPLETED',
              magicPoints: result.magicPoints,
              timestamp: result.timestamp
            });
          });
        });
      } else {
        console.log('[SW] No operations to sync, checking for updates');
        await checkForServerUpdates();
      }
    } else {
      console.log('[SW] No pending operations, checking for updates');
      await checkForServerUpdates();
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

// New function to check for server-side updates when coming back online
async function checkForServerUpdates() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[SW] No auth token available, skipping server check');
      return Promise.resolve();
    }
    
    // Get current magic points from server
    const response = await fetch('/api/user/magic-points', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`[SW] Received server points: ${result.magicPoints}`);
    
    // Compare with local value
    const localPoints = parseInt(localStorage.getItem('magicPoints') || '100', 10);
    
    if (result.magicPoints !== localPoints) {
      console.log(`[SW] Server points (${result.magicPoints}) differ from local (${localPoints}), updating local`);
      localStorage.setItem('magicPoints', result.magicPoints.toString());
      localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
      
      // Notify the application about the updated points
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'POINTS_UPDATED',
            magicPoints: result.magicPoints
          });
        });
      });
    } else {
      console.log('[SW] Local and server points match, no update needed');
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Error checking for server updates:', error);
    return Promise.resolve(); // Don't fail sync on this error
  }
}
