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
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [housePoints, setHousePoints] = useState({});
  const [activeBackendUrl, setActiveBackendUrl] = useState(BACKEND_URLS[0]);
  const { user, isAuthenticated, setUser } = useAuth();
  
  // Enhanced connection tracking
  const recentNotifications = useRef(new Map());
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 3000;
  const notificationExpiry = 5000;
  const isAdminUser = useRef(false);
  const socketInitializationAttempts = useRef(0);

  // Enhanced notification queue with priority and batching
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const batchTimeoutRef = useRef(null);
  const MAX_BATCH_SIZE = 5;
  const BATCH_TIMEOUT = 100;

  // Find the best backend URL that responds
  const findWorkingBackendUrl = useCallback(async () => {
    console.log('[SOCKET] Trying to find a working backend URL...');
    
    for (const url of BACKEND_URLS) {
      if (!url) continue;
      
      try {
        console.log(`[SOCKET] Testing backend URL: ${url}`);
        
        // Try a simple fetch to see if the server responds at all
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
        
        // Even if not OK but we got a response, the server is at least online
        if (response) {
          console.log(`[SOCKET] Backend URL ${url} is responding with status: ${response.status}`);
          return url;
        }
      } catch (error) {
        console.log(`[SOCKET] Backend URL ${url} failed: ${error.message}`);
      }
      
      // Try alternative health check endpoints
      try {
        // Try root path as fallback
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
    return BACKEND_URLS[0]; // Default to first URL if none respond
  }, []);

  // Initialize socket when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[SOCKET] Not authenticated or no user, skipping socket initialization');
      return;
    }
    
    console.log('[SOCKET] User authenticated, initializing socket');
    const socketInstance = initializeSocket();
    
    // Cleanup function
    return () => {
      if (socketInstance && typeof socketInstance.then === 'function') {
        // Handle Promise return from initializeSocket
        socketInstance.then(socket => {
          if (socket && typeof socket.disconnect === 'function') {
            console.log('[SOCKET] Cleaning up socket connection (from promise)');
            socket.disconnect();
          }
        });
      } else if (socket) {
        // Handle direct socket instance from state
        console.log('[SOCKET] Cleaning up socket connection (from state)');
        socket.disconnect();
      }
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [isAuthenticated, user, initializeSocket, socket]);

  // Initialize socket with the working backend
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
    
    try {
      // Validate user before socket creation
      if (!user || !user.token) {
        console.error('[SOCKET] Cannot initialize socket: missing user or token');
        return null;
      }

      // Create new socket instance with validated auth data
      const newSocket = io(backendUrl, {
        transports: ['polling', 'websocket'], // Start with polling which is more reliable
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectDelay,
        reconnectionDelayMax: 10000,
        timeout: 30000,
        autoConnect: true,
        forceNew: true,
        auth: {
          userId: user.id || '',
          username: user.username || '',
          house: user.house || '',
          token: user.token || ''
        },
        path: '/socket.io/',
        withCredentials: true
      });

      // Debug auth data
      console.log('[SOCKET] Initializing with auth data:', {
        userId: user.id || '[MISSING]',
        username: user.username || '[MISSING]',
        house: user.house || '[MISSING]',
        hasToken: !!user.token
      });
      
      // Set up event handlers
      newSocket.on('connect', () => {
        console.log('[SOCKET] Connected successfully');
        setIsConnected(true);
        setConnectionQuality('good');
        reconnectAttempts.current = 0;
        socketInitializationAttempts.current = 0;
        
        // Authenticate with server - ensure we have auth data
        if (user && user.token) {
          console.log('[SOCKET] Sending authentication data');
          newSocket.emit('authenticate', {
            userId: user.id || '',
            username: user.username || '',
            house: user.house || '',
            token: user.token || ''
          });
          
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
      
      newSocket.on('connect_error', (error) => {
        console.error('[SOCKET] Connection error:', error);
        setIsConnected(false);
        setConnectionQuality('poor');
        
        // Increment reconnect attempts
        reconnectAttempts.current += 1;
        
        // Handle max reconnection attempts reached
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('[SOCKET] Max reconnection attempts reached');
          setConnectionQuality('disconnected');
          
          // Store notifications locally for offline mode
          const storedNotifications = JSON.stringify(notifications);
          localStorage.setItem('pendingNotifications', storedNotifications);
          
          // Try another backend URL as fallback
          if (socketInitializationAttempts.current < BACKEND_URLS.length) {
            const nextUrlIndex = socketInitializationAttempts.current % BACKEND_URLS.length;
            const nextUrl = BACKEND_URLS[nextUrlIndex];
            
            if (nextUrl && nextUrl !== backendUrl) {
              console.log(`[SOCKET] Trying alternative backend URL: ${nextUrl}`);
              setTimeout(() => initializeSocket(nextUrl), 1000);
              return;
            }
          }
          
          // If we've tried all URLs, switch to polling as last resort
          if (newSocket.io.opts.transports[0] === 'websocket') {
            console.log('[SOCKET] Switching to polling transport');
            newSocket.io.opts.transports = ['polling', 'websocket'];
            setTimeout(() => newSocket.connect(), 1000);
          }
        } else {
          // Calculate exponential backoff delay
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 10000);
          console.log(`[SOCKET] Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          // Try alternating transport protocols
          if (reconnectAttempts.current % 2 === 1) {
            if (newSocket.io.opts.transports[0] === 'websocket') {
              console.log('[SOCKET] Switching to polling transport for reconnection');
              newSocket.io.opts.transports = ['polling', 'websocket'];
            } else {
              console.log('[SOCKET] Switching to websocket transport for reconnection');
              newSocket.io.opts.transports = ['websocket', 'polling'];
            }
          }
          
          // Schedule reconnection attempt
          setTimeout(() => {
            if (!newSocket.connected) {
              newSocket.connect();
            }
          }, delay);
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log(`[SOCKET] Disconnected: ${reason}`);
        setIsConnected(false);
        
        // If disconnect was not initiated by client, attempt to reconnect
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect' && 
            reconnectAttempts.current < maxReconnectAttempts) {
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }
          
          reconnectTimeout.current = setTimeout(() => {
            if (!newSocket.connected) {
              console.log('[SOCKET] Attempting to reconnect after disconnect');
              newSocket.connect();
            }
          }, reconnectDelay);
        }
      });
      
      // Error handler for socket events
      newSocket.on('error', (error) => {
        console.error('[SOCKET] Socket error:', error);
        setConnectionQuality('poor');
      });
      
      // Authentication error handler
      newSocket.on('auth_error', (error) => {
        console.error('[SOCKET] Authentication error:', error);
        
        // Check if we should retry authentication
        const errorMessage = error && (error.message || (typeof error === 'string' ? error : ''));
        const shouldRetry = errorMessage && (
          errorMessage.includes('timeout') || 
          errorMessage.includes('Missing') ||
          !errorMessage.includes('Invalid')
        );
        
        if (shouldRetry && reconnectAttempts.current < 3) {
          console.log('[SOCKET] Will retry authentication');
          reconnectAttempts.current += 1;
          
          // Delay to allow state updates
          setTimeout(() => {
            if (user && user.token) {
              console.log('[SOCKET] Resending authentication data');
              newSocket.emit('authenticate', {
                userId: user.id || '',
                username: user.username || '',
                house: user.house || '',
                token: user.token || ''
              });
            }
          }, 1000);
        } else if (error && typeof error === 'object' && error.permanent) {
          // Only clear auth for permanent/invalid token errors
          console.log('[SOCKET] Permanent authentication failure, logging out');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.setItem('isAuthenticated', 'false');
          
          // Use timeout to avoid React state updates during render
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        } else {
          console.log('[SOCKET] Temporary authentication failure');
          // Don't disconnect, socket.io will handle reconnection
        }
      });
      
      // Engine-level error handling
      newSocket.io.engine.on('error', (err) => {
        console.error('[SOCKET] Engine error:', err);
        
        // Handle specific error types
        if (err.message && (err.message.includes('CORS') || err.message.includes('xhr poll error'))) {
          console.log('[SOCKET] Specific transport error detected, trying alternative');
          
          // Switch transports
          newSocket.io.opts.transports = 
            newSocket.io.opts.transports[0] === 'websocket' ? 
            ['polling', 'websocket'] : 
            ['websocket', 'polling'];
          
          // Force reconnect with new transport
          setTimeout(() => {
            if (!newSocket.connected) {
              newSocket.connect();
            }
          }, 1000);
        }
      });
      
      // Enhanced notification handling
      setupNotificationHandlers(newSocket);
      
      // Add additional connection error debugging
      newSocket.io.on('error', error => {
        console.error('[SOCKET] Engine IO error:', error);
      });
      
      newSocket.io.on('close', reason => {
        console.log('[SOCKET] Engine IO closed:', reason);
      });
      
      newSocket.io.on('reconnect_attempt', attempt => {
        console.log(`[SOCKET] Engine IO reconnect attempt ${attempt}`);
      });
      
      // Add transport type monitoring
      if (newSocket.io.engine) {
        newSocket.io.engine.on('upgrade', transport => {
          console.log(`[SOCKET] Transport upgraded to: ${transport}`);
        });
        
        newSocket.io.engine.on('packet', packet => {
          if (packet.type === 'error') {
            console.error('[SOCKET] Transport packet error:', packet.data);
          }
        });
      }
      
      // Set the socket in state
      setSocket(newSocket);
      return newSocket;
    } catch (error) {
      console.error('[SOCKET] Error during socket initialization:', error);
      return null;
    }
  }, [socket, activeBackendUrl, user, notifications, findWorkingBackendUrl]);
  
  // Set up notification handlers
  const setupNotificationHandlers = useCallback((socket) => {
    if (!socket) return;
    
    // House points update handler
    socket.on('house_points_update', (data) => {
      console.log('[SOCKET] Received house points update:', data);
      
      // Create unique key for deduplication
      const notificationKey = `points_update_${data.house}_${data.points}_${Date.now().toString().substring(0, 8)}`;
      
      // Check if this is an assessment notification
      const isAssessment = data.criteria && data.level;
      
      // Create notification object
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
      
      // Add to notifications queue
      addNotification(notification);
      
      // Update local points if needed
      if (typeof data.newTotal === 'number') {
        setHousePoints(prev => ({
          ...prev,
          [data.house]: data.newTotal
        }));
      }
    });
    
    // Sync update handler
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      
      if (data.type === 'force_sync') {
        // Force refresh user data
        fetchUserData();
      } else if (data.type === 'user_update') {
        // Handle user data updates
        if (data.data?.updatedFields) {
          const updates = data.data.updatedFields;
          
          // Update local user state
          if (setUser && typeof setUser === 'function') {
            setUser(prev => ({
              ...prev,
              ...updates
            }));
          }
          
          // Create notification for significant updates
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
    
    // General notification handler
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
    
    // Admin notification handler
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
    
    // Handle batch notifications
    socket.on('notification_batch', (data) => {
      console.log('[SOCKET] Received notification batch:', data);
      if (Array.isArray(data.notifications)) {
        data.notifications.forEach(notif => addNotification(notif));
      }
    });
    
    // Handle connection status updates
    socket.on('connection_status', (data) => {
      console.log('[SOCKET] Connection status update:', data);
      setConnectionQuality(data.connected ? 'good' : 'poor');
    });
  }, []);

  // Fetch user data with active backend URL
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
      
      // Update user data if needed
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
  
  // Check if current user is admin
  useEffect(() => {
    if (user) {
      // Admin can be determined by house, role or username
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
      
      // Try an alternative URL if available
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
    
    // Send heartbeats to the server
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
        setLastHeartbeat(new Date());
      }
    }, 30000); // Send heartbeat every 30 seconds
    
    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [socket, isConnected]);
  
  // Request sync when user's house changes
  useEffect(() => {
    if (socket && isConnected && user?.house) {
      // When house changes, update socket room
      socket.emit('change_house', {
        userId: user.id || user._id,
        oldHouse: user.previousHouse !== user.house ? user.previousHouse : null,
        newHouse: user.house
      });
    }
  }, [socket, isConnected, user?.house]);
  
  // Enhanced notification processing
  const processNotificationQueue = useCallback(() => {
    if (isProcessingQueue || notificationQueue.length === 0) return;
    
    setIsProcessingQueue(true);
    
    try {
      // Sort by priority and timestamp
      const sortedQueue = [...notificationQueue].sort((a, b) => {
        const priorityA = getNotificationPriority(a);
        const priorityB = getNotificationPriority(b);
        if (priorityA !== priorityB) return priorityB - priorityA;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Process batch
      const batch = sortedQueue.slice(0, MAX_BATCH_SIZE);
      const remaining = sortedQueue.slice(MAX_BATCH_SIZE);
      
      // Update notifications with batch
      setNotifications(prev => {
        const newNotifications = [...batch, ...prev];
        return newNotifications.slice(0, 10); // Keep max 10 notifications
      });
      
      // Update queue with remaining items
      setNotificationQueue(remaining);
      
    } catch (error) {
      console.error('[SOCKET] Error processing notification queue:', error);
    } finally {
      setIsProcessingQueue(false);
    }
  }, [isProcessingQueue, notificationQueue]);

  // Helper to determine notification priority
  const getNotificationPriority = (notification) => {
    if (notification.type === 'error') return 4;
    if (notification.type === 'warning') return 3;
    if (notification.type === 'success') return 2;
    if (notification.type === 'announcement') return 1;
    return 0;
  };

  // Enhanced notification adding with deduplication
  const addNotification = useCallback((notification) => {
    if (!notification || !notification.message) {
      console.warn('[SOCKET] Tried to add invalid notification:', notification);
      return;
    }
    
    const notificationKey = `${notification.type}_${notification.id}_${Date.now()}`;
    
    // Check for duplicates
    if (recentNotifications.current.has(notificationKey)) {
      console.log('[SOCKET] Skipping duplicate notification:', notification);
      return;
    }
    
    // Add to recent notifications with expiry
    recentNotifications.current.set(notificationKey, Date.now());
    
    setNotificationQueue(prev => {
      const newQueue = [...prev, notification];
      
      // Clear existing timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      // Set new timeout for batch processing
      batchTimeoutRef.current = setTimeout(() => {
        processNotificationQueue();
      }, BATCH_TIMEOUT);
      
      return newQueue;
    });
  }, [processNotificationQueue]);

  // Helper function to format house points message
  const formatHousePointsMessage = (data, isAssessment) => {
    const pointsChange = Math.abs(data.points);
    const isPositive = data.points > 0;
    let message = '';
    
    if (isAssessment) {
      // Format assessment message
      message = `${pointsChange} points ${isPositive ? 'awarded to' : 'deducted from'} ${data.house} for ${data.criteria} (${data.level})`;
    } else {
      // Format regular points update message
      message = `${pointsChange} points ${isPositive ? 'awarded to' : 'deducted from'} ${data.house}`;
      if (data.reason && data.reason !== 'House points update') {
        message += `. Reason: ${data.reason}`;
      }
    }
    
    // Add new total if available
    if (data.newTotal !== undefined) {
      message += `. New total: ${data.newTotal}`;
    }
    
    return message;
  };

  // Helper function to format user update messages
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

  // Method to send a message to the server
  const sendMessage = useCallback((eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  // Method to request an immediate sync from server
  const requestSync = useCallback(() => {
    if (socket && isConnected) {
      console.log('[SOCKET] Manually requesting data sync');
      socket.emit('request_sync');
      return true;
    }
    
    console.log('[SOCKET] Cannot request sync - not connected');
    return false;
  }, [socket, isConnected]);

  // Method to clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Method to remove a specific notification
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  }, []);

  // Method to force reconnection to a different backend
  const reconnectToAlternativeBackend = useCallback(() => {
    const currentIndex = BACKEND_URLS.indexOf(activeBackendUrl);
    const nextIndex = (currentIndex + 1) % BACKEND_URLS.length;
    const nextUrl = BACKEND_URLS[nextIndex];
    
    console.log(`[SOCKET] Manually switching backend from ${activeBackendUrl} to ${nextUrl}`);
    initializeSocket(nextUrl);
  }, [activeBackendUrl, initializeSocket]);

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