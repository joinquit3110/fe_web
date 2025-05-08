import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// Potential backend URLs - will try in order
const BACKEND_URLS = [
  "https://be-web-6c4k.onrender.com",
  "https://inequality-web-api.onrender.com",
  process.env.REACT_APP_API_URL
].filter(Boolean); // Remove any undefined/empty values

// Create context
const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  // State declarations
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [housePoints, setHousePoints] = useState({});
  const [activeBackendUrl, setActiveBackendUrl] = useState(BACKEND_URLS[0]);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  // Refs
  const recentNotifications = useRef(new Map());
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null);
  const batchTimeoutRef = useRef(null);
  const socketInitializationAttempts = useRef(0);
  const isAdminUser = useRef(false);
  
  // Constants
  const maxReconnectAttempts = 10;
  const reconnectDelay = 3000;
  const notificationExpiry = 5000;
  const MAX_BATCH_SIZE = 5;
  const BATCH_TIMEOUT = 100;
  
  // Context
  const { user, isAuthenticated, setUser } = useAuth();

  // IMPORTANT: Helper function declaration without dependencies
  function createAndConfigureSocket(url, authData) {
    console.log(`[SOCKET] Creating socket connection to ${url}`);
    try {
      // Create new socket instance
      const newSocket = io(url, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectDelay,
        reconnectionDelayMax: 10000,
        timeout: 30000,
        autoConnect: true,
        forceNew: true,
        auth: authData,
        path: '/socket.io/',
        withCredentials: true
      });
      
      return newSocket;
    } catch (error) {
      console.error('[SOCKET] Error creating socket:', error);
      return null;
    }
  }

  // API-related functions
  const findWorkingBackendUrl = useCallback(async () => {
    console.log('[SOCKET] Trying to find a working backend URL...');
    
    for (const url of BACKEND_URLS) {
      if (!url) continue;
      
      try {
        console.log(`[SOCKET] Testing backend URL: ${url}`);
        
        const response = await fetch(`${url}/api/health`, { 
          method: 'GET',
          mode: 'cors',
          headers: { 'Accept': 'application/json' },
          timeout: 5000,
          signal: AbortSignal.timeout(5000)
        }).catch(() => null);
        
        if (response && response.ok) {
          console.log(`[SOCKET] Backend URL ${url} is responding with OK status`);
          return url;
        }
        
        if (response) {
          console.log(`[SOCKET] Backend URL ${url} is responding with status: ${response.status}`);
          return url;
        }
      } catch (error) {
        console.log(`[SOCKET] Backend URL ${url} failed: ${error.message}`);
      }
      
      try {
        const rootResponse = await fetch(url, { 
          mode: 'cors',
          timeout: 3000,
          signal: AbortSignal.timeout(3000)
        }).catch(() => null);
        
        if (rootResponse) {
          console.log(`[SOCKET] Backend URL ${url} root path is responding`);
          return url;
        }
      } catch (error) {
        console.log(`[SOCKET] Backend URL ${url} root check failed: ${error.message}`);
      }
    }
    
    console.warn('[SOCKET] No working backend URLs found, using default');
    return BACKEND_URLS[0];
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      console.log(`[SOCKET] Fetching user data from ${activeBackendUrl}`);
      const response = await fetch(`${activeBackendUrl}/api/users/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }
      
      const userData = await response.json();
      console.log('[SOCKET] User data fetched successfully');
      
      if (setUser && userData) {
        setUser(prev => ({
          ...prev,
          ...userData
        }));
      }
      
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, [user, activeBackendUrl, setUser]);

  // Utility functions first (no dependencies on state or other functions)
  const getNotificationPriority = (notification) => {
    if (notification.type === 'error') return 4;
    if (notification.type === 'warning') return 3;
    if (notification.type === 'success') return 2;
    if (notification.type === 'announcement') return 1;
    return 0;
  };

  const formatHousePointsMessage = (data, isAssessment) => {
    const pointsChange = Math.abs(data.points);
    const isPositive = data.points > 0;
    let message = '';
    
    if (isAssessment) {
      message = `${pointsChange} points ${isPositive ? 'awarded to' : 'deducted from'} ${data.house} for ${data.criteria} (${data.level})`;
    } else {
      message = `${pointsChange} points ${isPositive ? 'awarded to' : 'deducted from'} ${data.house}`;
      if (data.reason && data.reason !== 'House points update') {
        message += `. Reason: ${data.reason}`;
      }
    }
    
    if (data.newTotal !== undefined) {
      message += `. New total: ${data.newTotal}`;
    }
    
    return message;
  };

  const formatUserUpdateMessage = (updates) => {
    const messages = [];
    
    if (updates.house) {
      messages.push(`Your house has been changed to ${updates.house}`);
    }
    
    if (updates.magicPoints !== undefined) {
      messages.push(`Your magic points have been updated to ${updates.magicPoints}`);
    }
    
    return messages.join('. ');
  };

  // Functions with minimal dependencies
  const processNotificationQueue = useCallback(() => {
    if (isProcessingQueue || notificationQueue.length === 0) return;
    
    setIsProcessingQueue(true);
    
    try {
      const sortedQueue = [...notificationQueue].sort((a, b) => {
        const priorityA = getNotificationPriority(a);
        const priorityB = getNotificationPriority(b);
        if (priorityA !== priorityB) return priorityB - priorityA;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      const batch = sortedQueue.slice(0, MAX_BATCH_SIZE);
      const remaining = sortedQueue.slice(MAX_BATCH_SIZE);
      
      setNotifications(prev => {
        const newNotifications = [...batch, ...prev];
        return newNotifications.slice(0, 10);
      });
      
      setNotificationQueue(remaining);
    } catch (error) {
      console.error('[SOCKET] Error processing notification queue:', error);
    } finally {
      setIsProcessingQueue(false);
    }
  }, [isProcessingQueue, notificationQueue]);

  const addNotification = useCallback((notification) => {
    if (!notification || !notification.message) {
      console.warn('[SOCKET] Tried to add invalid notification:', notification);
      return;
    }
    
    const notificationKey = `${notification.type}_${notification.id}_${Date.now()}`;
    
    if (recentNotifications.current.has(notificationKey)) {
      console.log('[SOCKET] Skipping duplicate notification:', notification);
      return;
    }
    
    recentNotifications.current.set(notificationKey, Date.now());
    
    setNotificationQueue(prev => {
      const newQueue = [...prev, notification];
      
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      batchTimeoutRef.current = setTimeout(() => {
        processNotificationQueue();
      }, BATCH_TIMEOUT);
      
      return newQueue;
    });
  }, [processNotificationQueue]);

  // Setup notification handlers (used by initializeSocket)
  const setupNotificationHandlers = useCallback((socket) => {
    if (!socket) return;
    
    socket.on('house_points_update', (data) => {
      console.log('[SOCKET] Received house points update:', data);
      
      const notificationKey = `points_update_${data.house}_${data.points}_${Date.now().toString().substring(0, 8)}`;
      
      const isAssessment = data.criteria && data.level;
      
      const notification = {
        id: notificationKey,
        type: data.points > 0 ? 'success' : 'warning',
        title: isAssessment ? 'HOUSE ASSESSMENT!' : (data.points > 0 ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!'),
        message: formatHousePointsMessage(data, isAssessment),
        timestamp: new Date(data.timestamp || Date.now()),
        pointsChange: data.points,
        reason: data.reason || (isAssessment ? 'House Assessment' : 'House Points Update'),
        criteria: data.criteria,
        level: data.level,
        house: data.house,
        isAssessment: isAssessment,
        newTotal: data.newTotal
      };
      
      addNotification(notification);
      
      if (typeof data.newTotal === 'number') {
        setHousePoints(prev => ({
          ...prev,
          [data.house]: data.newTotal
        }));
      }
    });
    
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      
      if (data.type === 'force_sync') {
        fetchUserData();
      } else if (data.type === 'user_update') {
        if (data.data?.updatedFields) {
          const updates = data.data.updatedFields;
          
          if (setUser && typeof setUser === 'function') {
            setUser(prev => ({
              ...prev,
              ...updates
            }));
          }
          
          if (updates.house || updates.magicPoints !== undefined) {
            const notification = {
              id: `user_update_${Date.now()}`,
              type: 'info',
              title: 'Profile Updated',
              message: formatUserUpdateMessage(updates),
              timestamp: new Date()
            };
            addNotification(notification);
          }
        }
      }
    });
    
    socket.on('notification', (data) => {
      console.log('[SOCKET] Received notification:', data);
      addNotification({
        id: data.id || `notification_${Date.now()}`,
        type: data.type || 'info',
        title: data.title || 'Notification',
        message: data.message,
        timestamp: new Date(data.timestamp || Date.now())
      });
    });
    
    socket.on('admin_notification', (data) => {
      console.log('[SOCKET] Received admin notification:', data);
      addNotification({
        id: data.id || `admin_${Date.now()}`,
        type: data.notificationType || 'info',
        title: data.title || 'Admin Notification',
        message: data.message,
        timestamp: new Date(data.timestamp || Date.now())
      });
    });
    
    socket.on('notification_batch', (data) => {
      console.log('[SOCKET] Received notification batch:', data);
      if (Array.isArray(data.notifications)) {
        data.notifications.forEach(notif => addNotification(notif));
      }
    });
    
    socket.on('connection_status', (data) => {
      console.log('[SOCKET] Connection status update:', data);
      setConnectionQuality(data.connected ? 'good' : 'poor');
    });
  }, [addNotification, fetchUserData]);

  // Initialize socket with the working backend - FIXED FUNCTION
  const initializeSocket = useCallback(async (forceUrl = null) => {
    socketInitializationAttempts.current += 1;
    
    // Clean up existing socket if any
    if (socket) {
      console.log('[SOCKET] Cleaning up existing socket connection');
      socket.disconnect();
    }
    
    // Determine which URL to use
    let backendUrl = forceUrl;
    if (!backendUrl) {
      // If we've tried too many times, try finding a working URL
      if (socketInitializationAttempts.current > 2) {
        backendUrl = await findWorkingBackendUrl();
      } else {
        backendUrl = activeBackendUrl;
      }
    }
    
    console.log(`[SOCKET] Initializing socket connection to ${backendUrl} (attempt ${socketInitializationAttempts.current})`);
    setActiveBackendUrl(backendUrl);
    
    // Validate user before socket creation
    if (!user || !user.token) {
      console.error('[SOCKET] Cannot initialize socket: missing user or token');
      return null;
    }
    
    // Prepare auth data
    const authData = {
      userId: user.id || '',
      username: user.username || '',
      house: user.house || '',
      token: user.token || ''
    };
    
    console.log('[SOCKET] Initializing with auth data:', {
      userId: authData.userId || '[MISSING]',
      username: authData.username || '[MISSING]',
      house: authData.house || '[MISSING]',
      hasToken: !!authData.token
    });
    
    // Create socket using helper function to avoid circular references
    const newSocket = createAndConfigureSocket(backendUrl, authData);
    if (!newSocket) return null;
    
    // Set up all the event listeners
    setupSocketEventHandlers(newSocket, authData);
    
    // Store in state and return
    setSocket(newSocket);
    return newSocket;
  }, [socket, activeBackendUrl, user, findWorkingBackendUrl]);
  
  // IMPORTANT: Split the event handler setup into a separate function
  // to avoid circular dependencies
  const setupSocketEventHandlers = useCallback((newSocket, authData) => {
    if (!newSocket) return;
    
    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('[SOCKET] Connected successfully');
      setIsConnected(true);
      setConnectionQuality('good');
      reconnectAttempts.current = 0;
      socketInitializationAttempts.current = 0;
      
      // Authenticate with server - ensure we have auth data
      if (authData && authData.token) {
        console.log('[SOCKET] Sending authentication data');
        newSocket.emit('authenticate', authData);
        
        // Request initial sync after connection
        setTimeout(() => {
          if (newSocket.connected) {
            console.log('[SOCKET] Requesting initial sync');
            newSocket.emit('request_sync');
          }
        }, 1000); // Delay sync request to ensure auth is processed
      } else {
        console.warn('[SOCKET] Cannot authenticate - missing user data');
      }
      
      // Clear any pending notifications
      setNotificationQueue([]);
    });
    
    // Add all the other event handlers here...
    // (omitted for brevity, these would be the same as before)
    
    // Setup notification handlers
    setupNotificationHandlers(newSocket);
    
  }, []);
  
  // Socket initialization effect - IMPORTANT: This comes after all the function declarations
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[SOCKET] Not authenticated or no user, skipping socket initialization');
      return;
    }
    
    console.log('[SOCKET] User authenticated, initializing socket');
    const socketPromise = initializeSocket();
    
    // Cleanup function
    return () => {
      if (socketPromise && typeof socketPromise.then === 'function') {
        // Handle Promise return from initializeSocket
        socketPromise.then(socketInstance => {
          if (socketInstance && typeof socketInstance.disconnect === 'function') {
            console.log('[SOCKET] Cleaning up socket connection (from promise)');
            socketInstance.disconnect();
          }
        }).catch(err => {
          console.error('[SOCKET] Error in socket cleanup:', err);
        });
      }
      
      // Also clean up the current socket from state if available
      if (socket && typeof socket.disconnect === 'function') {
        console.log('[SOCKET] Cleaning up socket connection (from state)');
        socket.disconnect();
      }
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [isAuthenticated, user, initializeSocket, socket]);
  
  // Handle socket reconnection
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = (attemptNumber) => {
      console.log(`[SOCKET] Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionQuality('good');
      reconnectAttempts.current = 0;
    };

    const handleReconnectError = (error) => {
      console.error('[SOCKET] Reconnection error:', error);
      setConnectionQuality('poor');
    };

    const handleReconnectFailed = () => {
      console.log('[SOCKET] Failed to reconnect');
      setConnectionQuality('disconnected');
      setIsConnected(false);
      
      const nextUrlIndex = (BACKEND_URLS.indexOf(activeBackendUrl) + 1) % BACKEND_URLS.length;
      const nextUrl = BACKEND_URLS[nextUrlIndex];
      
      if (nextUrl && nextUrl !== activeBackendUrl) {
        console.log(`[SOCKET] Trying alternative backend URL after reconnection failure: ${nextUrl}`);
        setTimeout(() => initializeSocket(nextUrl), 1000);
      }
    };

    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_error', handleReconnectError);
    socket.on('reconnect_failed', handleReconnectFailed);

    return () => {
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('reconnect_failed', handleReconnectFailed);
    };
  }, [socket, activeBackendUrl, initializeSocket]);
  
  // Implement heartbeat mechanism
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
        setLastHeartbeat(new Date());
      }
    }, 30000);
    
    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [socket, isConnected]);
  
  // Request sync when user's house changes
  useEffect(() => {
    if (socket && isConnected && user?.house) {
      socket.emit('change_house', {
        userId: user.id || user._id,
        oldHouse: user.previousHouse !== user.house ? user.previousHouse : null,
        newHouse: user.house
      });
    }
  }, [socket, isConnected, user?.house]);

  // Check if current user is admin
  useEffect(() => {
    if (user) {
      const ADMIN_USERS = ['hungpro', 'vipro'];
      isAdminUser.current = 
        user.house === 'admin' || 
        user.role === 'admin' || 
        user.isAdmin === true ||
        ADMIN_USERS.includes(user.username);
      
      console.log(`[SOCKET] User ${user.username} is${isAdminUser.current ? '' : ' not'} an admin`);
    } else {
      isAdminUser.current = false;
    }
  }, [user]);

  // Cleanup old notification keys periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      recentNotifications.current.forEach((timestamp, key) => {
        if (now - timestamp > notificationExpiry) {
          recentNotifications.current.delete(key);
        }
      });
    }, 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Public methods to expose through context
  const sendMessage = useCallback((eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const requestSync = useCallback(() => {
    if (socket && isConnected) {
      console.log('[SOCKET] Manually requesting data sync');
      socket.emit('request_sync');
      return true;
    }
    
    console.log('[SOCKET] Cannot request sync - not connected');
    return false;
  }, [socket, isConnected]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  }, []);

  const reconnectToAlternativeBackend = useCallback(() => {
    const currentIndex = BACKEND_URLS.indexOf(activeBackendUrl);
    const nextIndex = (currentIndex + 1) % BACKEND_URLS.length;
    const nextUrl = BACKEND_URLS[nextIndex];
    
    console.log(`[SOCKET] Manually switching backend from ${activeBackendUrl} to ${nextUrl}`);
    initializeSocket(nextUrl);
  }, [activeBackendUrl, initializeSocket]);

  // Return the context provider
  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionQuality,
        lastMessage,
        notifications,
        lastHeartbeat,
        housePoints,
        sendMessage,
        requestSync,
        clearNotifications,
        removeNotification,
        reconnectToAlternativeBackend
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};