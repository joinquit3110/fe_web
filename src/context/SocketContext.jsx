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

    const handleSyncUpdate = (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      
      if (data.type === 'user_update' && data.data?.updatedFields) {
        handleUserUpdate(data.data.updatedFields);
        
        // Check if magic points were updated directly in the updatedFields
        if (data.data.updatedFields.magicPoints !== undefined) {
          const newPoints = parseInt(data.data.updatedFields.magicPoints, 10);
          if (!isNaN(newPoints)) {
            // Dispatch an event to update the debug menu directly
            const uiUpdateEvent = new CustomEvent('magicPointsUIUpdate', {
              detail: { 
                points: newPoints,
                source: 'socketFieldsUpdate',
                timestamp: new Date().toISOString()
              }
            });
            window.dispatchEvent(uiUpdateEvent);
          }
        }
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
            // Extract potential reason from data - look more carefully for a reason
            let reason = null;
            
            // Try to extract reason from the message if present
            if (data.message && data.message.includes(':')) {
              const parts = data.message.split(':');
              if (parts.length >= 2) {
                reason = parts[1].trim();
              }
            }
            
            // If no reason found in message, try standard fields
            if (!reason) {
              reason = data.reason || data.data?.reason || data.data?.lastUpdateReason || null;
            }
            
            // Extract criteria/level if available
            const criteria = data.criteria || data.data?.criteria || null;
            const level = data.level || data.data?.level || null;
            
            console.log('[SOCKET] Extracted point update reason:', reason);
            
            // Create notification for points change
            const notification = {
              id: `points_update_${Date.now()}`,
              type: pointsDiff > 0 ? 'success' : 'warning',
              title: pointsDiff > 0 ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
              message: `Your magic points have ${pointsDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(pointsDiff)}${reason ? ': ' + reason : ''}`,
              timestamp: new Date(),
              pointsChange: pointsDiff,
              reason: reason, // Don't use 'System update' as default
              criteria: criteria,
              level: level,
              house: user.house,
              isPersonalPointsUpdate: true // Mark as personal points notification to distinguish from house points
            };
            
            // Dispatch an event to update the debug menu
            const uiUpdateEvent = new CustomEvent('magicPointsUIUpdate', {
              detail: { 
                points: newPoints,
                source: 'socketUpdate',
                timestamp: new Date().toISOString(),
                delta: pointsDiff,
                reason: reason || 'System update'
              }
            });
            window.dispatchEvent(uiUpdateEvent);
            
            addNotification(notification);
          }
        }
      }
    };

    const handleHousePointsUpdate = (data) => {
      console.log('[SOCKET] Received house_points_update:', data);
      
      // Ensure we have all the data we need
      if (!data.house || data.points === undefined) {
        console.error('[SOCKET] Invalid house points data:', data);
        return;
      }
      
      // Special handling for admin users
      if (isAdminUser.current) {
        console.log('[SOCKET] Admin received house points update, displaying notification');
        // Admin sees all house point changes
      } else if (!user || user.house === 'muggle' || !user.house || data.house !== user.house) {
        // Skip notification if user doesn't belong to the house that got points
        return;
      }
      
      // Log detailed data for debugging
      console.log('[SOCKET] Creating house points notification with data:', {
        house: data.house,
        points: data.points,
        reason: data.reason,
        criteria: data.criteria,
        level: data.level,
        timestamp: data.timestamp
      });
      
      // Dispatch an event to notify components of house points change
      if (typeof window !== 'undefined') {
        const housePointsEvent = new CustomEvent('house-points-update', {
          detail: {
            house: data.house,
            points: data.points,
            reason: data.reason || 'House points update',
            criteria: data.criteria,
            level: data.level,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(housePointsEvent);
        
        // Also dispatch a debug event to ensure debug panel is updated
        // Make sure we're passing accurate house points data to update the debug menu
        const extractedReason = data.reason && data.reason !== 'System update' ? data.reason : null;
        
        // Log detailed debug info about the event being dispatched
        console.log('[SOCKET] Dispatching debug event for house points with reason:', extractedReason);
        
        const debugEvent = new CustomEvent('magicPointsUIUpdate', {
          detail: { 
            source: 'housePointsUpdate',
            timestamp: new Date().toISOString(),
            points: data.points,
            reason: extractedReason, // Use the extracted reason
            delta: data.points, // Include delta for better debug display
            house: data.house,  // Include house info
            criteria: data.criteria || null,
            level: data.level || null,
            isHousePointsUpdate: true // Mark as house points update for filtering
          }
        });
        window.dispatchEvent(debugEvent);
        
        // Also dispatch a regular magicPointsUpdated event to ensure all handlers receive the update
        // Fix: Include the reason, criteria, level, and delta in the regular update for consistency
        // Note: extractedReason is already defined above
        const regularUpdate = new CustomEvent('magicPointsUpdated', {
          detail: { 
            points: data.points,
            source: 'housePointsUpdate',
            timestamp: new Date().toISOString(),
            house: data.house,
            reason: extractedReason, // Include the reason
            delta: data.points, // Include the delta
            criteria: data.criteria || null,
            level: data.level || null,
            isHousePointsUpdate: true // Mark as house points notification
          }
        });
        window.dispatchEvent(regularUpdate);
      }
      
      // Create custom notification with exact house points data
      // Make sure we extract a clean reason for the notification - this is critical
      
      // Better reason extraction - completely rewritten and enhanced
      let cleanReason = null;
      if (data.reason) {
        cleanReason = data.reason !== 'System update' ? data.reason : null;
      }
      
      // Log all the details for debugging
      console.log('[SOCKET] House points notification - extracted reason:', cleanReason, 'from original:', data.reason);
      console.log('[SOCKET] House points full data:', {
        house: data.house,
        points: data.points,
        originalReason: data.reason,
        cleanReason: cleanReason,
        criteria: data.criteria,
        level: data.level
      });
      
      const notification = {
        id: `house_points_${Date.now()}`,
        type: data.points > 0 ? 'success' : 'warning',
        title: data.points > 0 ? 'HOUSE POINTS AWARDED!' : 'HOUSE POINTS DEDUCTED!',
        message: `${Math.abs(data.points)} points ${data.points > 0 ? 'awarded to' : 'deducted from'} ${data.house}${cleanReason ? ': ' + cleanReason : ''}`,
        timestamp: new Date(),
        pointsChange: data.points,
        reason: cleanReason, // Use the cleaned reason, NEVER use 'System update'
        criteria: data.criteria || null,
        level: data.level || null,
        house: data.house,
        isHousePointsUpdate: true, // Mark as house points notification
        // Add more explicit flags to help the notification system
        isPersonalPointsUpdate: false
      };
        
      addNotification(notification);
    };

    const handleAdminNotification = (data) => {
      if ((data.skipAdmin === true || data.skipAdmin === "true") && isAdminUser.current) {
        return;
      }
      
      const notification = {
        id: Date.now(),
        type: data.notificationType || 'info',
        message: data.message,
        timestamp: new Date()
      };
      
      addNotification(notification);
    };

    const handleGlobalAnnouncement = (data) => {
      const notification = {
        id: Date.now(),
        type: 'announcement',
        message: `ANNOUNCEMENT: ${data.message}`,
        timestamp: new Date()
      };
      
      addNotification(notification);
    };

    // Register event handlers
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
  }, [socket, user, addNotification]);

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

  // Helper to handle user updates
  const handleUserUpdate = (updatedFields) => {
    if (updatedFields.house && user && setUser) {
      handleHouseUpdate(updatedFields.house);
    }
    
    if (updatedFields.magicPoints !== undefined) {
      handleMagicPointsUpdate(updatedFields);
    }
  };

  // Helper to handle house updates
  const handleHouseUpdate = (newHouse) => {
    if (user && setUser) {
      setUser(prev => ({
        ...prev,
        house: newHouse,
        previousHouse: prev.house
      }));
    }
  };

  // Helper to handle magic points updates
  const handleMagicPointsUpdate = (updatedFields) => {
    if (user && setUser) {
      const oldPoints = user.magicPoints || 0;
      const newPoints = updatedFields.magicPoints;
      
      console.log(`[SOCKET] Updating user magic points: ${oldPoints} → ${newPoints}`);
      
      // Update the user object
      setUser(prev => ({
        ...prev,
        magicPoints: newPoints
      }));
      
      // Also notify the MagicPointsContext via a custom event
      if (typeof window !== 'undefined') {
        // Event for general points updates
        const pointsEvent = new CustomEvent('magicPointsUpdated', {
          detail: {
            points: newPoints,
            source: 'serverSync',
            immediate: true,
            oldPoints: oldPoints,
            timestamp: new Date().toISOString()
          }
        });
        console.log('[SOCKET] Dispatching magicPointsUpdated event with new value:', newPoints);
        window.dispatchEvent(pointsEvent);
        
        // Event specifically for debug menu updates
        const uiUpdateEvent = new CustomEvent('magicPointsUIUpdate', {
          detail: {
            points: newPoints,
            source: 'socketUpdate',
            delta: newPoints - oldPoints,
            timestamp: new Date().toISOString()
          }
        });
        console.log('[SOCKET] Dispatching magicPointsUIUpdate event for debug menu:', newPoints);
        window.dispatchEvent(uiUpdateEvent);
      }
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