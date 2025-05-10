import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// Backend URL for socket connection
const SOCKET_URL = "https://be-web-6c4k.onrender.com";

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
  
  // Add admin checking functionality
  const isAdminUser = useRef(false);
  
  // Track recent notification keys to prevent duplicates
  const recentNotifications = useRef(new Set());

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
      timeout: 5000,                  // Reduced from 10000ms
      forceNew: true                  // Force a new connection to avoid sharing
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
  // Add notification queue state
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const batchTimeoutRef = useRef(null);
  const MAX_BATCH_SIZE = 5;
  const BATCH_TIMEOUT = 100; // ms
  
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

    const handleHousePointsUpdate = (data) => {
      console.log('[SOCKET] Received house_points_update:', data);
      const notification = {
        id: `hp-${new Date().getTime()}-${Math.random().toString(36).substr(2, 9)}`,
        type: data.points_change > 0 ? 'success' : 'warning',
        title: `${data.house} Points Update`,
        message: `${Math.abs(data.points_change)} points ${data.points_change > 0 ? 'awarded to' : 'deducted from'} ${data.house}${data.reason ? ': ' + data.reason : ''}`,
        pointsChange: data.points_change, // Actual delta
        reason: data.reason, // Admin's custom reason
        isHousePointsUpdate: true,
        isPersonalPointsUpdate: false,
        isHouseAssessmentUpdate: false, // Ensure this flag is present
        house: data.house, // For theming
        timestamp: new Date().toISOString(),
        duration: data.duration || 7000 // Use provided duration or default to 7 seconds
      };
      addNotification(notification);
    };

    const handleNewNotification = (data) => {
      console.log('[SOCKET] Received generic notification:', data);
      const notification = {
        id: data.id || `gen-${new Date().getTime()}-${Math.random().toString(36).substr(2, 9)}`,
        type: data.type || 'info',
        title: data.title || 'Notification',
        message: data.message,
        pointsChange: data.pointsChange, // Optional: if generic notifications can have points
        reason: data.reason,
        isHousePointsUpdate: data.isHousePointsUpdate || false,
        isPersonalPointsUpdate: data.isPersonalPointsUpdate || false,
        isHouseAssessmentUpdate: false, // Ensure this flag is present
        house: data.house,
        timestamp: new Date().toISOString(),
        duration: data.duration || 5000
      };
      addNotification(notification);
    };

    const handleMagicPointsUpdated = (data) => {
      console.log('[SOCKET] Received magic_points_updated:', data);
      if (data.change && data.userId === user?.id) {
        const notification = {
          id: `mp-${new Date().getTime()}-${data.userId}`,
          type: data.change > 0 ? 'success' : 'warning',
          title: 'Magic Points Update',
          message: `Your magic points changed by ${data.change}. New balance: ${data.magicPoints}.`,
          pointsChange: data.change,
          reason: data.reason || (data.change > 0 ? 'Points earned' : 'Points spent'),
          isHousePointsUpdate: false,
          isPersonalPointsUpdate: true,
          isHouseAssessmentUpdate: false, // Ensure this flag is present
          timestamp: new Date().toISOString(),
          duration: 6000 // 6 seconds for personal magic point updates
        };
        addNotification(notification);
      }
    };

    const handleSyncUpdate = (data) => {
      console.log('[SOCKET] Received sync_update:', data);
      if (data.user && data.user.id === user?.id && data.user.magic_points_change && data.user.magic_points_change !== 0) {
        const change = data.user.magic_points_change;
        const notification = {
          id: `sync-mp-${new Date().getTime()}-${user.id}`,
          type: change > 0 ? 'success' : 'warning',
          title: 'Account Synced',
          message: `Your magic points were updated by ${change} during sync. New balance: ${data.user.magic_points}.`,
          pointsChange: change,
          reason: data.user.last_reason || (change > 0 ? 'Sync credit' : 'Sync adjustment'),
          isHousePointsUpdate: false,
          isPersonalPointsUpdate: true,
          isHouseAssessmentUpdate: false, // Ensure this flag is present
          timestamp: new Date().toISOString(),
          duration: 6000 // 6 seconds for sync-related personal point updates
        };
        addNotification(notification);
      }
    };

    const handleHouseAssessmentUpdate = (data) => {
      console.log('[SOCKET] Received house_assessment_update:', data);
      const notification = {
        id: `ha-${new Date().getTime()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'info', // Or determine based on points_change if appropriate
        title: `House Assessment: ${data.criteria || 'Update'}`,
        message: `House ${data.house} assessment: ${data.criteria || 'Details not specified'}. Level: ${data.level || 'N/A'}. Points: ${data.points_change}. ${data.reason ? 'Reason: ' + data.reason : ''}`,
        pointsChange: data.points_change,
        reason: data.reason,
        criteria: data.criteria,
        level: data.level,
        isHousePointsUpdate: false, // Explicitly false
        isPersonalPointsUpdate: false, // Explicitly false
        isHouseAssessmentUpdate: true, // Mark as house assessment
        house: data.house,
        timestamp: new Date().toISOString(),
        duration: data.duration || 10000 // Default 10 seconds for assessments
      };
      addNotification(notification);
    };

    socket.off('house_points_update');
    socket.off('notification');
    socket.off('magic_points_updated');
    socket.off('sync_update');
    socket.off('house_assessment_update'); // Add off for the new handler

    socket.on('house_points_update', handleHousePointsUpdate);
    socket.on('notification', handleNewNotification);
    socket.on('magic_points_updated', handleMagicPointsUpdated);
    socket.on('sync_update', handleSyncUpdate);
    socket.on('house_assessment_update', handleHouseAssessmentUpdate); // Add on for the new handler

    return () => {
      socket.off('house_points_update', handleHousePointsUpdate);
      socket.off('notification', handleNewNotification);
      socket.off('magic_points_updated', handleMagicPointsUpdated);
      socket.off('sync_update', handleSyncUpdate);
      socket.off('house_assessment_update', handleHouseAssessmentUpdate); // Add off for the new handler in cleanup
    };
  }, [socket, user, addNotification]);

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

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionQuality,
        lastMessage,
        notifications,
        lastHeartbeat,
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