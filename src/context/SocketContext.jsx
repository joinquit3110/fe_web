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

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Set up socket event handlers
    socket.on('sync_update', handleSyncUpdate);
    socket.on('house_points_update', handleHousePointsUpdate);
    socket.on('admin_notification', handleAdminNotification);
    socket.on('global_announcement', handleGlobalAnnouncement);
    socket.on('user_update', handleUserUpdate);
    socket.on('house_update', handleHouseUpdate);
    socket.on('magic_points_update', handleMagicPointsUpdate);
    
    // New event listener for client_house_notification from admin
    socket.on('client_house_notification', (data) => {
      console.log('[SOCKET] Received client_house_notification:', data);
      
      // Create a format for the notification
      const notification = createHousePointsNotification(data);
      
      // Add to notification queue
      if (notification) {
        addNotification(notification);
        
        // Also dispatch a custom event for direct UI updates
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('house-points-update', {
            detail: {
              house: data.house,
              points: data.points,
              reason: data.reason,
              newTotal: data.newTotal,
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(event);
        }
      }
    });
    
    // Clean up on unmount
    return () => {
      socket.off('sync_update', handleSyncUpdate);
      socket.off('house_points_update', handleHousePointsUpdate);
      socket.off('admin_notification', handleAdminNotification);
      socket.off('global_announcement', handleGlobalAnnouncement);
      socket.off('user_update', handleUserUpdate);
      socket.off('house_update', handleHouseUpdate);
      socket.off('magic_points_update', handleMagicPointsUpdate);
      socket.off('client_house_notification');
    };
  }, [socket, isConnected, user]); 
  
  // Handle sync update event with improved handling
  const handleSyncUpdate = (data) => {
    console.log('[SOCKET] Received sync update:', data);
    const lastMessage = data;
    setLastMessage(lastMessage);
    
    try {
      // Handle different types of sync updates
      if (data.type === 'user_update') {
        // User data update
        if (data.data && data.data.userId === user?.id) {
          // Personal user update
          handleUserUpdate(data.data);
        }
      } else if (data.type === 'points_update') {
        // Points update
        if (data.data && data.data.userId === user?.id) {
          console.log('[SOCKET] Received points update:', data.data);
          
          // Create a points notification
          const notification = {
            id: `points-${Date.now()}`,
            type: 'points',
            title: data.data.points > 0 ? 'Points Earned!' : 'Points Lost',
            message: `${data.data.points > 0 ? '+' : ''}${data.data.points} points! ${data.data.reason || ''}`,
            timestamp: data.timestamp,
            priority: 'high',
            user: user.username,
            pointsChange: data.data.points
          };
          
          addNotification(notification);
          
          // Also dispatch a custom event for the MagicPointsContext
          if (typeof window !== 'undefined') {
            const event = new CustomEvent('magicPointsUpdated', {
              detail: {
                points: data.data.totalPoints || 0,
                pointsDiff: data.data.points || 0,
                reason: data.data.reason,
                timestamp: data.timestamp
              }
            });
            window.dispatchEvent(event);
          }
        }
      } else if (data.type === 'house_points_update') {
        // House points update, handled separately
        handleHousePointsUpdate(data.data);
      }
    } catch (error) {
      console.error('[SOCKET] Error handling sync update:', error);
    }
  };
  
  // Handle house points update with improved handling
  const handleHousePointsUpdate = (data) => {
    console.log('[SOCKET] Received house points update:', data);
    
    if (!data || !data.house) return;
    
    // Only show notification if it's for the user's house
    if (user?.house === data.house || user?.house === 'admin') {
      try {
        // Create a notification for this house update
        const notification = createHousePointsNotification(data);
        
        // Add to notification queue
        if (notification) {
          addNotification(notification);
        }
        
        // Also dispatch a custom event for direct UI updates
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('house-points-update', {
            detail: {
              house: data.house,
              points: data.points,
              reason: data.reason,
              newTotal: data.newTotal,
              timestamp: data.timestamp || new Date().toISOString()
            }
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        console.error('[SOCKET] Error handling house points update:', error);
      }
    }
  };

  // Helper to create house points notification
  const createHousePointsNotification = (data) => {
    const pointsChange = data.points;
    const isPositive = pointsChange > 0;
    const uniqueId = `house_points_${data.house}_${pointsChange}_${data.timestamp || Date.now()}`;
    
    return {
      id: uniqueId,
      type: isPositive ? 'success' : 'warning',
      title: isPositive ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
      message: formatHousePointsMessage(data),
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      pointsChange,
      reason: data.reason,
      criteria: data.criteria,
      level: data.level,
      source: 'house_points_update',
      house: data.house
    };
  };

  // Helper to format house points message
  const formatHousePointsMessage = (data) => {
    // Start with base message
    let message = `House ${data.house} has ${data.points > 0 ? 'gained' : 'lost'} ${Math.abs(data.points)} points!`;
    
    // Add total if available
    if (data.newTotal !== undefined) {
      message += ` New total: ${data.newTotal}`;
    }
    
    // Add reason, criteria, level in a consistent format
    const details = [];
    
    if (data.reason && data.reason !== 'Admin action' && data.reason.trim() !== '') {
      details.push(`Reason: ${data.reason}`);
    }
    
    if (data.criteria && data.criteria !== null) {
      details.push(`Criteria: ${data.criteria}`);
    }
    
    if (data.level && data.level !== null) {
      details.push(`Level: ${data.level}`);
    }
    
    // Join all details with periods
    if (details.length > 0) {
      message += `. ${details.join('. ')}`;
    }
    
    return message;
  };

  // Handle admin notification
  const handleAdminNotification = (data) => {
    console.log('[SOCKET] Received admin notification:', data);
    
    // Skip if this is an admin-targeted message and current user is admin
    if ((data.skipAdmin === true || data.skipAdmin === "true") && isAdminUser.current) {
      console.log('[SOCKET] Skipping admin notification for admin user');
      return;
    }
    
    // Create notification object
    const notification = {
      id: `admin-${Date.now()}`,
      type: data.notificationType || 'info',
      title: data.title || 'Notification',
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString(),
      priority: data.priority || 'medium'
    };
    
    // Add to notification queue
    addNotification(notification);
  };

  // Handle global announcement
  const handleGlobalAnnouncement = (data) => {
    console.log('[SOCKET] Received global announcement:', data);
    
    // Create announcement notification
    const notification = {
      id: `announcement-${Date.now()}`,
      type: 'announcement',
      title: data.title || 'ANNOUNCEMENT',
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString(),
      priority: 'high'
    };
    
    // Add to notification queue with priority
    addNotification(notification);
    
    // Also dispatch a custom event for direct UI updates
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('global-announcement', {
        detail: {
          title: data.title,
          message: data.message,
          timestamp: data.timestamp || new Date().toISOString()
        }
      });
      window.dispatchEvent(event);
    }
  };
  
  // Handle user update from server
  const handleUserUpdate = (updatedFields) => {
    console.log('[SOCKET] Received user update:', updatedFields);
    
    // If this contains a points update, create a notification
    if (updatedFields && updatedFields.magicPoints !== undefined) {
      // Dispatch event for the MagicPointsContext
      if (typeof window !== 'undefined' && user) {
        const oldPoints = user.magicPoints || 0;
        const newPoints = updatedFields.magicPoints;
        const pointsDiff = newPoints - oldPoints;
        
        if (pointsDiff !== 0) {
          const event = new CustomEvent('magicPointsUpdated', {
            detail: {
              points: newPoints,
              pointsDiff: pointsDiff,
              reason: updatedFields.reason || 'User update',
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(event);
        }
      }
    }
    
    // Update user state if a setter is available
    if (setUser && updatedFields) {
      setUser(prevUser => ({
        ...prevUser,
        ...updatedFields
      }));
    }
  };
  
  // Handle house update (assignment or change)
  const handleHouseUpdate = (newHouse) => {
    console.log('[SOCKET] Received house update:', newHouse);
    
    // Update user state with new house if a setter is available
    if (setUser && newHouse) {
      setUser(prevUser => ({
        ...prevUser,
        previousHouse: prevUser.house,
        house: newHouse
      }));
      
      // Create notification for house assignment/change
      const notification = {
        id: `house-assignment-${Date.now()}`,
        type: 'success',
        title: 'House Assignment',
        message: `You have been assigned to ${newHouse.charAt(0).toUpperCase() + newHouse.slice(1)}!`,
        timestamp: new Date().toISOString(),
        priority: 'high',
        house: newHouse
      };
      
      addNotification(notification);
    }
  };
  
  // Handle magic points update
  const handleMagicPointsUpdate = (updatedFields) => {
    console.log('[SOCKET] Received magic points update:', updatedFields);
    
    if (!updatedFields || updatedFields.points === undefined) return;
    
    // Create notification for points change
    const points = parseInt(updatedFields.points, 10);
    const notification = {
      id: `points-${Date.now()}`,
      type: points >= 0 ? 'success' : 'warning',
      title: points >= 0 ? 'Points Earned!' : 'Points Lost',
      message: `${points >= 0 ? '+' : ''}${points} magic points. ${updatedFields.reason || ''}`,
      timestamp: updatedFields.timestamp || new Date().toISOString(),
      priority: 'high',
      pointsChange: points
    };
    
    addNotification(notification);
    
    // Dispatch event for direct UI updates
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('magicPointsUpdated', {
        detail: {
          points: updatedFields.totalPoints || 0,
          pointsDiff: points,
          reason: updatedFields.reason,
          timestamp: updatedFields.timestamp || new Date().toISOString()
        }
      });
      window.dispatchEvent(event);
    }
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