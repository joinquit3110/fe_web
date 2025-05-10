import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const MagicPointsContext = createContext();

export const MagicPointsProvider = ({ children }) => {
  // Safe destructuring with fallbacks to prevent errors
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const isConnected = socketContext?.isConnected || false;
  
  const authContext = useAuth();
  const isAuthenticated = authContext?.isAuthenticated || false;
  const token = authContext?.token;
  
  const [points, setPoints] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Add debug logging for context initialization
  useEffect(() => {
    console.log('MagicPointsContext initialization:', {
      socketAvailable: !!socketContext,
      socketConnected: !!socket && isConnected,
      authAvailable: !!authContext,
      isAuthenticated,
      hasToken: !!token
    });
  }, [socketContext, socket, isConnected, authContext, isAuthenticated, token]);

  // Initialize context and handle potential errors
  useEffect(() => {
    try {
      // Mark initialization successful
      setIsInitialized(true);
      
      // Let other components know we're ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('magicPointsContextReady', {
          detail: { timestamp: new Date().toISOString() }
        }));
      }
    } catch (error) {
      console.error('[MAGIC] Context initialization error:', error);
      
      // Try to recover
      setTimeout(() => {
        console.log('[MAGIC] Attempting context recovery');
        if (!isInitialized) setIsInitialized(true);
      }, 1500);
    }
  }, []);

  // Fetch points from the server
  const fetchPoints = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setLoadingPoints(false);
      return;
    }
    
    try {
      setLoadingPoints(true);
      // Use the consistent backend URL to avoid CORS issues
      const BACKEND_URL = 'https://be-web-6c4k.onrender.com';
      
      // Set a timeout to handle stalled requests
      let timeoutId;
      const controller = new AbortController();
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error('Request timeout'));
        }, 10000); // 10 seconds timeout
      });
      
      // Create the fetch promise with proper error handling
      const fetchPromise = fetch(`${BACKEND_URL}/api/points/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      // Use Promise.race to handle whichever completes first
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      clearTimeout(timeoutId); // Clear timeout if fetch completes first
      
      if (response.ok) {
        const data = await response.json();
        setPoints(data.points || 0);
        setLastUpdate(new Date());
        
        // Dispatch successful fetch event
        window.dispatchEvent(new CustomEvent('pointsFetchSuccess', {
          detail: { points: data.points, timestamp: new Date().toISOString() }
        }));
      } else {
        console.error('[MAGIC] Failed to fetch points:', response.status);
        // Try to get error details
        try {
          const errorData = await response.json();
          console.error('[MAGIC] Error details:', errorData);
        } catch (parseError) {
          console.error('[MAGIC] Could not parse error response');
        }
      }
    } catch (error) {
      console.error('[MAGIC] Error fetching points:', error);
      // If error is a CORS error or network failure, try socket instead
      if (socket && isConnected && (error.name === 'TypeError' || error.name === 'AbortError')) {
        console.log('[MAGIC] Trying socket fallback for points fetch');
        socket.emit('get_points');
      }
    } finally {
      setLoadingPoints(false);
    }
  }, [isAuthenticated, token, socket, isConnected]);

  // Enhanced debug function for points state
  const debugPointsState = useCallback((silent = false) => {
    // Get pending operations from localStorage if they exist
    let pendingOps = [];
    try {
      const storedOps = localStorage.getItem('pendingOperations');
      if (storedOps) {
        pendingOps = JSON.parse(storedOps);
        if (!Array.isArray(pendingOps)) pendingOps = [];
      }
    } catch (e) {
      console.error('[MAGIC] Error parsing pending operations:', e);
      pendingOps = [];
    }

    const debugData = {
      magicPoints: points,
      isOnline: isConnected,
      isOfflineMode: !isConnected,
      isAuthenticated: isAuthenticated,
      lastSynced: lastUpdate ? lastUpdate.toISOString() : null,
      isSyncing: loadingPoints,
      retryAttempts: connectionRetries,
      pendingOperations: pendingOps,
    };
    
    if (!silent) {
      console.log('[MAGIC] Debug points state:', debugData);
    }
    
    return debugData;
  }, [points, isConnected, isAuthenticated, lastUpdate, loadingPoints, connectionRetries]);
  
  // Function to force a sync with the server
  const forceSync = useCallback(() => {
    if (!isAuthenticated) {
      console.log('[MAGIC] Cannot sync - not authenticated');
      return false;
    }
    
    if (socket && isConnected) {
      console.log('[MAGIC] Forcing sync with server via socket');
      socket.emit('request_sync');
      socket.emit('get_points');
      return true;
    } else {
      console.log('[MAGIC] Forcing sync with server via API');
      fetchPoints();
      return true;
    }
  }, [socket, isConnected, isAuthenticated, fetchPoints]);
  
  // Function to dispatch a custom event for points update
  const dispatchPointsUpdate = useCallback((newPoints, source = 'manual') => {
    if (typeof window !== 'undefined') {
      const pointsEvent = new CustomEvent('magicPointsUpdated', {
        detail: {
          points: newPoints,
          source: source,
          timestamp: new Date().toISOString(),
          oldPoints: points
        }
      });
      console.log('[MAGIC] Dispatching points update event:', newPoints);
      window.dispatchEvent(pointsEvent);
    }
  }, [points]);
  
  // When points change, dispatch an update event
  useEffect(() => {
    // Skip initial render with 0 points
    if (lastUpdate) {
      dispatchPointsUpdate(points, 'stateChange');
    }
  }, [points, lastUpdate, dispatchPointsUpdate]);

  // Socket connection and event handling
  useEffect(() => {
    if (!socket) {
      console.log('[MAGIC] No socket available yet');
      return;
    }

    console.log('[MAGIC] Setting up socket listeners for magic points');
    
    // Handle points updates from the server
    const handlePointsUpdate = (data) => {
      console.log('[MAGIC] Received points_update from socket:', data);
      
      if (data && typeof data.points === 'number') {
        setPoints(data.points);
        setLastUpdate(new Date());
        
        // Dispatch event for real-time UI updates
        window.dispatchEvent(new CustomEvent('magicPointsUpdated', {
          detail: {
            points: data.points,
            source: 'socketEvent',
            reason: data.reason || null,
            timestamp: new Date().toISOString()
          }
        }));
      }
    };
    
    // Listen for sync completion events
    const handleSyncComplete = (data) => {
      console.log('[MAGIC] Sync completed:', data);
      
      // Refresh points after sync
      fetchPoints();
      
      // Dispatch event for real-time UI updates
      window.dispatchEvent(new CustomEvent('serverSyncCompleted', {
        detail: {
          timestamp: new Date().toISOString(),
          syncSource: data?.source || 'server'
        }
      }));
    };
    
    // Set up socket event listeners
    socket.on('points_update', handlePointsUpdate);
    socket.on('sync_complete', handleSyncComplete);
    socket.on('user_update', (data) => {
      if (data && data.magicPoints !== undefined) {
        handlePointsUpdate({ points: data.magicPoints, reason: data.reason });
      }
    });
    
    // Request initial points on connection
    if (isConnected && isAuthenticated) {
      console.log('[MAGIC] Requesting initial points data from socket');
      socket.emit('get_points');
    }
    
    // Cleanup listeners on unmount
    return () => {
      socket.off('points_update', handlePointsUpdate);
      socket.off('sync_complete', handleSyncComplete);
      socket.off('user_update');
    };
  }, [socket, isConnected, isAuthenticated, fetchPoints]);

  // Listen for socket events related to points
  useEffect(() => {
    if (socket && isConnected) {
      const handlePointsUpdate = (data) => {
        console.log('Points updated via socket:', data);
        setPoints(data.points || 0);
        setLastUpdate(new Date());
      };
      
      socket.on('points:update', handlePointsUpdate);
      
      // Request an immediate update when socket connects
      socket.emit('points:getBalance');
      
      return () => {
        socket.off('points:update', handlePointsUpdate);
      };
    }
  }, [socket, isConnected]);

  // Initial points fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchPoints();
    } else {
      setPoints(0);
      setLoadingPoints(false);
    }
  }, [isAuthenticated, fetchPoints]);

  // Refetch points when connection status changes
  useEffect(() => {
    if (isConnected && isAuthenticated) {
      fetchPoints();
    }
  }, [isConnected, isAuthenticated, fetchPoints]);

  // If we're authenticated but offline, retry connection and points fetch periodically
  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      const timer = setTimeout(() => {
        fetchPoints();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isConnected, fetchPoints]);

  // Add retry mechanism for loading points
  useEffect(() => {
    // Retry fetch if no points loaded and authentication is ready
    if (points === 0 && isAuthenticated && !loadingPoints) {
      const retryTimer = setTimeout(() => {
        console.log('[MAGIC] Retrying points fetch, attempt:', connectionRetries + 1);
        setConnectionRetries(prev => prev + 1);
        fetchPoints();
      }, 2000 * (connectionRetries + 1)); // Exponential backoff
      
      return () => clearTimeout(retryTimer);
    }
    
    // Reset retry counter when points are loaded
    if (points > 0 && connectionRetries > 0) {
      setConnectionRetries(0);
    }
  }, [points, isAuthenticated, loadingPoints, connectionRetries, fetchPoints]);

  return (
    <MagicPointsContext.Provider
      value={{
        magicPoints: points,
        points,
        isLoading: loadingPoints,
        loadingPoints,
        lastUpdated: lastUpdate,
        lastUpdate,
        isOnline: isConnected,
        isAuthenticated,
        isSyncing: loadingPoints,
        isOfflineMode: !isConnected,
        refreshPoints: fetchPoints,
        debugPointsState,
        forceSync,
        dispatchPointsUpdate,
      }}
    >
      {children}
    </MagicPointsContext.Provider>
  );
};

export const useMagicPoints = () => useContext(MagicPointsContext);
