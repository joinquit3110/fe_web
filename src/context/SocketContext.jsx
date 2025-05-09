import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Backend URL for socket connection
const SOCKET_URL = "https://inequality-web-api.onrender.com";

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
  const { user, isAuthenticated, setUser } = useAuth();
  
  // Track recent notification keys to prevent duplicates
  const recentNotifications = useRef(new Set());

  // Add admin checking functionality
  const isAdminUser = useRef(false);

  // Add new notification queue with priority
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const batchTimeoutRef = useRef(null);
  const MAX_BATCH_SIZE = 5;
  const BATCH_TIMEOUT = 100; // ms

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
      recentNotifications.current = new Set();
    }, 60000); // Clear every minute
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Initialize socket on authentication state change
  useEffect(() => {
    // Only initialize socket if user is authenticated
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setConnectionQuality('disconnected');
      }
      return;
    }
    
    console.log('[SOCKET] Initializing socket connection');
    
    // Create new socket instance with optimized connection settings
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,         // Reduced from 1000ms
      reconnectionDelayMax: 3000,     // Reduced from 5000ms
      timeout: 5000                   // Reduced from 10000ms
    });
    
    // Set up event handlers
    socketInstance.on('connect', () => {
      console.log('[SOCKET] Connected to server');
      setIsConnected(true);
      setConnectionQuality('good');
      
      // Authenticate with user ID and house
      if (user) {
        socketInstance.emit('authenticate', {
          userId: user.id || user._id,
          username: user.username,
          house: user.house
        });
        console.log(`[SOCKET] Authenticated as ${user.username}, house: ${user.house || 'unassigned'}`);
      }
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error);
      setIsConnected(false);
      setConnectionQuality('disconnected');
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      setIsConnected(false);
      setConnectionQuality('disconnected');
    });
    
    socketInstance.on('reconnect', (attempt) => {
      console.log(`[SOCKET] Reconnected after ${attempt} attempts`);
      setIsConnected(true);
      setConnectionQuality('good');
      
      // Re-authenticate on reconnect
      if (user) {
        socketInstance.emit('authenticate', {
          userId: user.id || user._id,
          username: user.username,
          house: user.house
        });
      }
      
      // Request a sync after reconnection
      setTimeout(() => {
        if (socketInstance.connected) {
          console.log('[SOCKET] Requesting sync after reconnection');
          socketInstance.emit('request_sync');
        }
      }, 1000);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('[SOCKET] Reconnection error:', error);
      setConnectionQuality('poor');
    });

    socketInstance.on('reconnect_failed', () => {
      console.log('[SOCKET] Failed to reconnect');
      setIsConnected(false);
      setConnectionQuality('disconnected');
    });
    
    // Handle connection status updates
    socketInstance.on('connection_status', (data) => {
      console.log('[SOCKET] Connection status update:', data);
      if (data.connected) {
        setIsConnected(true);
        setConnectionQuality('good');
      }
    });

    // Set the socket instance
    setSocket(socketInstance);
    
    // Make socket globally accessible for direct component use
    if (typeof window !== 'undefined') {
      window.socket = socketInstance;
    }

    // Cleanup on unmount
    return () => {
      console.log('[SOCKET] Cleaning up socket connection');
      if (socketInstance) {
        socketInstance.disconnect();
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, user]);
  
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

  // Optimize notification processing
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

  // Optimize notification adding with batching
  const addNotification = useCallback((notification) => {
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

  // Enhanced socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleSyncUpdate = (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      
      if (data.type === 'user_update' && data.data?.updatedFields) {
        handleUserUpdate(data.data.updatedFields);
      }
      
      // Convert sync_update with points change messages to notifications
      if (data.type === 'user_update' && data.message && data.message.includes('magic points')) {
        console.log('[SOCKET] Converting point update to notification:', data);
        
        // Parse points value from message
        const pointsMatch = data.message.match(/updated to (\d+)/);
        if (pointsMatch && pointsMatch[1] && user) {
          const newPoints = parseInt(pointsMatch[1], 10);
          const oldPoints = user.magicPoints || 0;
          const pointsDiff = newPoints - oldPoints;
          
          if (pointsDiff !== 0) {
            // Extract potential reason from data
            const reason = data.reason || data.data?.reason || data.data?.lastUpdateReason || null;
            
            // Extract criteria/level if available
            const criteria = data.criteria || data.data?.criteria || null;
            const level = data.level || data.data?.level || null;
            
            // Create notification for points change
            const notification = {
              id: `points_update_${Date.now()}`,
              type: pointsDiff > 0 ? 'success' : 'warning',
              title: pointsDiff > 0 ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
              message: `Your magic points have ${pointsDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(pointsDiff)}`,
              timestamp: new Date(),
              pointsChange: pointsDiff,
              reason: reason || 'System update',
              criteria: criteria,
              level: level,
              house: user.house
            };
            
            addNotification(notification);
          }
        }
      }
    };

    const handleHousePointsUpdate = (data) => {
      console.log('[SOCKET] Received house_points_update:', data);
      if (isAdminUser.current || user?.house === 'muggle' || !user?.house) return;
      
      if (data.house === user?.house) {
        // Log detailed data to verify criteria and level
        console.log('[SOCKET] Creating notification with data:', {
          house: data.house,
          points: data.points,
          reason: data.reason || null,
          criteria: data.criteria || null,
          level: data.level || null,
          timestamp: data.timestamp || Date.now()
        });
        
        const notification = createHousePointsNotification(data);
        addNotification(notification);
      }
    };

    const handleAdminNotification = (data) => {
      console.log('Admin notification received:', data);
      // Ensure all relevant fields from the backend are used
      const notification = {
        id: data.id || uuidv4(), // Use backend ID or generate one
        type: 'admin',
        title: data.title || 'Admin Notification', // Use backend title
        message: data.message,
        reason: data.reason, // Add reason
        criteria: data.criteria, // Add criteria
        level: data.level, // Add level
        timestamp: data.timestamp || new Date().toISOString(),
        pointsChange: data.pointsChange, // Include if admin notifications can change points
        variant: data.variant || 'info', // Default to info, or use backend-provided variant
      };
      addNotification(notification);
    };

    const handleGlobalAnnouncement = (data) => {
      console.log('[SOCKET] Received global announcement:', data);
      const notification = {
        id: data.id || `announcement_${Date.now()}`,
        type: 'announcement',
        title: data.title || 'Global Announcement',
        message: data.message,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
      };
      
      addNotification(notification);
    };

    socket.on('sync_update', handleSyncUpdate);
    socket.on('house_points_update', handleHousePointsUpdate);
    socket.on('admin_notification', handleAdminNotification);
    socket.on('global_announcement', handleGlobalAnnouncement);

    return () => {
      socket.off('sync_update', handleSyncUpdate);
      socket.off('house_points_update', handleHousePointsUpdate);
      socket.off('admin_notification', handleAdminNotification);
      socket.off('global_announcement', handleGlobalAnnouncement);
    };
  }, [socket, user, isAdminUser, addNotification]);

  const handleUserUpdate = (updatedFields) => {
    console.log('[SOCKET] Handling user update:', updatedFields);
    setUser(prevUser => ({
      ...prevUser,
      ...updatedFields
    }));
  };

  const createHousePointsNotification = (data) => {
    return {
      id: `house_points_${Date.now()}`,
      type: data.points > 0 ? 'success' : 'warning',
      title: data.points > 0 ? 'HOUSE POINTS AWARDED!' : 'HOUSE POINTS DEDUCTED!',
      message: `Your house ${data.house} has ${data.points > 0 ? 'gained' : 'lost'} ${Math.abs(data.points)} points`,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      reason: data.reason || 'System update',
      criteria: data.criteria || null,
      level: data.level || null,
      house: data.house
    };
  };

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      lastMessage,
      notifications,
      connectionQuality,
      addNotification
    }}>
      {children}
    </SocketContext.Provider>
  );
};