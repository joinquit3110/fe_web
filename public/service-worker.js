// service-worker.js - Modern service worker for performance optimization and offline support

// Cache version identifier - increment when assets change to force update
const CACHE_VERSION = 'v1';
const CACHE_NAME = `inequality-web-cache-${CACHE_VERSION}`;

// Resources to pre-cache during installation
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
  '/asset/Hogwarts logo.png',
  '/asset/Gryffindor.png',
  '/asset/Hufflepuff.png',
  '/asset/Ravenclaw.png',
  '/asset/Slytherin.png'
];

// Install event - Cache critical assets for offline use
self.addEventListener('install', event => {
  // Use waitUntil to tell the browser that installation isn't complete
  // until the caching is done
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName.startsWith('inequality-web-cache-') && cacheName !== CACHE_NAME;
          }).map(cacheName => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        // Take control of all clients as soon as it activates
        return self.clients.claim();
      })
  );
});

// Helper function to determine if a request is for an API call
const isApiRequest = (url) => {
  return url.pathname.startsWith('/api/') || 
         url.origin.includes('be-web-6c4k.onrender.com');
};

// Helper function to determine if a request is for an HTML document
const isHtmlRequest = (request) => {
  return request.headers.get('Accept')?.includes('text/html');
};

// Helper function to determine if a request is for a static asset
const isStaticAsset = (url) => {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/);
};

// Fetch event - Network-first for API requests, Cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin && !url.origin.includes('be-web-6c4k.onrender.com')) {
    return;
  }

  // Different strategies based on request type
  if (isApiRequest(url)) {
    // Network-first strategy for API requests with timeout fallback
    event.respondWith(
      Promise.race([
        // Network request with timeout
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            // If network takes too long, reject to try cache
            reject(new Error('Network request timeout'));
          }, 3000); // 3 second timeout
          
          fetch(event.request)
            .then(response => {
              clearTimeout(timeoutId);
              // Cache successful API responses for offline use
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
              resolve(response);
            })
            .catch(error => {
              clearTimeout(timeoutId);
              reject(error);
            });
        }),
        // Fallback to cache after timeout or network failure
        new Promise((resolve) => {
          setTimeout(() => {
            caches.match(event.request)
              .then(cachedResponse => {
                if (cachedResponse) {
                  resolve(cachedResponse);
                } else {
                  // If not in cache and network failed, return custom offline API response
                  resolve(new Response(JSON.stringify({
                    error: 'You are currently offline. Please try again when you have an internet connection.'
                  }), {
                    headers: { 'Content-Type': 'application/json' }
                  }));
                }
              });
          }, 3000); // Same timeout as network request
        })
      ]).catch(() => {
        // Network failed and race was rejected
        return caches.match(event.request)
          .then(cachedResponse => {
            return cachedResponse || 
              new Response(JSON.stringify({
                error: 'You are currently offline. Please try again when you have an internet connection.'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
          });
      })
    );
  } else if (isStaticAsset(url)) {
    // Cache-first strategy for static assets
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // If in cache, return cached version
            return cachedResponse;
          }
          
          // If not in cache, fetch from network and cache
          return fetch(event.request)
            .then(response => {
              // Don't cache non-successful responses
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response as it can only be consumed once
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(() => {
              // If fetch fails for images, return a placeholder
              if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
                return caches.match('/asset/Hogwarts logo.png');
              }
              // For other static assets, try to return something useful
              return new Response('Resource not available offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  } else if (isHtmlRequest(event.request)) {
    // For HTML documents, try network first, then cache, then offline page
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the latest version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('/offline.html');
            });
        })
    );
  } else {
    // Default strategy: try network, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

// Background sync for offline submissions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-inequalities') {
    event.waitUntil(syncInequalities());
  } else if (event.tag === 'sync-points') {
    event.waitUntil(syncPoints());
  }
});

// Function to sync inequalities when back online
const syncInequalities = async () => {
  try {
    // Get all the pending inequalities from IndexedDB
    const db = await openDB();
    const pendingInequalities = await db.getAll('pending-inequalities');
    
    // Process each pending inequality
    const syncPromises = pendingInequalities.map(async (item) => {
      try {
        const response = await fetch('/api/inequalities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${item.token}`
          },
          body: JSON.stringify(item.data)
        });
        
        if (response.ok) {
          // Remove from pending if successful
          await db.delete('pending-inequalities', item.id);
          return { success: true, id: item.id };
        } else {
          return { success: false, id: item.id, error: 'Server rejected submission' };
        }
      } catch (error) {
        return { success: false, id: item.id, error: error.message };
      }
    });
    
    // Wait for all syncs to complete
    const results = await Promise.all(syncPromises);
    
    // Notify the client about the sync results
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        tag: 'sync-inequalities',
        results
      });
    });
    
  } catch (error) {
    console.error('Error syncing inequalities:', error);
  }
};

// Function to sync points when back online
const syncPoints = async () => {
  try {
    // Get all the pending point operations from IndexedDB
    const db = await openDB();
    const pendingPoints = await db.getAll('pending-points');
    
    // Process each pending point operation
    const syncPromises = pendingPoints.map(async (item) => {
      try {
        const response = await fetch('/api/magic-points', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${item.token}`
          },
          body: JSON.stringify(item.data)
        });
        
        if (response.ok) {
          // Remove from pending if successful
          await db.delete('pending-points', item.id);
          return { success: true, id: item.id };
        } else {
          return { success: false, id: item.id, error: 'Server rejected point update' };
        }
      } catch (error) {
        return { success: false, id: item.id, error: error.message };
      }
    });
    
    // Wait for all syncs to complete
    const results = await Promise.all(syncPromises);
    
    // Notify the client about the sync results
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        tag: 'sync-points',
        results
      });
    });
    
  } catch (error) {
    console.error('Error syncing points:', error);
  }
};

// Open IndexedDB for storing offline data
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inequality-web-offline', 1);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Create object stores for offline data
      if (!db.objectStoreNames.contains('pending-inequalities')) {
        db.createObjectStore('pending-inequalities', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('pending-points')) {
        db.createObjectStore('pending-points', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      reject(event.target.error);
    };
  });
};

// Handle push notifications
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const title = data.title || 'Hogwarts Notification';
    const options = {
      body: data.message || 'You have a new notification from Hogwarts!',
      icon: '/asset/Hogwarts logo.png',
      badge: '/asset/Hogwarts logo.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientList => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window/tab is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});
