import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
// Import API functions with explicit naming
import { 
  getAuthToken, 
  checkAuthStatus as apiCheckAuthStatus, 
  updateMagicPoints as apiUpdateMagicPoints, 
  clearNeedSync as apiClearNeedSync, 
  checkNeedSync as apiCheckNeedSync 
} from '../api/magicPointsApi.js';

// API URL for direct calls (if needed, though magicPointsApi.js should handle this)
const API_URL = process.env.REACT_APP_API_URL || "/api";

// Create context
const MagicPointsContext = createContext();

// Custom hook for using the Magic Points context
export const useMagicPoints = () => {
  const context = useContext(MagicPointsContext);
  if (context === undefined) {
    throw new Error('useMagicPoints must be used within a MagicPointsProvider');
  }
  return context;
};

// Define constants outside component to avoid initialization issues
const MAX_RETRIES = 5;
const DEFAULT_POINTS = 100;

// MagicPointsProvider Component
export const MagicPointsProvider = ({ children }) => {
  const [magicPoints, setMagicPoints] = useState(DEFAULT_POINTS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine && localStorage.getItem('offlineMode') !== 'true');
  const [pendingChanges, setPendingChanges] = useState(false);
  const [pendingOperations, setPendingOperations] = useState([]);
  
  // This state should ideally come from AuthContext to avoid divergence.
  // For now, keeping it and renaming to avoid direct collision if both contexts are used.
  const [isAuthenticated_MagicPoints, setIsAuthenticated_MagicPoints] = useState(localStorage.getItem('isAuthenticated') === 'true');
  
  const [syncRetries, setSyncRetries] = useState(0);
  const [offlineMode, setOfflineMode] = useState(localStorage.getItem('offlineMode') === 'true');

  const [revelioAttempts, setRevelioAttempts] = useState({});
  const [correctBlanks, setCorrectBlanks] = useState({});

  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(0);
  const syncDebounceTimeRef = useRef(3000); // 3 seconds debounce

  // Effect to update isAuthenticated_MagicPoints when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated_MagicPoints(localStorage.getItem('isAuthenticated') === 'true');
      setOfflineMode(localStorage.getItem('offlineMode') === 'true');
      setIsOnline(navigator.onLine && localStorage.getItem('offlineMode') !== 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom authStateChange event
    window.addEventListener('authStateChange', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChange', handleStorageChange);
    };
  }, []);


  const syncToServer = useCallback(async (currentPoints) => {
    if (isSyncing || !isOnline || !isAuthenticated_MagicPoints) {
      console.log('[MagicPointsContext] Sync skipped:', { isSyncing, isOnline, isAuthenticated_MagicPoints });
      return;
    }
    setIsSyncing(true);
    console.log('[MagicPointsContext] Starting sync to server with points:', currentPoints);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No auth token for sync");
      
      // Include pending operations if any
      const pointsToSync = pendingOperations.reduce((acc, op) => acc + op.amount, currentPoints);
      
      await apiUpdateMagicPoints(pointsToSync, token, pendingOperations);
      setMagicPoints(pointsToSync); // Ensure local state matches synced state
      setPendingOperations([]); // Clear operations after successful sync
      setPendingChanges(false);
      setLastSynced(new Date().toISOString());
      setSyncRetries(0);
      console.log('[MagicPointsContext] Sync successful.');
      
      // Try to clear the sync flag but don't fail if it doesn't work
      try {
        if (apiClearNeedSync && typeof apiClearNeedSync === 'function') {
          await apiClearNeedSync(token);
        } else {
          console.warn('[MagicPointsContext] apiClearNeedSync function not available');
        }
      } catch (clearError) {
        console.warn('[MagicPointsContext] Failed to clear needSync flag:', clearError);
        // Don't rethrow - we don't want to mark the sync as failed just because clearing the flag failed
      }
    } catch (error) {
      console.error('[MagicPointsContext] Sync failed:', error);
      setSyncRetries(prev => prev + 1);
      // Handle specific errors or max retries if needed
    } finally {
      setIsSyncing(false);
      setLastSyncTimestamp(Date.now());
    }
  }, [isSyncing, isOnline, isAuthenticated_MagicPoints, pendingOperations]);

  const fetchCurrentPoints = useCallback(async () => {
    if (!isAuthenticated_MagicPoints || !isOnline || isSyncing) return;
    console.log('[MagicPointsContext] Fetching current points from server.');
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No auth token for fetching points");
      // This should ideally fetch points, not just check auth status
      // Assuming magicPointsApi.js has a function like `fetchPoints`
      // For now, using checkAuthStatus as a placeholder if it returns points
      const authData = await apiCheckAuthStatus(token);
      if (authData && typeof authData.magicPoints === 'number') {
        setMagicPoints(authData.magicPoints);
        console.log('[MagicPointsContext] Points fetched:', authData.magicPoints);
      } else {
        // If checkAuthStatus doesn't return points, we might need a dedicated endpoint
        // Or, if the points are already synced, this fetch might not be strictly needed
        // unless recovering from an offline state or ensuring consistency.
        console.warn('[MagicPointsContext] checkAuthStatus did not return magicPoints. Using local:', magicPoints);
      }
    } catch (error) {
      console.error('[MagicPointsContext] Failed to fetch points:', error);
    }
  }, [isAuthenticated_MagicPoints, isOnline, isSyncing, magicPoints]);

  const forceSync = useCallback(async (debugContext = "Forced Sync") => {
    if (!isAuthenticated_MagicPoints) {
      console.warn(`[MagicPointsContext] ${debugContext} aborted: Not authenticated.`);
      return;
    }
    if (!isOnline) {
      console.warn(`[MagicPointsContext] ${debugContext} aborted: Offline. Changes will sync when online.`);
      setPendingChanges(true); // Ensure pending changes are marked
      return;
    }
    // Debounce forceSync
    if (Date.now() - lastSyncTimestamp < syncDebounceTimeRef.current && !pendingOperations.length && !pendingChanges) {
        console.log(`[MagicPointsContext] ${debugContext} debounced as last sync was recent and no pending changes.`);
        return;
    }
    console.log(`[MagicPointsContext] ${debugContext} initiated. Current points: ${magicPoints}, Pending Operations: ${pendingOperations.length}`);
    await syncToServer(magicPoints);
  }, [isAuthenticated_MagicPoints, isOnline, magicPoints, syncToServer, pendingOperations, pendingChanges, lastSyncTimestamp]);
  
  const forceSyncWithDebug = useCallback(async () => {
    console.log("[MagicPointsContext - DEBUG] Force sync with debug called.");
    console.log("[MagicPointsContext - DEBUG] Current local points:", magicPoints);
    console.log("[MagicPointsContext - DEBUG] Pending operations:", JSON.stringify(pendingOperations));
    await forceSync("Force Sync (Debug)");
  }, [magicPoints, pendingOperations, forceSync]);

  const resetPoints = useCallback(async (newPoints = DEFAULT_POINTS) => {
    console.log(`[MagicPointsContext] Resetting points to ${newPoints}`);
    setMagicPoints(newPoints);
    // Add this as an operation to be synced
    setPendingOperations(prevOps => [...prevOps, { type: 'reset', amount: newPoints, timestamp: Date.now() }]);
    setPendingChanges(true);
    await forceSync("Reset Points"); // Force a sync after reset
  }, [forceSync]);

  const resetRevelioAttemptsFunction = useCallback((blankIds = []) => {
    console.log('[MagicPointsContext] Resetting Revelio attempts for blanks:', blankIds);
    const newAttempts = {};
    if (blankIds && blankIds.length > 0) {
      blankIds.forEach(id => {
        newAttempts[id] = { firstAttempt: true }; // Ensure structure matches expected usage
      });
    }
    setRevelioAttempts(newAttempts);
    setCorrectBlanks({});
    console.log('[MagicPointsContext] Revelio attempts and correct blanks reset.');
  }, []);
  
  // Add the missing debugPointsState function
  const debugPointsState = useCallback((silent = false) => {
    if (!silent) {
      console.log('[MagicPointsContext] Debug state requested:');
      console.log('  - Magic Points:', magicPoints);
      console.log('  - Online Status:', isOnline);
      console.log('  - Offline Mode:', offlineMode);
      console.log('  - Authenticated:', isAuthenticated_MagicPoints);
      console.log('  - Syncing:', isSyncing);
      console.log('  - Last Synced:', lastSynced);
      console.log('  - Pending Operations:', pendingOperations.length);
      console.log('  - Sync Retries:', syncRetries);
    }
    
    return {
      magicPoints,
      isOnline,
      offlineMode,
      isAuthenticated: isAuthenticated_MagicPoints,
      isSyncing,
      lastSynced,
      pendingOperations,
      syncRetries,
      revelioAttempts,
      correctBlanks
    };
  }, [
    magicPoints,
    isOnline,
    offlineMode,
    isAuthenticated_MagicPoints,
    isSyncing,
    lastSynced,
    pendingOperations,
    syncRetries,
    revelioAttempts,
    correctBlanks
  ]);
  
  // Periodically check for sync needs or when online status changes
  useEffect(() => {
    const check = async () => {
      if (isOnline && isAuthenticated_MagicPoints && !isSyncing) {
        const token = getAuthToken();
        if (token) {
          const needsSync = await apiCheckNeedSync(token);
          if (needsSync || pendingChanges || pendingOperations.length > 0) {
            console.log('[MagicPointsContext] Need sync detected or pending changes exist. Triggering forceSync.');
            forceSync("Periodic/Online Status Sync Check");
          }
        }
      }
    };
    check(); // Initial check
    const intervalId = setInterval(check, 30000); // Check every 30 seconds
    return () => clearInterval(intervalId);
  }, [isOnline, isAuthenticated_MagicPoints, isSyncing, pendingChanges, pendingOperations.length, forceSync]);


  const contextValue = {
    magicPoints,
    setMagicPoints, // Generally prefer specific actions over direct set if logic is involved
    isSyncing,
    // setIsSyncing, // Internal state, not typically exposed
    lastSynced,
    // setLastSynced, // Internal state
    isOnline,
    // setIsOnline, // Internal state, driven by browser events
    pendingChanges,
    // setPendingChanges, // Internal state
    pendingOperations,
    // setPendingOperations, // Internal state
    isAuthenticated_MagicPoints, // Expose for consumers who might need it
    // setIsAuthenticated_MagicPoints, // Internal state
    syncRetries,
    // setSyncRetries, // Internal state
    offlineMode,
    // setOfflineMode, // Internal state
    revelioAttempts,
    setRevelioAttempts, // If direct manipulation is needed by consumers
    correctBlanks,
    setCorrectBlanks,   // If direct manipulation is needed
    fetchCurrentPoints,
    // checkNeedSync, // Internal utility, forceSync is the public action
    syncToServer,    // Might be useful for advanced scenarios, but forceSync is preferred
    forceSync,
    forceSyncWithDebug,
    debugPointsState, // Now exposed properly
    resetPoints,
    resetRevelioAttempts: resetRevelioAttemptsFunction
  };

  return (
    <MagicPointsContext.Provider value={contextValue}>
      {children}
    </MagicPointsContext.Provider>
  );
};
