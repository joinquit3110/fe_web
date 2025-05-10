import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { 
  fetchMagicPoints, 
  updateMagicPoints, 
  syncMagicPointsOperations, 
  USE_OFFLINE_MODE,
  checkAuthStatus 
} from "../api/magicPointsApi";

// API URL for direct calls
const API_URL = "https://be-web-6c4k.onrender.com/api";

// Create context
const MagicPointsContext = createContext();

// Custom hook for using the Magic Points context
export const useMagicPoints = () => useContext(MagicPointsContext);

// Define constants outside component to avoid initialization issues
const MAX_RETRIES = 5;
const DEFAULT_POINTS = 100;

// Move utility functions outside of the component to avoid circular dependencies

// Function to clear needsSync flag - completely rewritten to avoid circular dependencies
const clearNeedSync = async (token) => {
  try {
    if (!token) return;
    
    const authResponse = await fetch(`${API_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!authResponse.ok) return;
    
    const data = await authResponse.json();
    if (!data.authenticated) return;
    
    // Update user to clear needsSync flag
    await fetch(`${API_URL}/users/${data.userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        needsSync: false,
        lastSyncedAt: new Date().toISOString()
      })
    });

    return true;
  } catch (error) {
    console.error('[POINTS] Error clearing sync flag:', error);
    return false;
  }
};

// Function to check if user needs sync internally
const checkNeedSyncInternal = async (isAuthenticated, isOnline) => {
  try {
    if (!isAuthenticated || !isOnline) return null;
    
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const response = await fetch(`${API_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.authenticated) return null;
    
    // Get user details to check needsSync flag
    const userResponse = await fetch(`${API_URL}/users/${data.userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!userResponse.ok) return null;
    
    const userData = await userResponse.json();
    console.log('[POINTS] Check need sync:', userData.needsSync);
    return userData;
  } catch (error) {
    console.error('[POINTS] Error checking sync status:', error);
    return null;
  }
};

export const MagicPointsProvider = ({ children }) => {
  const [magicPoints, setMagicPoints] = useState(DEFAULT_POINTS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncRetries, setSyncRetries] = useState(0);

  // Track Revelio attempts for each blank - key is blankId, value is whether it's first attempt
  const [revelioAttempts, setRevelioAttempts] = useState({});
  // Track correctly answered blanks to avoid double counting
  const [correctBlanks, setCorrectBlanks] = useState({});

  // Create refs for function references to avoid circular dependencies
  const syncToServerRef = useRef(null);
  const forceSyncWithDebugRef = useRef(null);
  const fetchCurrentPointsRef = useRef(null);
  const checkServerPointsRef = useRef(null);
  const resetRevelioAttemptsRef = useRef(null);

  // Add a debounce mechanism for sync operations to reduce redundant syncs
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(0);
  const syncDebounceTimeRef = useRef(3000); // 3 seconds minimum between syncs

  // Fetch current points from server
  const fetchCurrentPoints = useCallback(async () => {
    if (!isAuthenticated || !isOnline) {
      console.log('[POINTS] Cannot fetch points: offline or not authenticated');
      return;
    }
    
    // If already syncing, don't start another sync
    if (isSyncing) {
      console.log('[POINTS] Already syncing, skipping fetchCurrentPoints');
      return;
    }
    
    try {
      setIsSyncing(true);
      console.log('[POINTS] Fetching current points from server');
      
      // Get auth token
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`${API_URL}/user/magic-points`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[POINTS] Server points: ${data.magicPoints}, local: ${magicPoints}`);
      
      // Only update if different
      if (data.magicPoints !== magicPoints) {
        console.log(`[POINTS] Updating points from server ${data.magicPoints}`);
        setMagicPoints(data.magicPoints);
        localStorage.setItem('magicPoints', data.magicPoints.toString());
        localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
        setLastSynced(new Date().toISOString());
      } else {
        console.log('[POINTS] Points are already in sync');
      }
      
      // Check if user was marked for sync while offline
      const user = await checkNeedSyncInternal(isAuthenticated, isOnline);
      if (user?.needsSync) {
        console.log('[POINTS] User was marked for sync while offline, clearing flag');
        await clearNeedSync(token);
      }
    } catch (error) {
      console.error('[POINTS] Error fetching current points:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isOnline, isSyncing, magicPoints]);
  
  // Update the ref after fetchCurrentPoints is defined
  useEffect(() => {
    fetchCurrentPointsRef.current = fetchCurrentPoints;
  }, [fetchCurrentPoints]);

  // Function to check if user needs sync - public version that uses the ref
  const checkNeedSync = useCallback(async () => {
    try {
      const userData = await checkNeedSyncInternal(isAuthenticated, isOnline);
      
      // If user needs sync, trigger an immediate sync operation
      if (userData?.needsSync) {
        console.log('[POINTS] User needs sync from server, initiating sync');
        if (fetchCurrentPointsRef.current) {
          await fetchCurrentPointsRef.current();
        }
        // Get token and use the standalone clearNeedSync function
        const token = localStorage.getItem('token');
        await clearNeedSync(token);
      }
      
      return userData;
    } catch (error) {
      console.error('[POINTS] Error in checkNeedSync:', error);
      return null;
    }
  }, [isAuthenticated, isOnline]);

  // Define syncToServer function
  const syncToServer = useCallback(async () => {
    // Create a local reference to the current retry count that remains stable for this function call
    const currentRetryAttempt = parseInt(localStorage.getItem('syncRetryCount') || '0', 10);
    
    if (isSyncing || !isOnline) {
      console.log(`[POINTS] Sync aborted - isSyncing: ${isSyncing}, isOnline: ${isOnline}`);
      return;
    }

    // Only attempt to sync if there are actual changes to sync
    if (!pendingChanges && pendingOperations.length === 0) {
      console.log('[POINTS] No changes to sync, skipping sync operation');
      return;
    }

    setIsSyncing(true);
    console.log(`[POINTS] Starting sync to server (attempt ${currentRetryAttempt + 1}/${MAX_RETRIES})`);

    try {
      if (pendingOperations.length > 0) {
        const sortedOperations = [...pendingOperations].sort((a, b) =>
          new Date(a.timestamp) - new Date(b.timestamp)
        );

        try {
          // Use sync operations endpoint instead of fetching first
          console.log(`[POINTS] Syncing ${sortedOperations.length} operations to server:`, 
            sortedOperations.map(op => `${op.type}:${op.amount}`).join(', '));
          
          // Clone operations to prevent potential mutations
          const operationsToSync = JSON.parse(JSON.stringify(sortedOperations));
          
          // Verify token exists before syncing
          const token = localStorage.getItem('token') || localStorage.getItem('authToken');
          if (!token) {
            console.log('[POINTS] No auth token found, skipping server sync');
            throw new Error('Authentication required');
          }
          
          // Log the actual token format (just the beginning for security)
          console.log('[POINTS] Auth token format check:', `${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
          
          try {
            const response = await syncMagicPointsOperations(operationsToSync);
            const { magicPoints: serverPoints } = response;

            // Clear pending operations only after successful sync
            setPendingOperations([]);
            localStorage.removeItem('pendingOperations');

            setMagicPoints(serverPoints);
            localStorage.setItem('magicPoints', serverPoints);
            console.log(`[POINTS] Synced all operations, new point value: ${serverPoints}`);
            
            // Reset retry counter on success
            localStorage.setItem('syncRetryCount', '0');
            setSyncRetries(0);
            
            // Dispatch an event to notify UI components of successful sync
            window.dispatchEvent(new CustomEvent('syncComplete', {
              detail: {
                points: serverPoints,
                source: 'syncToServer',
                operation: 'sync',
                timestamp: new Date().toISOString()
              }
            }));
            
            // Also dispatch the magicPointsUpdated event for consistent behavior
            window.dispatchEvent(new CustomEvent('magicPointsUpdated', {
              detail: {
                points: serverPoints,
                source: 'syncToServer',
                operation: 'sync',
                timestamp: new Date().toISOString()
              }
            }));
          } catch (syncError) {
            console.error(`[POINTS] Specific sync error: ${syncError.message}`);
            
            // Handle authentication errors specially
            if (syncError.message && (
              syncError.message.includes('Authentication') || 
              syncError.message.includes('401') || 
              syncError.message.includes('403')
            )) {
              console.error('[POINTS] Authentication error during sync, clearing auth state');
              setIsAuthenticated(false);
              localStorage.setItem('isAuthenticated', 'false');
              throw new Error(`Authentication failed: ${syncError.message}`);
            }
            
            throw syncError;
          }
        } catch (error) {
          console.error(`[POINTS] Error during sync operations: ${error.message}`);
          throw error;
        }
      } else if (pendingChanges) {
        console.log(`[POINTS] No pending operations, updating points directly to: ${magicPoints}`);
        
        // Verify token exists before syncing
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('[POINTS] No auth token found, skipping server sync');
          throw new Error('Authentication required');
        }
        
        const response = await updateMagicPoints(magicPoints);
        console.log(`[POINTS] Updated points directly to: ${response.magicPoints}`);
        
        // Reset retry counter on success
        localStorage.setItem('syncRetryCount', '0');
        setSyncRetries(0);
      } else {
        console.log('[POINTS] No pending changes or operations to sync');
        // Reset retry counter as there's nothing to sync
        localStorage.setItem('syncRetryCount', '0');
        setSyncRetries(0);
      }

      const now = new Date().toISOString();
      localStorage.setItem('magicPointsTimestamp', now);
      setLastSynced(now);
      setPendingChanges(false);

    } catch (error) {
      console.error(`[POINTS] Error syncing magic points: ${error.message}`);
      
      // Use the captured retry count to calculate the next value
      const nextRetryCount = currentRetryAttempt + 1;
      console.log(`[POINTS] Setting retry count from ${currentRetryAttempt} to ${nextRetryCount}`);
      
      // Update both state and localStorage
      setSyncRetries(nextRetryCount);
      localStorage.setItem('syncRetryCount', nextRetryCount.toString());
      
      if (nextRetryCount < MAX_RETRIES) {
        const retryDelay = Math.min(1000 * (2 ** nextRetryCount), 30000);
        console.log(`[POINTS] Will retry sync in ${retryDelay}ms (attempt ${nextRetryCount + 1}/${MAX_RETRIES})`);
        
        // Only set up retry if we're still online
        setTimeout(() => {
          if (isOnline) {
            // By this time, isSyncing should be false due to the finally block
            if (!isSyncing) {
              console.log(`[POINTS] Executing retry #${nextRetryCount + 1} with retry count ${nextRetryCount}`);
              // Use the ref to avoid dependency issues
              if (syncToServerRef.current) {
                syncToServerRef.current();
              }
            } else {
              console.log(`[POINTS] Skipping retry #${nextRetryCount + 1} - sync already in progress`);
            }
          } else {
            console.log(`[POINTS] Skipping retry #${nextRetryCount + 1} - offline`);
          }
        }, retryDelay);
      } else {
        console.log(`[POINTS] Max retries (${MAX_RETRIES}) reached, giving up sync`);
        // Store points locally to prevent complete loss
        localStorage.setItem('magicPoints', magicPoints);
        
        // We should keep pending operations for future sync attempts
        console.log(`[POINTS] Keeping ${pendingOperations.length} operations for future sync attempts`);
        
        // Reset the retry counter to allow future attempts
        localStorage.setItem('syncRetryCount', '0');
        setSyncRetries(0);
        setPendingChanges(false);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, pendingOperations, pendingChanges, magicPoints]);

  // Update the ref after syncToServer is defined
  useEffect(() => {
    syncToServerRef.current = syncToServer;
  }, [syncToServer]);

  // Enhanced force sync function with checks for recent syncs
  const forceSync = useCallback(async () => {
    console.log('[POINTS] Force syncing points to server');
    
    // Check if we've synced recently
    const now = Date.now();
    if (now - lastSyncTimestamp < syncDebounceTimeRef.current) {
      console.log(`[POINTS] Sync throttled - last sync was ${(now - lastSyncTimestamp)/1000}s ago, minimum delay is ${syncDebounceTimeRef.current/1000}s`);
      return;
    }
    
    // Mark sync time
    setLastSyncTimestamp(now);
    
    if (!isAuthenticated) {
      console.log('[POINTS] Cannot sync while not authenticated');
      return;
    }

    if (pendingOperations.length === 0 && !pendingChanges) {
      console.log('[POINTS] No changes to sync, skipping sync operation');
      return;
    }

    // Continue with sync logic...
    if (syncToServerRef.current) {
      return syncToServerRef.current();
    }
  }, [isAuthenticated, pendingOperations, pendingChanges, lastSyncTimestamp, syncToServer]);

  // Force sync with debug information
  const forceSyncWithDebug = useCallback(async () => {
    console.log('[POINTS DEBUG] Force syncing with debug info...');
    
    // Log auth state
    const token = localStorage.getItem('token');
    const authToken = localStorage.getItem('authToken');
    console.log(`[POINTS DEBUG] Auth token: ${token ? 'Present' : 'Missing'}`);
    console.log(`[POINTS DEBUG] Alt auth token: ${authToken ? 'Present' : 'Missing'}`);
    console.log(`[POINTS DEBUG] Token length: ${token?.length || 0}`);
    console.log(`[POINTS DEBUG] isAuthenticated state: ${isAuthenticated}`);
    
    // Verify with server
    try {
      const authStatus = await checkAuthStatus();
      console.log(`[POINTS DEBUG] Server auth check: ${JSON.stringify(authStatus)}`);
    } catch (error) {
      console.error('[POINTS DEBUG] Error checking auth:', error);
    }
    
    // Verify local storage
    console.log(`[POINTS DEBUG] Local magic points: ${localStorage.getItem('magicPoints')}`);
    console.log(`[POINTS DEBUG] State magic points: ${magicPoints}`);
    
    // Log pending operations
    const storedOps = localStorage.getItem('pendingOperations');
    const parsedOps = storedOps ? JSON.parse(storedOps) : [];
    console.log(`[POINTS DEBUG] Pending operations in localStorage: ${parsedOps.length}`);
    console.log(`[POINTS DEBUG] Pending operations in state: ${pendingOperations.length}`);
    
    // Check for discrepancies
    if (pendingOperations.length !== parsedOps.length) {
      console.warn('[POINTS DEBUG] Discrepancy between state and localStorage operations!');
      // Sync the state from localStorage to ensure consistency
      setPendingOperations(parsedOps);
    }
    
    if (pendingOperations.length > 0) {
      console.log('[POINTS DEBUG] Pending operations:', pendingOperations);
    }
    
    try {
      if (syncToServerRef.current) {
        await syncToServerRef.current();
      }
      return true;
    } catch (error) {
      console.error('[POINTS DEBUG] Sync error:', error);
      return false;
    }
  }, [pendingOperations, magicPoints, isAuthenticated]);

  // Update the ref after forceSyncWithDebug is defined
  useEffect(() => {
    forceSyncWithDebugRef.current = forceSyncWithDebug;
  }, [forceSyncWithDebug]);

  // A debug function to expose current state for debugging purposes
  const debugPointsState = useCallback((silent = false) => {
    if (!silent) {
      console.log('[POINTS DEBUG] Current state:');
      console.log(`[POINTS DEBUG] Magic points: ${magicPoints}`);
      console.log(`[POINTS DEBUG] Is online: ${isOnline}`);
      console.log(`[POINTS DEBUG] Is authenticated: ${isAuthenticated}`);
      console.log(`[POINTS DEBUG] Is syncing: ${isSyncing}`);
      console.log(`[POINTS DEBUG] Last synced: ${lastSynced}`);
      console.log(`[POINTS DEBUG] Pending changes: ${pendingChanges}`);
      console.log(`[POINTS DEBUG] Pending operations: ${pendingOperations.length}`);
      console.log(`[POINTS DEBUG] Sync retries: ${syncRetries}`);
    }
    
    return {
      magicPoints,
      isOnline,
      isAuthenticated,
      isSyncing,
      lastSynced,
      pendingChanges,
      pendingOperations,
      syncRetries,
      revelioAttempts: Object.keys(revelioAttempts).length,
      correctBlanks: Object.keys(correctBlanks).length
    };
  }, [
    magicPoints, 
    isOnline, 
    isAuthenticated, 
    isSyncing, 
    lastSynced, 
    pendingChanges, 
    pendingOperations,
    syncRetries,
    revelioAttempts,
    correctBlanks
  ]);

  // Load authentication state from localStorage - improved to detect real-time changes
  useEffect(() => {
    // Initial check from localStorage
    const authState = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authState === 'true');

    // Watch localStorage for changes to authentication status
    const handleStorageChange = (e) => {
      if (e.key === 'isAuthenticated' || e.key === 'token' || e.key === 'user') {
        const currentAuthState = localStorage.getItem('isAuthenticated');
        console.log('[POINTS] Auth state change detected via storage:', currentAuthState);
        setIsAuthenticated(currentAuthState === 'true');
      }
    };
    
    // Also listen for direct auth state change event
    const handleAuthStateChanged = () => {
      const currentAuthState = localStorage.getItem('isAuthenticated');
      console.log('[POINTS] Auth state change detected via event:', currentAuthState);
      setIsAuthenticated(currentAuthState === 'true');
      
      // If now authenticated, verify with server immediately and check for sync needs
      if (currentAuthState === 'true') {
        // Immediate verification with server
        verifyAuth();
        
        // Check for pending operations to auto-sync
        const pendingOps = localStorage.getItem('pendingOperations');
        if (pendingOps && JSON.parse(pendingOps).length > 0) {
          console.log('[POINTS] Found pending operations on auth state change, triggering auto-sync');
          setTimeout(() => {
            if (syncToServerRef.current) {
              syncToServerRef.current();
            }
          }, 1000);
        }
      }
    };
    
    // Add storage event listener
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom auth state change events
    window.addEventListener('authStateChanged', handleAuthStateChanged);
    
    // Also set up a MutationObserver to watch for direct localStorage changes
    // that don't trigger storage events (same window updates)
    const localStorageObserver = setInterval(() => {
      const currentAuthState = localStorage.getItem('isAuthenticated');
      if ((currentAuthState === 'true') !== isAuthenticated) {
        console.log('[POINTS] Auth state change detected via polling:', currentAuthState);
        setIsAuthenticated(currentAuthState === 'true');
      }
    }, 1000);
    
    // Verify authentication status with server
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuthStatus();
        console.log('[POINTS] Auth verification result:', authStatus);
        
        if (authStatus.authenticated) {
          setIsAuthenticated(true);
          localStorage.setItem('isAuthenticated', 'true');
          
          // Dispatch a custom event to synchronize other contexts
          const syncEvent = new CustomEvent('authStatusVerified', {
            detail: { authenticated: true, userId: authStatus.userId }
          });
          window.dispatchEvent(syncEvent);
          
          // If authenticated, check for pending operations to auto-sync
          const pendingOps = localStorage.getItem('pendingOperations');
          if (pendingOps && JSON.parse(pendingOps).length > 0) {
            console.log('[POINTS] Found pending operations on load, triggering auto-sync');
            // Use a slight delay to ensure all states are properly initialized
            setTimeout(() => {
              if (syncToServerRef.current) {
                syncToServerRef.current();
              }
            }, 1000); // Reduced from 1500ms to 1000ms
          } else {
            console.log('[POINTS] No pending operations found on load');
          }
        } else {
          console.warn(`[POINTS] Auth verification failed: ${authStatus.reason}`);
          // Set local state to match server status to ensure we're in sync
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('[POINTS] Error verifying auth:', error);
      }
    };
    
    if (authState === 'true' && navigator.onLine) {
      verifyAuth();
    }
    
    // Clean up event listeners and intervals
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthStateChanged);
      clearInterval(localStorageObserver);
    };

    // Also load pending operations
    const savedOperations = localStorage.getItem('pendingOperations');
    if (savedOperations) {
      setPendingOperations(JSON.parse(savedOperations));
    }
    
    // Load stored magic points from localStorage as backup
    const storedPoints = localStorage.getItem('magicPoints');
    if (storedPoints) {
      const parsedPoints = parseInt(storedPoints, 10);
      // Ensure points are never less than 0
      setMagicPoints(parsedPoints >= 0 ? parsedPoints : DEFAULT_POINTS);
    } else {
      // If no stored points, initialize to DEFAULT_POINTS
      localStorage.setItem('magicPoints', DEFAULT_POINTS.toString());
    }
    
    // Load stored revelio attempts from localStorage
    const storedRevelioAttempts = localStorage.getItem('revelioAttempts');
    if (storedRevelioAttempts) {
      setRevelioAttempts(JSON.parse(storedRevelioAttempts));
    }
    
    // Load stored correct blanks from localStorage
    const storedCorrectBlanks = localStorage.getItem('correctBlanks');
    if (storedCorrectBlanks) {
      setCorrectBlanks(JSON.parse(storedCorrectBlanks));
    }
    
    // Set up online/offline event listeners with improved handlers
    const handleOnline = () => {
      console.log('[POINTS] Back online, attempting to sync');
      setIsOnline(true);
      // Attempt to sync when coming back online
      if (pendingOperations.length > 0 || pendingChanges) {
        setTimeout(() => {
          if (syncToServerRef.current) {
            syncToServerRef.current();
          }
        }, 1000);
      }
    };
    
    const handleOffline = () => {
      console.log('[POINTS] Device went offline, pausing sync operations');
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Clean up event listeners properly
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingChanges]);

  // Also add an initial sync attempt at the end of the useEffect
  useEffect(() => {
    // Auto-sync on app load if online and authenticated
    if (isOnline && isAuthenticated && pendingOperations.length > 0) {
      console.log('[POINTS] Auto-syncing points on app initialization');
      // Use timeout to ensure the component is fully mounted
      const autoSyncTimeout = setTimeout(() => {
        if (syncToServerRef.current) {
          syncToServerRef.current();
        }
      }, 2000);
      
      return () => clearTimeout(autoSyncTimeout);
    }
  }, [isOnline, isAuthenticated, pendingOperations.length]);

  // Perform background sync when reconnecting online
  useEffect(() => {
    let syncTimeout;
    
    if (isOnline && isAuthenticated && !isSyncing) {
      // When coming back online, attempt to sync after a short delay
      if (pendingOperations.length > 0 || pendingChanges) {
        console.log("[POINTS] Back online with pending changes, will sync shortly");
        syncTimeout = setTimeout(() => {
          if (syncToServerRef.current) {
            syncToServerRef.current().catch(error => {
              console.error("[POINTS] Background sync error:", error);
            });
          }
        }, 3000); // Delay by 3 seconds to allow other resources to load first
      } else {
        // Even if no pending operations, do a lightweight check to ensure
        // our data is up-to-date with the server (could have been changed by admin)
        syncTimeout = setTimeout(() => {
          // Use the ref instead of direct function call to avoid circular dependency
          if (checkServerPointsRef.current) {
            checkServerPointsRef.current().catch(error => {
              console.error("[POINTS] Error checking server points:", error);
            });
          }
        }, 5000); // Longer delay for non-critical sync
      }
    }
    
    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
    };
  }, [isOnline, isAuthenticated, isSyncing, pendingOperations.length, pendingChanges]);
  
  // New function to just check server points without forcing sync
  const checkServerPoints = useCallback(async () => {
    if (!isAuthenticated || isSyncing) return;
    
    try {
      console.log("[POINTS] Checking server for updated points");
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("[POINTS] No auth token found, skipping server check");
        return;
      }
      
      // Fetch current points from server
      const response = await fetch(`${API_URL}/user/magic-points`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      const serverPoints = data.magicPoints;
      
      // Compare with local points
      const localPoints = magicPoints;
      
      // Only update if different and we have no pending operations
      if (serverPoints !== localPoints && pendingOperations.length === 0 && !pendingChanges) {
        console.log(`[POINTS] Server points (${serverPoints}) differ from local (${localPoints}), updating local`);
        setMagicPoints(serverPoints);
        localStorage.setItem('magicPoints', serverPoints.toString());
        localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
      } else {
        console.log(`[POINTS] Points match or have pending changes. Server: ${serverPoints}, Local: ${localPoints}`);
      }
      
      return serverPoints;
    } catch (error) {
      console.error('[POINTS] Error checking server points:', error);
      // Don't throw error, just fail silently as this is a background check
    }
  }, [isAuthenticated, isSyncing, magicPoints, pendingChanges, pendingOperations.length]);

  // Update the ref after checkServerPoints is defined
  useEffect(() => {
    checkServerPointsRef.current = checkServerPoints;
  }, [checkServerPoints]);

  // Reset all Revelio attempts for a new exercise
  const resetRevelioAttempts = useCallback((blankIds = []) => {
    console.log(`[POINTS] Resetting Revelio attempts. Specific blanks: ${blankIds.length > 0 ? blankIds.join(', ') : 'none (all)'}`);
    
    if (blankIds.length === 0) {
      // Reset all blanks if no specific IDs provided
      console.log('[POINTS] Resetting all revelioAttempts and correctBlanks');
      setRevelioAttempts({});
      setCorrectBlanks({});
      localStorage.removeItem('revelioAttempts');
      localStorage.removeItem('correctBlanks');
    } else {
      // Reset only specific blanks
      const newRevelioAttempts = { ...revelioAttempts };
      const newCorrectBlanks = { ...correctBlanks };
      
      blankIds.forEach(id => {
        newRevelioAttempts[id] = true; // true means it's ready for first attempt
        delete newCorrectBlanks[id]; // Remove from correct blanks
      });
      
      setRevelioAttempts(newRevelioAttempts);
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
      console.log('[POINTS] Updated revelioAttempts:', newRevelioAttempts);
      console.log('[POINTS] Updated correctBlanks:', newCorrectBlanks);
    }
  }, [revelioAttempts, correctBlanks]);

  // Store the resetRevelioAttempts function in a ref to avoid circular dependencies
  useEffect(() => {
    resetRevelioAttemptsRef.current = resetRevelioAttempts;
  }, [resetRevelioAttempts]);

  // Add improved event listener for socket events to handle admin updates
  useEffect(() => {
    // Event listener for direct socket updates from SocketContext
    const handleSocketUpdate = (event) => {
      if (event.detail?.type === 'sync_update') {
        const data = event.detail.data;
        console.log('[POINTS] Received socket sync update:', data);
        
        if (data.type === 'force_sync') {
          // Admin triggered forced sync - prioritize this operation
          console.log('[POINTS] Admin triggered force sync');
          
          // Clear any pending sync operations and fetch immediately without delay
          if (isSyncing) {
            console.log('[POINTS] Cancelling current sync to prioritize admin-triggered sync');
          }
          
          // Use immediate sync with high priority - remove timeout delay
          if (forceSyncWithDebugRef.current) {
            forceSyncWithDebugRef.current().catch(err => 
              console.error('[POINTS] Error during admin-triggered sync:', err)
            );
          }
        } else if (data.type === 'reset_attempts') {
          // Admin reset attempts for this user
          console.log('[POINTS] Admin reset attempts notification received');
          
          // Clear all revelioAttempts and correctBlanks using the ref to avoid circular dependency
          if (resetRevelioAttemptsRef.current) {
            resetRevelioAttemptsRef.current();
          }
          
          // Show notification with alert or toast
          if (typeof window !== 'undefined') {
            const resetEvent = new CustomEvent('admin-reset-attempts', {
              detail: { message: data.message || 'Your attempts have been reset' }
            });
            window.dispatchEvent(resetEvent);
          }
          
          // Fetch updated points immediately
          if (checkServerPointsRef.current) {
            checkServerPointsRef.current();
          }
        } else if (data.type === 'user_update') {
          // Direct user update (e.g., house change, points change)
          console.log('[POINTS] Received user update:', data);

          // Check if this is a magic points update message
          if (data.message && data.message.includes('magic points')) {
            console.log('[POINTS] Detected magic points update message:', data.message);
            
            // Parse points value from message
            const pointsMatch = data.message.match(/updated to (\d+)/);
            if (pointsMatch && pointsMatch[1]) {
              const newPoints = parseInt(pointsMatch[1], 10);
              if (!isNaN(newPoints)) {
                console.log(`[POINTS] Updating points from server message to: ${newPoints} (previous: ${magicPoints})`);
                setMagicPoints(newPoints);
                localStorage.setItem('magicPoints', newPoints.toString());
                localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
                
                // Clear any pending operations since the server is now the source of truth
                setPendingOperations([]);
                localStorage.removeItem('pendingOperations');
                setPendingChanges(false);
                
                // Dispatch event for UI components to refresh
                const syncEvent = new CustomEvent('serverSyncCompleted', {
                  detail: { 
                    source: 'pointsUpdate',
                    timestamp: new Date().toISOString(),
                    points: newPoints
                  }
                });
                window.dispatchEvent(syncEvent);
                
                // Also update debug menu display
                const uiUpdateEvent = new CustomEvent('magicPointsUIUpdate', {
                  detail: { 
                    points: newPoints,
                    source: 'serverUpdate',
                    timestamp: new Date().toISOString()
                  }
                });
                window.dispatchEvent(uiUpdateEvent);
              }
            }
          }
          
          // If magic points were updated in the updatedFields, reflect that change immediately
          if (data.data?.updatedFields?.magicPoints !== undefined) {
            const newPoints = parseInt(data.data.updatedFields.magicPoints, 10);
            if (!isNaN(newPoints)) {
              console.log(`[POINTS] Updating points from server updatedFields to: ${newPoints} (previous: ${magicPoints})`);
              setMagicPoints(newPoints);
              localStorage.setItem('magicPoints', newPoints.toString());
              localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
              setLastSynced(new Date().toISOString());
              // Clear any pending operations since the server is now the source of truth
              setPendingOperations([]);
              localStorage.removeItem('pendingOperations');
              setPendingChanges(false);
              
              // Dispatch event for UI components to refresh
              const syncEvent = new CustomEvent('serverSyncCompleted', {
                detail: { 
                  source: 'pointsUpdate',
                  timestamp: new Date().toISOString(),
                  points: newPoints
                }
              });
              window.dispatchEvent(syncEvent);
              
              // Also update debug menu display
              const uiUpdateEvent = new CustomEvent('magicPointsUIUpdate', {
                detail: { 
                  points: newPoints,
                  source: 'serverUpdate',
                  timestamp: new Date().toISOString()
                }
              });
              window.dispatchEvent(uiUpdateEvent);
            }
          }
          
          // If house was updated, dispatch a custom event to update UI
          if (data.data?.updatedFields?.house !== undefined) {
            console.log(`[POINTS] House updated to: ${data.data.updatedFields.house}`);
            
            // Dispatch server sync event to ensure other components can react to house changes
            const syncEvent = new CustomEvent('serverSyncCompleted', {
              detail: { 
                source: 'houseChange',
                timestamp: new Date().toISOString(),
                immediate: true
              }
            });
            window.dispatchEvent(syncEvent);
          }
        } else if (event.detail?.type === 'global_update') {
          // Handle global updates that affect all users
          console.log('[POINTS] Received global update:', event.detail.data);
          
          // For certain types of updates, always check server for changes
          if (['user_house_changed', 'house_points_bulk_update'].includes(event.detail.data.type)) {
            // Stagger the sync to prevent server overload
            const randomDelay = Math.floor(Math.random() * 2000) + 500; // 0.5-2.5 seconds
            setTimeout(() => {
              if (checkServerPointsRef.current) {
                checkServerPointsRef.current();
              }
            }, randomDelay);
          }
        } else if (event.detail?.type === 'house_update') {
          // Handle house-specific updates
          console.log('[POINTS] Received house update:', event.detail.data);
          
          // Check for points updates from the server for all house members
          if (['house_points_changed', 'member_points_changed'].includes(event.detail.data.type)) {
            // Stagger the sync to prevent server overload
            const randomDelay = Math.floor(Math.random() * 1500) + 500; // 0.5-2 seconds
            setTimeout(() => {
              if (checkServerPointsRef.current) {
                checkServerPointsRef.current();
              }
            }, randomDelay);
          }
        }
      }
    };

    window.addEventListener('magicPointsSocketUpdate', handleSocketUpdate);
    return () => {
      window.removeEventListener('magicPointsSocketUpdate', handleSocketUpdate);
    };
  }, [isSyncing]); // Only depend on isSyncing, use refs for all function calls

  // Add handler for direct "magicPointsUpdated" events from SocketContext
  useEffect(() => {
    const handleDirectPointsUpdate = (event) => {
      const { points, source, immediate, isReset } = event.detail;
      
      if (points !== undefined && (source === 'serverSync' || source === 'adminUpdate')) {
        console.log(`[POINTS] Received direct points update from server: ${points} (immediate: ${immediate}, isReset: ${isReset})`);
        
        // Always update immediately if it's a reset or flagged as immediate
        const shouldForceUpdate = immediate === true || isReset === true;
        
        // Check if this is a significant points change (more than 20 points or a reset)
        const isSignificantChange = isReset || Math.abs(points - magicPoints) >= 20;
        
        // Only update if points are different from current state or it's a forced update
        if (points !== magicPoints || shouldForceUpdate) {
          // Make the update
          setMagicPoints(points);
          localStorage.setItem('magicPoints', points.toString());
          localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
          setLastSynced(new Date().toISOString());
          
          // Clear any pending operations since the server is now the source of truth
          setPendingOperations([]);
          localStorage.removeItem('pendingOperations');
          setPendingChanges(false);
          
          // If it's a reset or significant change, show more prominent feedback
          if (isReset) {
            console.log('[POINTS] Points have been reset to 100 by admin');
            
            // Create a more visible notification for resets
            try {
              const resetNotification = document.createElement('div');
              resetNotification.className = 'admin-reset-notification';
              resetNotification.style.position = 'fixed';
              resetNotification.style.top = '50%';
              resetNotification.style.left = '50%';
              resetNotification.style.transform = 'translate(-50%, -50%)';
              resetNotification.style.background = 'rgba(220, 53, 69, 0.9)';
              resetNotification.style.color = 'white';
              resetNotification.style.padding = '20px 30px';
              resetNotification.style.borderRadius = '8px';
              resetNotification.style.zIndex = '9999';
              resetNotification.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
              resetNotification.style.fontSize = '18px';
              resetNotification.style.fontWeight = 'bold';
              resetNotification.style.textAlign = 'center';
              resetNotification.innerHTML = `
                <div>Your magic points have been RESET to 100 by admin!</div>
                <div style="font-size: 14px; margin-top: 8px; opacity: 0.8;">All operations have been synchronized.</div>
              `;
              
              document.body.appendChild(resetNotification);
              
              // Remove after 5 seconds
              setTimeout(() => {
                if (resetNotification.parentNode) {
                  resetNotification.parentNode.removeChild(resetNotification);
                }
              }, 5000);
            } catch (error) {
              console.error('[POINTS] Error showing reset notification:', error);
            }
          }
          
          // Dispatch an event to ensure UI updates without requiring a refresh
          const uiUpdateEvent = new CustomEvent('magicPointsUIUpdate', {
            detail: { 
              points: points,
              source: isReset ? 'adminReset' : 'serverUpdate',
              isSignificantChange,
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(uiUpdateEvent);
        }
      }
    };
    
    window.addEventListener('magicPointsUpdated', handleDirectPointsUpdate);
    return () => {
      window.removeEventListener('magicPointsUpdated', handleDirectPointsUpdate);
    };
  }, [magicPoints]);

  // Points management functions
  const addPoints = useCallback((amount, source = '') => {
    if (amount <= 0) return;
    
    // First, immediately update local state and storage for responsiveness
    const newPoints = magicPoints + amount;
    setMagicPoints(newPoints);
    localStorage.setItem('magicPoints', newPoints);
    setPendingChanges(true);
    
    // Dispatch event for real-time updates in other components
    window.dispatchEvent(new CustomEvent('magicPointsUpdated', {
      detail: {
        points: newPoints,
        source: 'addPoints',
        delta: amount,
        operation: 'add',
        reason: source,
        timestamp: new Date().toISOString()
      }
    }));
    
    // Create operation record
    const operation = {
      type: 'add',
      amount,
      source,
      timestamp: new Date().toISOString()
    };
    
    // Update pending operations in local storage first
    setPendingOperations(prev => {
      const updated = [...prev, operation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Only attempt to sync if we're online and authenticated - but do it on next tick to avoid UI lag
    if (isOnline && isAuthenticated) {
      setTimeout(() => {
        if (syncToServerRef.current) {
          syncToServerRef.current();
        }
      }, 0);
    } else {
      console.log('[POINTS] Working in offline mode, changes will sync when online');
    }
  }, [magicPoints, isOnline, isAuthenticated]);

  const removePoints = useCallback((amount, source = '') => {
    if (amount <= 0) return;
    
    // First, immediately update local state and storage
    const currentPoints = parseInt(localStorage.getItem('magicPoints') || magicPoints.toString(), 10);
    const newPoints = Math.max(0, currentPoints - amount);
    
    console.log(`[POINTS] Removing ${amount} points from ${currentPoints}. New total: ${newPoints} (${source})`);
    
    // Update state and localStorage in a consistent way
    setMagicPoints(newPoints);
    localStorage.setItem('magicPoints', newPoints);
    setPendingChanges(true);
    
    // Dispatch event for real-time updates in other components
    window.dispatchEvent(new CustomEvent('magicPointsUpdated', {
      detail: {
        points: newPoints,
        source: 'removePoints',
        delta: -amount,
        operation: 'remove',
        reason: source,
        timestamp: new Date().toISOString()
      }
    }));
    
    const operation = {
      type: 'remove',
      amount,
      source,
      timestamp: new Date().toISOString()
    };
    
    // Ensure pendingOperations update is atomic and stored locally first
    setPendingOperations(prev => {
      const updated = [...prev, operation];
      try {
        localStorage.setItem('pendingOperations', JSON.stringify(updated));
      } catch (error) {
        console.error('[POINTS] Error storing pending operations:', error);
      }
      return updated;
    });
    
    // Only attempt to sync if we're online and authenticated - but do it on next tick to avoid UI lag
    if (isOnline && isAuthenticated) {
      setTimeout(() => {
        if (syncToServerRef.current) {
          syncToServerRef.current();
        }
      }, 0);
    } else {
      console.log('[POINTS] Working in offline mode, changes will sync when online');
    }
  }, [magicPoints, isOnline, isAuthenticated]);

  const addPointsWithLog = useCallback((amount, source = 'general') => {
    console.log(`[POINTS] Adding ${amount} points (${source})`);
    addPoints(amount, source);
  }, [addPoints]);

  const removePointsWithLog = useCallback((amount, source = 'general') => {
    console.log(`[POINTS] Removing ${amount} points (${source})`);
    removePoints(amount, source);
  }, [removePoints]);
  
  // Define processBlankSubmission first to avoid circular reference issues
  const processBlankSubmission = useCallback((blankId, isCorrect) => {
    console.log(`[POINTS] Processing blank submission ${blankId}. Is correct: ${isCorrect}`);
    
    // Check if this blank has already been answered correctly previously
    if (correctBlanks[blankId]) {
      console.log(`[POINTS] Blank ${blankId} was already answered correctly, skipping scoring`);
      return isCorrect;
    }
    
    // Check if this is the first attempt for this blank
    const isFirstAttempt = revelioAttempts[blankId] === undefined || revelioAttempts[blankId] === true;
    console.log(`[POINTS] Is first attempt for ${blankId}: ${isFirstAttempt}`);
    
    // Current magic points before processing
    const pointsBefore = magicPoints;
    console.log(`[POINTS] Current points before processing: ${pointsBefore}`);
    
    // 2.1. Updated Charm the Blanks scoring rules:
    // 2.1.1: First Revelio attempt - wrong: -10 points, correct: no points
    // 2.1.2: Second+ Revelio attempts - corrected answer: +10 points, wrong again: -10 points
    
    if (isCorrect) {
      if (!isFirstAttempt) {
        // 2.1.2: Second+ attempt that's now correct (corrected a previous wrong answer)
        console.log(`[POINTS] Blank ${blankId} corrected after initial wrong attempt, adding 10 points`);
        addPointsWithLog(10, `revelio_correction_${blankId}`);
      } else {
        // 2.1.1: First attempt correct - no points awarded
        console.log(`[POINTS] Blank ${blankId} correctly answered on first attempt, no points awarded`);
      }
      
      // Add to correct blanks to avoid double counting
      const newCorrectBlanks = { ...correctBlanks, [blankId]: true };
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
    } else {
      // Wrong answer (both first attempt and subsequent attempts)
      console.log(`[POINTS] Blank ${blankId} answered incorrectly, removing 10 points from ${magicPoints}`);
      removePointsWithLog(10, `revelio_incorrect_${blankId}`);
      
      // Mark as no longer first attempt if it was the first attempt
      if (isFirstAttempt) {
        console.log(`[POINTS] Marking ${blankId} as no longer first attempt`);
        const newRevelioAttempts = { ...revelioAttempts, [blankId]: false };
        setRevelioAttempts(newRevelioAttempts);
        localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
      }
    }
    
    // Log the point change
    console.log(`[POINTS] Points after processing ${blankId}: ${magicPoints} (change: ${magicPoints - pointsBefore})`);
    
    return isCorrect;
  }, [revelioAttempts, correctBlanks, addPointsWithLog, removePointsWithLog, magicPoints]);
  
  // Then define handleBlankRevelioAttempt which is now just an alias to processBlankSubmission for consistency
  const handleBlankRevelioAttempt = processBlankSubmission;
  
  // Add batch processing for multiple blanks - keep for backward compatibility
  const processMultipleBlanks = useCallback((results) => {
    console.log('[POINTS] Processing multiple blanks submission:', results);
    
    let correctCount = 0;
    let processingPromises = [];
    
    // Process each blank
    Object.entries(results).forEach(([blankId, isCorrect]) => {
      if (isCorrect) correctCount++;
      processingPromises.push(processBlankSubmission(blankId, isCorrect));
    });
    
    // No more bonus points for high accuracy
    console.log(`[POINTS] Results: ${correctCount}/${Object.keys(results).length} correct`);
    
    return Promise.all(processingPromises);
  }, [processBlankSubmission]);

  // Then define handleMultipleRevelioAttempts which references processBlankSubmission
  const handleMultipleRevelioAttempts = useCallback((results) => {
    console.log('[POINTS] Processing multiple blanks submission:', results);
    
    // Process each blank individually with updated scoring rules
    const processingPromises = Object.entries(results).map(([blankId, isCorrect]) => 
      processBlankSubmission(blankId, isCorrect)
    );
    
    // Log overall results
    const correctCount = Object.values(results).filter(Boolean).length;
    const totalBlanks = Object.keys(results).length;
    console.log(`[POINTS] Revelio results: ${correctCount}/${totalBlanks} correct`);
    
    return Promise.all(processingPromises);
  }, [processBlankSubmission]);
  
  // Handle inequality format checks
  const handleInequalityFormatCheck = useCallback((isValid, index) => {
    console.log(`[POINTS] Checking inequality ${index} format: ${isValid ? 'valid' : 'invalid'}`);
    
    if (!isValid) {
      // Deduct points for invalid format
      removePointsWithLog(10, `inequality_format_invalid_${index}`);
      return false;
    }
    
    // No points awarded for correct format
    console.log(`[POINTS] Inequality ${index} format is valid, no points awarded`);
    return true;
  }, [removePointsWithLog]);
  
  // Handle inequality solution checks
  const handleInequalitySolutionCheck = useCallback((systemHasSolution, selectedNoSolution, isSolutionCorrect) => {
    console.log(`[POINTS] Checking inequality solution:
      System has solution: ${systemHasSolution}
      Selected No Solution: ${selectedNoSolution}
      Is solution correct: ${isSolutionCorrect}`);
    
    // Case 1: System has no solution but user didn't select "No solution"
    if (!systemHasSolution && !selectedNoSolution) {
      removePointsWithLog(10, 'inequality_missed_no_solution');
      return false;
    }
    
    // Case 2: System has solution but user either selected "No solution" or entered wrong coordinates
    if (systemHasSolution && (!isSolutionCorrect || selectedNoSolution)) {
      removePointsWithLog(10, 'inequality_wrong_solution');
      return false;
    }
    
    // No points awarded for correct solution
    console.log('[POINTS] Inequality solution is correct, no points awarded');
    return true;
  }, [removePointsWithLog]);

  // Handle wrong region selection in Activity 2
  const handleWrongRegionSelection = useCallback((inequalityLabel) => {
    console.log(`[POINTS] Wrong region selected for inequality ${inequalityLabel}`);
    removePointsWithLog(10, `activity2_wrong_region_${inequalityLabel}`);
    return false;
  }, [removePointsWithLog]);
  
  // Handle wrong coordinate input in Activity 2
  const handleWrongCoordinateInput = useCallback((coordinateType, pointLabel) => {
    console.log(`[POINTS] Wrong ${coordinateType} coordinate entered for point ${pointLabel}`);
    removePointsWithLog(10, `activity2_wrong_coordinate_${coordinateType}_${pointLabel}`);
    return false;
  }, [removePointsWithLog]);

  // Utility function to log current points state (for debugging)
  const logCurrentPoints = useCallback(() => {
    console.log(`[POINTS] Current magic points: ${magicPoints}`);
    console.log(`[POINTS] Pending operations: ${pendingOperations.length}`);
    console.log(`[POINTS] Last synced: ${lastSynced || 'never'}`);
    console.log(`[POINTS] Is online: ${isOnline}, Is syncing: ${isSyncing}`);
    return {
      magicPoints,
      pendingOperations,
      lastSynced,
      isOnline,
      isSyncing
    };
  }, [magicPoints, pendingOperations, lastSynced, isOnline, isSyncing]);

  // Reset points to DEFAULT_POINTS
  const resetPoints = useCallback(async () => {
    console.log(`[POINTS DEBUG] Resetting points to ${DEFAULT_POINTS}`);
    
    // Reset local state immediately
    setMagicPoints(DEFAULT_POINTS);
    localStorage.setItem('magicPoints', DEFAULT_POINTS.toString());
    
    // Add a reset operation
    const resetOperation = {
      type: 'set',
      amount: DEFAULT_POINTS,
      source: 'debug_reset',
      timestamp: new Date().toISOString()
    };
    
    // Update pending operations in local storage first
    setPendingOperations(prev => {
      const updated = [...prev, resetOperation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Force sync if online in the background
    if (isOnline && isAuthenticated) {
      setTimeout(async () => {
        try {
          if (syncToServerRef.current) {
            await syncToServerRef.current();
          }
        } catch (error) {
          console.error('[POINTS DEBUG] Error syncing after reset:', error);
        }
      }, 0);
    } else {
      console.log('[POINTS DEBUG] Working offline, changes will sync when online');
    }
    
    return true; // Return immediately after local update for better responsiveness
  }, [isOnline, isAuthenticated]);
  
  // Update authentication status (for debugging purposes)
  const updateAuthentication = useCallback((authData) => {
    if (authData) {
      console.log('[POINTS DEBUG] Setting authenticated state');
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authToken', authData.token);
      localStorage.setItem('token', authData.token);
    } else {
      console.log('[POINTS DEBUG] Clearing authenticated state');
      setIsAuthenticated(false);
      localStorage.setItem('isAuthenticated', 'false');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
    }
  }, []);
  
  // Add offline mode detection property
  const isOfflineMode = USE_OFFLINE_MODE || !isOnline || !isAuthenticated;

  return (
    <MagicPointsContext.Provider value={{
      magicPoints,
      addPoints,
      removePoints,
      addPointsWithLog,
      removePointsWithLog,
      isOnline,
      isSyncing,
      lastSynced,
      pendingChanges,
      pendingOperations,
      resetRevelioAttempts,
      handleBlankRevelioAttempt,
      handleMultipleRevelioAttempts,
      handleInequalityFormatCheck,
      handleInequalitySolutionCheck,
      handleWrongRegionSelection,
      handleWrongCoordinateInput,
      processBlankSubmission, // Keep for backward compatibility
      processMultipleBlanks,  // Keep for backward compatibility
      logCurrentPoints,
      forceSync,
      debugPointsState,
      forceSyncWithDebug,
      resetPoints,
      updateAuthentication,
      isOfflineMode,
      isAuthenticated
    }}>
      {children}
    </MagicPointsContext.Provider>
  );
};
