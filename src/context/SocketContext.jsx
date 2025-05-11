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

  // Optimize notification adding with batching and deduplication
  const addNotification = useCallback((notification) => {
    // Validate notification first
    if (!notification || !notification.id) {
      console.error('[SOCKET] Attempted to add invalid notification:', notification);
      return;
    }
    
    // Generate a unique key to prevent duplicates
    const notificationKey = `${notification.id}_${notification.type}_${notification.house || ''}_${notification.pointsChange || ''}`;
    
    // Skip if we recently processed a very similar notification
    if (recentNotifications.current.has(notificationKey)) {
      console.log('[SOCKET] Skipping duplicate notification:', notificationKey);
      return;
    }
    
    // Track this notification
    recentNotifications.current.add(notificationKey);
    console.log('[SOCKET] Adding new notification:', notificationKey);
    
    setNotificationQueue(prev => {
      // Check for duplicates in the current queue
      const isDuplicate = prev.some(n => n.id === notification.id);
      if (isDuplicate) {
        console.log('[SOCKET] Skipping duplicate in queue:', notification.id);
        return prev;
      }
      
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

      if (data.type === 'user_update' && data.message && data.message.includes('magic points')) {
        console.log('[SOCKET] Converting point update to notification:', data);

        // Skip this notification if it's an admin-initiated action reflected in user_update
        if (data.data?.forceSyncOrigin === 'admin') {
          console.log('[SOCKET] Skipping sync notification for admin-initiated user_update');
          return;
        }

        // Parse points value from message
        const pointsMatch = data.message.match(/updated to (\d+)/);
        if (pointsMatch && pointsMatch[1] && user) {
          const newPoints = parseInt(pointsMatch[1], 10);
          const oldPoints = user.magicPoints || 0; // Get old points BEFORE updating user state

          // Update AuthContext with the new points total from the sync message.
          // This ensures the client's master state of points is correct for the current session.
          if (user.magicPoints !== newPoints) {
            if (typeof setUser === 'function') {
              setUser(prevUser => ({ ...prevUser, magicPoints: newPoints }));
              // For full persistence, AuthContext's setUser or a dedicated function
              // should also handle updating localStorage.
            } else {
              console.error('[SOCKET] setUser is not a function. Cannot update user points in AuthContext.');
            }
          }

          const pointsDiff = newPoints - oldPoints;

          // Skip if we've recently processed a house points update (within last 5 seconds)
          const lastHouseUpdateTime = localStorage.getItem('lastHousePointsUpdate');
          if (lastHouseUpdateTime && (Date.now() - parseInt(lastHouseUpdateTime)) < 5000) {
            console.log('[SOCKET] Skipping personal notification from sync as it follows closely after house update (5s window).');
            return;
          }

          if (pointsDiff !== 0) {
            // Extract potential reason from data
            let reason = data.reason || data.data?.reason || data.data?.lastUpdateReason || 'System update';

            // Extract criteria/level if available
            const criteria = data.criteria || data.data?.criteria || null;
            const level = data.level || data.data?.level || null;

            console.log('[SOCKET] Extracted point update reason:', reason);

            // Generate unique ID that includes user ID to prevent duplicates
            const notificationId = `points_update_${Date.now()}_${user.id}`;

            // Create notification for points change
            const notification = {
              id: notificationId,
              type: pointsDiff > 0 ? 'success' : 'warning',
              title: pointsDiff > 0 ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
              message: `Your magic points have ${pointsDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(pointsDiff)}${reason ? ': ' + reason : ''}`,
              timestamp: new Date(),
              pointsChange: pointsDiff,
              reason: reason,
              criteria: criteria,
              level: level,
              house: user.house,
              isPersonalPointsUpdate: true,
              isHousePointsUpdate: false
            };

            addNotification(notification);
          }
        }
      }
    };

    const handleHousePointsUpdate = (data) => {
      console.log('[SOCKET] Received house_points_update:', data);
      
      // Add explicit debug log to check points vs newTotal
      if (data.newTotal !== undefined) {
        console.log('[SOCKET] Points delta:', data.points, 'New total:', data.newTotal);
        
        // Sanity check - if points is larger than newTotal or equal to newTotal, it's likely incorrect
        if (Math.abs(data.points) >= Math.abs(data.newTotal)) {
          console.warn('[SOCKET] Warning: points delta is >= newTotal, this might be incorrect', {
            points: data.points, 
            newTotal: data.newTotal
          });
        }
      }
      
      // Ensure we have all the data we need
      if (!data.house || data.points === undefined) {
        console.error('[SOCKET] Invalid house points data:', data);
        return;
      }
      
      // Check if this is an admin-initiated action (will help prevent duplicate notifications)
      const isAdminAction = data.adminAction === true;
      if (isAdminAction) {
        console.log('[SOCKET] This is an admin-initiated house points update');
      }
      
      // Special handling for admin users
      if (isAdminUser.current) {
        console.log('[SOCKET] Admin received house points update, displaying notification');
        // Admin sees all house point changes
      } else if (!user || user.house === 'muggle' || !user.house || data.house !== user.house) {
        // Skip notification if user doesn't belong to the house that got points
        return;
      }
      
      // Save timestamp of house points update to prevent duplicate sync notifications
      localStorage.setItem('lastHousePointsUpdate', Date.now().toString());
      
      // If this is an admin action, also record this specific type
      if (isAdminAction) {
        localStorage.setItem('lastAdminHousePointsUpdate', Date.now().toString());
        localStorage.setItem('lastAdminHousePointsValue', data.points.toString());
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
            points: data.points, // This represents the change, not the total
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
      
      // Enhanced reason extraction - ensure the reason is never lost
      let cleanReason = null;
      if (data.reason) {
        cleanReason = data.reason !== 'System update' ? data.reason : null;
      }
      
      // If no reason provided, create a default reason based on the house
      if (!cleanReason) {
        const houseName = data.house.charAt(0).toUpperCase() + data.house.slice(1);
        cleanReason = `${houseName} ${data.points > 0 ? 'achievement' : 'penalty'}`;
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
      
      // Always include the reason in the message after a colon - critical for UI reason extraction
      // Formatting with colon allows the notification component to reliably extract the reason
      const message = cleanReason ? 
        `${Math.abs(data.points)} points ${data.points > 0 ? 'awarded to' : 'deducted from'} ${data.house}: ${cleanReason}` :
        `${Math.abs(data.points)} points ${data.points > 0 ? 'awarded to' : 'deducted from'} ${data.house}: ${data.house.charAt(0).toUpperCase() + data.house.slice(1)} update`;
        
      // Create a unique ID that includes house, points, and timestamp to prevent duplicates
      // This ID format will help ensure we don't create duplicate notifications
      const uniqueId = `house_points_${data.house}_${data.points}_${Date.now()}`;
      console.log('[SOCKET] Creating house points notification with unique ID:', uniqueId);
      
      const notification = {
        id: uniqueId,
        type: data.points > 0 ? 'success' : 'warning',
        title: data.points > 0 ? 'HOUSE POINTS AWARDED!' : 'HOUSE POINTS DEDUCTED!',
        message: message,
        timestamp: new Date(),
        // Make sure we're using the points delta, not newTotal
        pointsChange: data.points, // This is the change in points, not the total
        // Store newTotal separately if needed, but don't use it for the pointsChange display
        totalPoints: data.newTotal,
        reason: cleanReason, // Always set reason, never null or 'System update'
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

    // Handle house assessment updates
    const handleHouseAssessmentUpdate = (data) => {
      console.log('[SOCKET] Received house_assessment_update:', data);
      
      // Ensure we have all the data we need
      if (!data.house || !data.assessment) {
        console.error('[SOCKET] Invalid house assessment data:', data);
        return;
      }
      
      // Special handling for admin users
      if (isAdminUser.current) {
        console.log('[SOCKET] Admin received house assessment update, displaying notification');
        // Admin sees all house assessment updates
      } else if (!user || user.house === 'muggle' || !user.house || data.house !== user.house) {
        // Skip notification if user doesn't belong to the house that got assessment
        return;
      }
      
      // Save timestamp of house assessment update
      localStorage.setItem('lastHouseAssessmentUpdate', Date.now().toString());
      
      // Log detailed data for debugging
      console.log('[SOCKET] Creating house assessment notification with data:', {
        house: data.house,
        assessment: data.assessment,
        criteria: data.criteria,
        level: data.level,
        evaluator: data.evaluator,
        timestamp: data.timestamp
      });
      
      // Dispatch an event for house assessment update
      if (typeof window !== 'undefined') {
        const houseAssessmentEvent = new CustomEvent('house-assessment-update', {
          detail: {
            house: data.house,
            assessment: data.assessment,
            criteria: data.criteria,
            level: data.level,
            evaluator: data.evaluator,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(houseAssessmentEvent);
      }
      
      // Create notification for the assessment
      const notification = {
        id: `house_assessment_${Date.now()}`,
        type: 'announcement',
        title: 'HOUSE ASSESSMENT!',
        message: `${data.house} house has been assessed: ${data.assessment}`,
        timestamp: new Date(),
        reason: data.criteria || 'House Assessment',
        criteria: data.criteria || null,
        level: data.level || null,
        house: data.house,
        isHouseAssessmentUpdate: true,
        isHousePointsUpdate: false,
        isPersonalPointsUpdate: false
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
    socket.on('house_assessment_update', handleHouseAssessmentUpdate);
    socket.on('global_announcement', handleGlobalAnnouncement);

    return () => {
      socket.off('sync_update', handleSyncUpdate);
      socket.off('house_points_update', handleHousePointsUpdate);
      socket.off('admin_notification', handleAdminNotification);
      socket.off('house_assessment_update', handleHouseAssessmentUpdate);
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
    // Start with base message - only show the points change, not the total
    let message = `House ${data.house} has ${data.points > 0 ? 'gained' : 'lost'} ${Math.abs(data.points)} points!`;
    
    // We're not showing newTotal in the notification message anymore to avoid confusion
    // Let's just keep the points change value to be consistent
    
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
      
      // Check if this update comes after a house points update
      const lastHouseUpdateTime = localStorage.getItem('lastHousePointsUpdate');
      const isCloseToHouseUpdate = lastHouseUpdateTime && 
        (Date.now() - parseInt(lastHouseUpdateTime)) < 2000;
      
      // Update the user object
      setUser(prev => ({
        ...prev,
        magicPoints: newPoints
      }));
      
      // Also notify the MagicPointsContext via a custom event
      if (typeof window !== 'undefined') {
        // Only dispatch events if this doesn't closely follow a house points update
        // This prevents duplicate notifications
        if (!isCloseToHouseUpdate) {
          console.log('[SOCKET] Normal magic points update flow');
          
          // Event for general points updates
          const pointsEvent = new CustomEvent('magicPointsUpdated', {
            detail: {
              points: newPoints,
              source: 'serverSync',
              immediate: true,
              oldPoints: oldPoints,
              timestamp: new Date().toISOString(),
              delta: newPoints - oldPoints
            }
          });
          console.log('[SOCKET] Dispatching magicPointsUpdated event with new value:', newPoints);
          window.dispatchEvent(pointsEvent);
        } else {
          console.log('[SOCKET] Skipping magic points events due to recent house points update');
        }
        
        // Always dispatch debug UI update event (for debug panel only)
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