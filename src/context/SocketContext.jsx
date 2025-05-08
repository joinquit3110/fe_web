import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// Backend URL for socket connection
const SOCKET_URL = process.env.REACT_APP_API_URL || "https://be-web-6c4k.onrender.com";

// Create context
const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('good'); // 'good', 'poor', 'disconnected'
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [housePoints, setHousePoints] = useState({}); // Add housePoints state
  const { user, isAuthenticated, setUser } = useAuth();
  
  // Enhanced notification tracking
  const recentNotifications = useRef(new Map()); // Changed to Map for better tracking
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null); // Add reconnectTimeout ref
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000;
  const notificationExpiry = 5000; // 5 seconds expiry for deduplication

  // Add admin checking functionality
  const isAdminUser = useRef(false);

  // Enhanced notification queue with priority and batching
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const batchTimeoutRef = useRef(null);
  const MAX_BATCH_SIZE = 5;
  const BATCH_TIMEOUT = 100;

  // Add fetchUserData function
  const fetchUserData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      
      const userData = await response.json();
      // Update user data in context or state as needed
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, [user?.id]);

  // Check if current user is admin when user changes
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
    }, 1000); // Check every second
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Initialize socket connection with enhanced error handling
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const initializeSocket = () => {
      if (socket) {
        console.log('[SOCKET] Socket already exists, cleaning up...');
        socket.disconnect();
      }

      console.log('[SOCKET] Initializing new socket connection...');
      
      // Create socket with improved options and fallback
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectDelay,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
        auth: {
          userId: user?.id,
          username: user?.username,
          house: user?.house,
          token: user?.token
        }
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('[SOCKET] Connected successfully');
        setIsConnected(true);
        setConnectionQuality('good');
        reconnectAttempts.current = 0;
        
        // Authenticate with server
        newSocket.emit('authenticate', {
          userId: user?.id,
          username: user?.username,
          house: user?.house,
          token: user?.token
        });
        
        // Request initial sync after connection
        newSocket.emit('request_sync');
        
        // Clear any pending notifications
        setNotificationQueue([]);
      });

      newSocket.on('connect_error', (error) => {
        console.error('[SOCKET] Connection error:', error);
        setIsConnected(false);
        setConnectionQuality('poor');
        
        // Increment reconnect attempts
        reconnectAttempts.current += 1;
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('[SOCKET] Max reconnection attempts reached');
          setConnectionQuality('disconnected');
          
          // Store notifications locally
          const storedNotifications = JSON.stringify(notifications);
          localStorage.setItem('pendingNotifications', storedNotifications);
          
          // Try polling as fallback
          if (newSocket.io.opts.transports[0] === 'websocket') {
            console.log('[SOCKET] Falling back to polling transport');
            newSocket.io.opts.transports = ['polling', 'websocket'];
            newSocket.connect();
          }
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[SOCKET] Disconnected:', reason);
        setIsConnected(false);
        
        // If disconnect was not initiated by client, attempt to reconnect
        if (reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }
          
          reconnectTimeout.current = setTimeout(() => {
            if (!socket?.connected) {
              console.log('[SOCKET] Attempting to reconnect...');
              newSocket.connect();
            }
          }, reconnectDelay);
        }
      });

      // Add error handler for socket events
      newSocket.on('error', (error) => {
        console.error('[SOCKET] Socket error:', error);
        setConnectionQuality('poor');
      });

      // Add authentication error handler
      newSocket.on('auth_error', (error) => {
        console.error('[SOCKET] Authentication error:', error);
        // Clear auth state and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.setItem('isAuthenticated', 'false');
        window.location.href = '/login';
      });

      // Enhanced notification handling
      newSocket.on('house_points_update', (data) => {
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
        if (typeof data.newTotal === 'number' && setHousePoints) {
          setHousePoints(prev => ({
            ...prev,
            [data.house]: data.newTotal
          }));
        }
      });

      // Enhanced sync update handling
      newSocket.on('sync_update', (data) => {
        console.log('[SOCKET] Received sync update:', data);
        
        if (data.type === 'force_sync') {
          // Force refresh user data
          if (typeof fetchUserData === 'function') {
            fetchUserData();
          }
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
            if (updates.house || updates.magicPoints) {
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

      setSocket(newSocket);
      return newSocket;
    };

    const cleanup = initializeSocket();
    return () => {
      if (cleanup) {
        cleanup.disconnect();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [isAuthenticated, user]);

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
    };

    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_error', handleReconnectError);
    socket.on('reconnect_failed', handleReconnectFailed);

    return () => {
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('reconnect_failed', handleReconnectFailed);
    };
  }, [socket]);
  
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
    const notificationKey = `${notification.type}_${notification.id}_${Date.now()}`;
    
    // Check for duplicates
    if (recentNotifications.current.has(notificationKey)) {
      console.log('[SOCKET] Skipping duplicate notification:', notification);
      return;
    }
    
    // Add to recent notifications with expiry
    recentNotifications.current.set(notificationKey, Date.now());
    setTimeout(() => {
      recentNotifications.current.delete(notificationKey);
    }, notificationExpiry);
    
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
        removeNotification
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};