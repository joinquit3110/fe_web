// Cache name with version - add timestamp to enforce updates
const CACHE_NAME = 'inequality-web-v5-' + (new Date().toISOString().split('T')[0].replace(/-/g, ''));
const STATIC_CACHE = CACHE_NAME + '-static';
const DYNAMIC_CACHE = CACHE_NAME + '-dynamic';
const API_CACHE = CACHE_NAME + '-api';
const USER_CACHE = CACHE_NAME + '-user';
const ACTIVITY_CACHE = CACHE_NAME + '-activities';

// Connection quality tracking
let CONNECTION_QUALITY = 'good'; // 'good', 'slow', 'poor', 'none'
let LAST_CONNECTION_CHECK = Date.now();
let ADAPTIVE_TIMEOUT = 5000; // Starts at 5 seconds, will adapt based on connection quality
let OFFLINE_STRATEGY = 'retry'; // 'retry', 'fallback', 'persistent'

// Files to cache - add all critical assets here
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  // Add images and other important assets
  '/asset/Hogwarts logo.png',
  '/asset/Gryffindor.png',
  '/asset/Hufflepuff.png',
  '/asset/Ravenclaw.png',
  '/asset/Slytherin.png',
  '/asset/IncreasePoint.png',
  '/asset/DecreasePoint.png',
  // Data files
  '/localstorage-backup.js',
  // Optimization for critical routes
  '/login',
  '/profile',
  '/activities',
  // Add fonts and icons for offline experience
  '/static/fonts/HarryPotter.woff',
  '/static/fonts/HarryPotter.woff2',
  // Add any missing CSS files
  '/static/css/HarryPotter.css',
  '/static/css/LoginHogwarts.css',
  // Add critical JavaScript files
  '/static/js/offline-sync.js',
  '/static/js/indexed-db-manager.js',
  // Add essential route fallbacks
  '/activities/offline',
  '/profile/offline'
];

// API endpoints to cache for offline use - expanded with more context-aware defaults
const API_ENDPOINTS = [
  {
    url: '/api/user/profile',
    fallback: { 
      offline: true, 
      message: 'Offline profile data',
      profile: {
        id: 'offline-user',
        name: 'Offline User',
        house: localStorage.getItem('userHouse') || 'unknown'
      }
    }
  },
  {
    url: '/api/user/magic-points',
    fallback: { 
      offline: true, 
      message: 'Offline magic points data',
      magicPoints: parseInt(localStorage.getItem('magicPoints') || '100', 10),
      pendingSync: true
    }
  },
  {
    url: '/api/user/activities',
    fallback: { 
      offline: true, 
      message: 'Offline activities data',
      activities: [],
      canContinueOffline: true
    }
  },
  {
    url: '/api/houses/scores',
    fallback: { 
      offline: true, 
      message: 'Offline house scores data',
      scores: [
        { house: 'Gryffindor', score: 0, offlineEstimate: true },
        { house: 'Hufflepuff', score: 0, offlineEstimate: true },
        { house: 'Ravenclaw', score: 0, offlineEstimate: true },
        { house: 'Slytherin', score: 0, offlineEstimate: true }
      ]
    }
  },
  {
    url: '/api/exercises/list',
    fallback: { 
      offline: true, 
      message: 'Offline exercises list',
      exercises: []
    }
  }
];

// Install service worker with improved precaching and IndexedDB initialization
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v5');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  // Initialize IndexedDB for offline data
  const initializeOfflineStorage = async () => {
    try {
      // Set up IndexedDB if supported
      if ('indexedDB' in self) {
        const db = await openDatabase();
        console.log('[SW] IndexedDB initialized successfully');
      }
    } catch (error) {
      console.error('[SW] Error initializing IndexedDB:', error);
    }
  };
  
  event.waitUntil(
    Promise.all([
      // Precache static assets
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('[SW] Precaching App Shell');
          return cache.addAll(urlsToCache);
        }),
      
      // Initialize IndexedDB
      initializeOfflineStorage(),
      
      // Cache API endpoints with smarter fallbacks
      caches.open(API_CACHE).then(cache => {
        console.log('[SW] Precaching API fallbacks');
        return Promise.all(API_ENDPOINTS.map(endpoint => {
          const fallbackResponse = new Response(
            JSON.stringify(endpoint.fallback),
            { headers: { 'Content-Type': 'application/json' } }
          );
          return cache.put(new Request(endpoint.url), fallbackResponse);
        }));
      })
    ])
  );
});

// Open IndexedDB database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inequality-web-offline', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      
      // Store for pending API operations
      if (!db.objectStoreNames.contains('pendingOperations')) {
        const store = db.createObjectStore('pendingOperations', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      
      // Store for cached user data
      if (!db.objectStoreNames.contains('userData')) {
        const store = db.createObjectStore('userData', { keyPath: 'id' });
        store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
      
      // Store for activity progress
      if (!db.objectStoreNames.contains('activityProgress')) {
        const store = db.createObjectStore('activityProgress', { keyPath: 'id' });
        store.createIndex('activityId', 'activityId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Get auth token (try to access from IndexedDB or via client messaging)
async function getAuthToken() {
  try {
    // Check first in IndexedDB
    const db = await openDatabase();
    const transaction = db.transaction(['userData'], 'readonly');
    const store = transaction.objectStore('userData');
    const request = store.get('authToken');
    
    return new Promise(async (resolve) => {
      request.onsuccess = async function() {
        if (request.result && request.result.token) {
          // Verify token is not too old (30 min max)
          const lastUpdated = new Date(request.result.lastUpdated || 0);
          const now = new Date();
          const tokenAge = now - lastUpdated; // milliseconds
          
          if (tokenAge < 30 * 60 * 1000) { // Less than 30 minutes old
            console.log('[SW] Using auth token from IndexedDB');
            resolve(request.result.token);
            return;
          } else {
            console.log('[SW] Token too old, requesting fresh one');
          }
        }
        
        // If not in IndexedDB or token too old, check for message from client
        console.log('[SW] No valid token in IndexedDB, querying clients');
        const clients = await self.clients.matchAll();
        
        if (clients.length > 0) {
          // Ask first client for token with timeout for response
          let responseReceived = false;
          
          // Set up promise with timeout
          const clientResponse = new Promise((clientResolve) => {
            const messageChannel = new MessageChannel();
            
            // Set up listener for response
            messageChannel.port1.onmessage = (event) => {
              responseReceived = true;
              if (event.data && event.data.token) {
                // Store and use fresh token
                storeAuthToken(event.data.token);
                clientResolve(event.data.token);
              } else {
                clientResolve(null);
              }
            };
            
            // Send request to client (all clients to ensure one responds)
            clients.forEach(client => {
              try {
                client.postMessage(
                  { action: 'getAuthToken' },
                  [messageChannel.port2]
                );
              } catch (e) {
                console.error('[SW] Error sending token request to client:', e);
              }
            });
          });
          
          // Add a timeout in case client doesn't respond
          const timeoutPromise = new Promise(timeoutResolve => {
            setTimeout(() => {
              if (!responseReceived) {
                console.log('[SW] Client token request timed out');
                timeoutResolve(null);
              }
            }, 1000);
          });
          
          // Wait for client response or timeout
          const token = await Promise.race([clientResponse, timeoutPromise]);
          resolve(token);
        } else {
          console.log('[SW] No clients available to get token');
          resolve(null);
        }
      };
      
      request.onerror = function(event) {
        console.error('[SW] Error getting auth token from IndexedDB:', event.target.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('[SW] Error in getAuthToken:', error);
    return null;
  }
}

// Helper function to store auth token in IndexedDB
async function storeAuthToken(token) {
  if (!token) return;
  
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['userData'], 'readwrite');
    const store = transaction.objectStore('userData');
    
    store.put({
      id: 'authToken',
      token: token,
      lastUpdated: new Date().toISOString()
    });
    
    console.log('[SW] Stored auth token in IndexedDB');
  } catch (error) {
    console.error('[SW] Error storing auth token:', error);
  }
}

// Enhanced fetch event with more sophisticated caching and network strategies
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests unless we're handling offline submission
  if (event.request.method !== 'GET') {
    // Special handling for POST requests that need to work offline
    if (event.request.method === 'POST' && 
        (event.request.url.includes('/api/user/magic-points') || 
         event.request.url.includes('/api/activities/submit'))) {
      
      event.respondWith(
        fetch(event.request.clone())
          .then(response => {
            return response;
          })
          .catch(error => {
            // Store failed POST requests in IndexedDB for later sync
            return event.request.clone().text()
              .then(body => {
                return storeOfflineRequest(event.request.url, 'POST', body)
                  .then(() => {
                    // Return a synthetic successful response
                    return new Response(JSON.stringify({
                      success: true,
                      offlineQueued: true,
                      message: 'Your request has been queued for processing when you\'re back online.'
                    }), {
                      headers: { 'Content-Type': 'application/json' },
                      status: 200
                    });
                  });
              });
          })
      );
      return;
    }
    
    return;
  }
  
  // Check connection quality periodically and adjust timeout
  if (Date.now() - LAST_CONNECTION_CHECK > 60000) { // Check every minute
    checkConnectionQuality();
  }

  // Handle API requests
  if (event.request.url.includes('/api/')) {
    // Use adaptive timeout based on connection quality
    const timeout = getAdaptiveTimeout();
    
    // API request handling with better timeout and fallback strategy
    event.respondWith(
      Promise.race([
        networkFirst(event.request),
        // Add adaptive timeout to fallback to cache
        new Promise(resolve => {
          setTimeout(() => {
            caches.match(event.request)
              .then(cachedResponse => {
                if (cachedResponse) {
                  console.log(`[SW] Using cached API response after ${timeout}ms timeout`);
                  resolve(cachedResponse);
                }
              });
          }, timeout);
        })
      ]).catch(error => {
        console.log('[SW] Network and cache both failed:', error);
        
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              console.log('[SW] Fallback to cached API response');
              return cachedResponse;
            }
            
            // Look for matching API fallback by pattern
            const endpointPath = new URL(event.request.url).pathname;
            const matchingEndpoint = API_ENDPOINTS.find(endpoint => 
              endpointPath.includes(endpoint.url.split('?')[0]));
            
            if (matchingEndpoint) {
              console.log('[SW] Using synthetic API response for:', endpointPath);
              return new Response(JSON.stringify(matchingEndpoint.fallback), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // If no cached response, return empty JSON with offline flag for API
            if (event.request.headers.get('accept')?.includes('application/json')) {
              return new Response(JSON.stringify({
                error: 'You are offline',
                offline: true,
                timestamp: new Date().toISOString()
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            // Return offline page for HTML requests
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/offline.html');
            }
            
            // Return error for other request types
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
      })
    );
  } 
  // Special handling for activity resources - cache first for performance
  else if (event.request.url.includes('/activities/') || 
           event.request.url.includes('/static/js/activities/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // Always return the cached version first for performance
            // But fetch an updated version in the background
            const fetchPromise = fetch(event.request.clone())
              .then(networkResponse => {
                // Update the cache if successful
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(ACTIVITY_CACHE)
                    .then(cache => cache.put(event.request, networkResponse.clone()));
                }
                return networkResponse;
              })
              .catch(error => {
                console.log('[SW] Background fetch failed, using cache', error);
              });
            
            return response;
          }
          
          // If not cached, try network then cache
          return fetch(event.request)
            .then(networkResponse => {
              if (!networkResponse || networkResponse.status !== 200) {
                return networkResponse;
              }
              
              const responseToCache = networkResponse.clone();
              caches.open(ACTIVITY_CACHE)
                .then(cache => cache.put(event.request, responseToCache));
              
              return networkResponse;
            })
            .catch(error => {
              // For HTML navigation, serve the offline page
              if (event.request.mode === 'navigate') {
                return caches.match('/offline.html');
              }
              
              // For activity resources, try a more generic match
              if (event.request.url.includes('/activities/')) {
                return caches.match('/activities/offline');
              }
              
              throw error;
            });
        })
    );
  }
  // Handle static assets with cache-first strategy
  else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // For most static assets, just return the cache
            return response;
          }
          
          return fetch(event.request)
            .then(networkResponse => {
              if (!networkResponse || networkResponse.status !== 200) {
                return networkResponse;
              }
              
              const responseToCache = networkResponse.clone();
              
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request, responseToCache);
              });
              
              return networkResponse;
            })
            .catch(error => {
              // Improved handling for navigation requests
              if (event.request.mode === 'navigate') {
                return caches.match('/offline.html');
              }
              
              // For image requests, try to return a placeholder
              if (event.request.destination === 'image') {
                return caches.match('/asset/placeholder.png')
                  .then(placeholderResponse => {
                    return placeholderResponse || new Response('Image not available offline', {
                      status: 503,
                      statusText: 'Service Unavailable'
                    });
                  });
              }
              
              throw error;
            });
        })
    );
  }
});

// Store offline request for later submission
async function storeOfflineRequest(url, method, body) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pendingOperations'], 'readwrite');
      const store = transaction.objectStore('pendingOperations');
      
      const request = store.add({
        url,
        method,
        body,
        timestamp: new Date().toISOString()
      });
      
      request.onsuccess = function() {
        console.log('[SW] Stored offline request for later processing');
        resolve();
      };
      
      request.onerror = function(event) {
        console.error('[SW] Error storing offline request:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('[SW] Error opening database:', error);
    throw error;
  }
}

// Helper function for network-first strategy with caching and improved error handling
async function networkFirst(request) {
  try {
    const response = await fetch(request.clone());
    
    if (response.ok) {
      const responseToCache = response.clone();
      
      caches.open(API_CACHE).then(cache => {
        // Add timestamp header
        const headers = new Headers(responseToCache.headers);
        headers.append('sw-fetched-on', new Date().getTime().toString());
        
        // Create response with updated headers
        const responseToStore = new Response(
          responseToCache.body,
          {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: headers
          }
        );
        
        cache.put(request, responseToStore);
        
        // If it's user data, also store in IndexedDB for better offline access
        if (request.url.includes('/api/user/profile') || 
            request.url.includes('/api/user/magic-points')) {
          
          responseToCache.json().then(data => {
            storeUserData(request.url, data);
          });
        }
      });
      
      // Update connection quality based on successful response
      updateConnectionQuality(true);
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network request failed, falling back to cache', request.url);
    
    // Update connection quality based on failed response
    updateConnectionQuality(false);
    
    // Try IndexedDB first for user data
    if (request.url.includes('/api/user/') && 'indexedDB' in self) {
      try {
        const userData = await getUserData(request.url);
        if (userData) {
          return new Response(JSON.stringify(userData), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (dbError) {
        console.error('[SW] Error retrieving from IndexedDB:', dbError);
      }
    }
    
    throw error;
  }
}

// Store user data in IndexedDB for offline access
async function storeUserData(url, data) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['userData'], 'readwrite');
    const store = transaction.objectStore('userData');
    
    // Use the URL path as the ID
    const id = new URL(url).pathname;
    
    const request = store.put({
      id,
      data,
      lastUpdated: new Date().toISOString()
    });
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function() {
        resolve();
      };
      
      request.onerror = function(event) {
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('[SW] Error storing user data:', error);
    throw error;
  }
}

// Get user data from IndexedDB
async function getUserData(url) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['userData'], 'readonly');
    const store = transaction.objectStore('userData');
    
    // Use the URL path as the ID
    const id = new URL(url).pathname;
    
    const request = store.get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function() {
        if (request.result) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = function(event) {
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('[SW] Error getting user data:', error);
    throw error;
  }
}

// Clean up old caches when a new service worker is activated
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v5');
  
  // Claim control immediately 
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete any cache that doesn't match our current cache name pattern
          if (cacheName.startsWith('inequality-web-') && !cacheName.startsWith(CACHE_NAME)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }).filter(Boolean)
      );
    })
  );
});

// Enhanced background sync with better retry mechanism and IndexedDB support
self.addEventListener('sync', event => {
  if (event.tag === 'sync-magic-points') {
    event.waitUntil(syncMagicPoints());
  } else if (event.tag === 'sync-user-data') {
    event.waitUntil(syncUserData());
  } else if (event.tag === 'sync-all-data') {
    event.waitUntil(syncAllData());
  } else if (event.tag === 'sync-pending-operations') {
    event.waitUntil(syncPendingOperations());
  }
});

// Background sync with retry and backoff - enhanced with IndexedDB support
async function syncPendingOperations() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['pendingOperations'], 'readonly');
    const store = transaction.objectStore('pendingOperations');
    const index = store.index('timestamp');
    const pendingOps = await new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
    
    if (pendingOps.length === 0) {
      console.log('[SW] No pending operations to sync');
      return;
    }
    
    console.log(`[SW] Found ${pendingOps.length} pending operations to sync`);
    
    // Add retry with exponential backoff
    const MAX_RETRIES = 5;
    let retryCount = 0;
    let retryDelay = 1000; // Start with 1 second
    let successfulOps = [];

    while (retryCount < MAX_RETRIES) {
      try {
        // Group operations by URL to batch them
        const operationsByUrl = pendingOps.reduce((acc, op) => {
          if (!successfulOps.includes(op.id)) {
            if (!acc[op.url]) acc[op.url] = [];
            acc[op.url].push(op);
          }
          return acc;
        }, {});
        
        const results = await Promise.all(
          Object.entries(operationsByUrl).map(async ([url, operations]) => {
            try {
              // Get token from IndexedDB or client
              const token = await getAuthToken();
              if (!token) {
                throw new Error('No authentication token available');
              }
              
              // Process operations by URL
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  operations: operations.map(op => JSON.parse(op.body))
                })
              });
              
              if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
              }
              
              // Mark operations as successful
              operations.forEach(op => successfulOps.push(op.id));
              
              return {
                url,
                success: true,
                operations: operations.length
              };
            } catch (error) {
              console.error(`[SW] Error processing operations for ${url}:`, error);
              return {
                url,
                success: false,
                error: error.message
              };
            }
          })
        );
        
        // If we've processed all operations, we're done
        if (successfulOps.length === pendingOps.length) {
          await clearSuccessfulOperations(successfulOps);
          notifyClients('sync_complete', {
            success: true,
            timestamp: new Date().toISOString(),
            processed: successfulOps.length
          });
          return;
        }
        
        // If we get here, some operations failed, retry
        retryCount++;
        
        // If there are auth errors in the results, don't retry
        const hasAuthError = results.some(r => 
          !r.success && (r.error.includes('401') || r.error.includes('403') || 
                         r.error.includes('Authentication')));
        
        if (hasAuthError) {
          console.log('[SW] Auth error detected, not retrying');
          notifyClients('sync_failed', {
            error: 'Authentication failed',
            timestamp: new Date().toISOString()
          });
          // Just clear successfully processed operations and stop
          await clearSuccessfulOperations(successfulOps);
          return;
        }
        
        // If we've reached max retries, give up on remaining operations
        if (retryCount >= MAX_RETRIES) {
          console.log('[SW] Max retries reached, giving up on remaining operations');
          await clearSuccessfulOperations(successfulOps);
          notifyClients('sync_partial', {
            success: true,
            processed: successfulOps.length,
            remaining: pendingOps.length - successfulOps.length,
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        // Exponential backoff
        retryDelay *= 2;
        console.log(`[SW] Retry ${retryCount}/${MAX_RETRIES} after ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } catch (error) {
        console.error('[SW] Error during sync retry:', error);
        retryCount++;
        if (retryCount >= MAX_RETRIES) break;
        retryDelay *= 2;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // If we get here with valid successfulOps, clear them
    if (successfulOps.length > 0) {
      await clearSuccessfulOperations(successfulOps);
    }
    
    notifyClients('sync_failed', {
      error: 'Max retries reached',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SW] Error syncing pending operations:', error);
    notifyClients('sync_failed', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Clear successful operations from IndexedDB
async function clearSuccessfulOperations(successfulOpIds) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['pendingOperations'], 'readwrite');
    const store = transaction.objectStore('pendingOperations');
    
    // Delete each successful operation
    successfulOpIds.forEach(id => {
      store.delete(id);
    });
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`[SW] Cleared ${successfulOpIds.length} completed operations`);
        resolve();
      };
      transaction.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('[SW] Error clearing successful operations:', error);
    throw error;
  }
}

// Notify all clients
async function notifyClients(action, data) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      action,
      ...data
    });
  });
}

// Function to sync magic points - now uses IndexedDB
async function syncMagicPoints() {
  try {
    // Use pendingOperations for syncing
    return syncPendingOperations();
  } catch (error) {
    console.error('[SW] Error in syncMagicPoints:', error);
    throw error;
  }
}

// Function to sync user data
async function syncUserData() {
  try {
    // Trigger the appropriate sync functions
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      clients[0].postMessage({
        action: 'sync_user_data'
      });
    }
    return true;
  } catch (error) {
    console.error('[SW] Error syncing user data:', error);
    throw error;
  }
}

// Function to sync all data types
async function syncAllData() {
  try {
    // Run all sync operations in parallel
    await Promise.all([
      syncPendingOperations(),
      syncUserData()
    ]);
    
    // Notify clients
    notifyClients('sync_all_complete', {
      success: true,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('[SW] Error syncing all data:', error);
    notifyClients('sync_all_failed', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Handle messages from client with improved communication
self.addEventListener('message', (event) => {
  if (!event.data || !event.data.action) return;
  
  switch (event.data.action) {
    case 'skipWaiting':
      self.skipWaiting();
      break;
      
    case 'primeCache':
      if (event.data.urls && Array.isArray(event.data.urls)) {
        event.waitUntil(
          caches.open(DYNAMIC_CACHE).then((cache) => {
            return Promise.all(
              event.data.urls.map(url => {
                return fetch(url)
                  .then(response => {
                    if (response.ok) {
                      return cache.put(url, response);
                    }
                  })
                  .catch(err => console.log('[SW] Prime cache error:', err));
              })
            );
          })
        );
      }
      break;
      
    case 'forceSync':
      event.waitUntil(syncAllData());
      break;
      
    case 'updateConnectionQuality':
      CONNECTION_QUALITY = event.data.quality;
      LAST_CONNECTION_CHECK = Date.now();
      console.log(`[SW] Connection quality updated to ${CONNECTION_QUALITY}`);
      break;
      
    case 'pending_operations_response':
      if (event.data.operations) {
        console.log('[SW] Received pending operations:', event.data.operations.length);
        // Store in IndexedDB for future use
        event.data.operations.forEach(op => {
          storeOfflineRequest(op.url || '/api/user/magic-points', op.type || 'POST', JSON.stringify(op));
        });
      }
      break;
      
    case 'store_auth_token':
      if (event.data.token) {
        // Store token in IndexedDB
        openDatabase().then(db => {
          const transaction = db.transaction(['userData'], 'readwrite');
          const store = transaction.objectStore('userData');
          store.put({
            id: 'authToken',
            token: event.data.token,
            lastUpdated: new Date().toISOString()
          });
        }).catch(error => {
          console.error('[SW] Error storing auth token:', error);
        });
      }
      break;
      
    case 'set_offline_strategy':
      OFFLINE_STRATEGY = event.data.strategy;
      console.log(`[SW] Offline strategy set to ${OFFLINE_STRATEGY}`);
      break;
      
    case 'auth_token_response':
      // No direct handling needed - this is for the promise in getAuthToken
      break;
  }
});

// New function to periodically clean up cache to prevent overflow
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupCaches());
  }
});

async function cleanupCaches() {
  try {
    // Clean up API cache
    const apiCache = await caches.open(API_CACHE);
    const requests = await apiCache.keys();
    
    const now = Date.now();
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const request of requests) {
      const response = await apiCache.match(request);
      const fetchedOn = response.headers.get('sw-fetched-on');
      
      if (fetchedOn && (now - parseInt(fetchedOn) > MAX_AGE)) {
        await apiCache.delete(request);
      }
    }
    
    // Clean up dynamic cache
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const dynamicRequests = await dynamicCache.keys();
    
    // Keep dynamic cache under control - limit to 100 items
    if (dynamicRequests.length > 100) {
      // Delete oldest entries
      const toDelete = dynamicRequests.length - 100;
      for (let i = 0; i < toDelete; i++) {
        await dynamicCache.delete(dynamicRequests[i]);
      }
    }
    
    console.log('[SW] Cache cleanup completed');
  } catch (error) {
    console.error('[SW] Cache cleanup error:', error);
  }
}

// New function to check connection quality with improved detection
async function checkConnectionQuality() {
  try {
    const startTime = Date.now();
    const response = await fetch('/api/health/ping', { 
      method: 'GET',
      cache: 'no-store'
    });
    
    if (response.ok) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update connection quality based on latency
      if (latency < 300) {
        CONNECTION_QUALITY = 'good';
        ADAPTIVE_TIMEOUT = 5000;
      } else if (latency < 1000) {
        CONNECTION_QUALITY = 'slow';
        ADAPTIVE_TIMEOUT = 8000;
      } else {
        CONNECTION_QUALITY = 'poor';
        ADAPTIVE_TIMEOUT = 10000;
      }
    } else {
      CONNECTION_QUALITY = 'poor';
      ADAPTIVE_TIMEOUT = 10000;
    }
  } catch (error) {
    CONNECTION_QUALITY = 'none';
    ADAPTIVE_TIMEOUT = 3000; // Short timeout when offline to fail fast to cache
  }
  
  LAST_CONNECTION_CHECK = Date.now();
  
  // Notify all clients of the connection quality update
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      action: 'connection_quality_update',
      quality: CONNECTION_QUALITY
    });
  });
  
  console.log(`[SW] Connection quality: ${CONNECTION_QUALITY}, timeout: ${ADAPTIVE_TIMEOUT}ms`);
  return CONNECTION_QUALITY;
}

// Update connection quality based on request success/failure with adaptive learning
function updateConnectionQuality(success) {
  if (success) {
    if (CONNECTION_QUALITY === 'none') {
      CONNECTION_QUALITY = 'poor';
      ADAPTIVE_TIMEOUT = 10000;
    } else if (CONNECTION_QUALITY === 'poor') {
      // Gradually improve - don't jump straight to good
      CONNECTION_QUALITY = 'slow';
      ADAPTIVE_TIMEOUT = 8000;
    }
  } else {
    // Degrade connection quality one step
    if (CONNECTION_QUALITY === 'good') {
      CONNECTION_QUALITY = 'slow';
      ADAPTIVE_TIMEOUT = 8000;
    } else if (CONNECTION_QUALITY === 'slow') {
      CONNECTION_QUALITY = 'poor';
      ADAPTIVE_TIMEOUT = 10000;
    } else {
      CONNECTION_QUALITY = 'none';
      ADAPTIVE_TIMEOUT = 3000;
    }
  }
  return CONNECTION_QUALITY;
}

// Get adaptive timeout based on connection quality and strategy
function getAdaptiveTimeout() {
  if (OFFLINE_STRATEGY === 'fallback') {
    // If in fallback mode, use shorter timeouts
    return ADAPTIVE_TIMEOUT / 2;
  } else if (OFFLINE_STRATEGY === 'persistent') {
    // If in persistent mode, use longer timeouts
    return ADAPTIVE_TIMEOUT * 1.5;
  }
  return ADAPTIVE_TIMEOUT;
}

// Handle push notifications for important offline updates
self.addEventListener('push', function(event) {
  // Extract message data
  const payload = event.data ? event.data.json() : {};
  
  // Determine notification content
  const title = payload.title || 'Inequality Web Update';
  const options = {
    body: payload.body || 'New content available',
    icon: '/asset/Hogwarts logo.png',
    badge: '/asset/notification-badge.png',
    data: {
      url: payload.url || '/',
      ...payload.data
    }
  };
  
  // Show notification
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Get URL from notification data
  const url = event.notification.data.url || '/';
  
  // Open or focus on the relevant page
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(function(clientList) {
        // Check if there's already a window focused on the target URL
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
