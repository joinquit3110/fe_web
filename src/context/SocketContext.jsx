import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// Backend URL for socket connection
const SOCKET_URL = "https://be-web-6c4k.onrender.com";

// Create context
const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

// Helper to determine notification priority (moved outside component for stability)
const getNotificationPriority = (notification) => {
  if (!notification || !notification.type) return 0; // Basic safety
  if (notification.type === 'error') return 4;
  if (notification.type === 'warning') return 3;
  if (notification.type === 'success') return 2;
  if (notification.type === 'announcement') return 1;
  return 0;
};

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
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const batchTimeoutRef = useRef(null); // For batching incoming notifications
  const processingTimeoutRef = useRef(null); // For draining the queue
  const MAX_BATCH_SIZE = 5;
  const BATCH_TIMEOUT = 100; // ms
  
  const processNotificationQueue = useCallback(() => {
    if (notificationQueue.length === 0 && !isProcessingQueue) { // Added !isProcessingQueue to log even if called when empty by mistake
      return;
    }
    if (isProcessingQueue) {
      console.log('[SOCKET] processNotificationQueue: CALLED but already processing. Bailing.');
      return;
    }

    setIsProcessingQueue(true);
    console.log('[SOCKET] processNotificationQueue: START. Queue length:', notificationQueue.length);

    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    let remainingInQueue = [];

    try {
      const currentQueueSnapshot = [...notificationQueue]; // Work on a snapshot
      const sortedQueue = currentQueueSnapshot.sort((a, b) => {
        const priorityA = getNotificationPriority(a);
        const priorityB = getNotificationPriority(b);
        if (priorityA !== priorityB) return priorityB - priorityA;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      console.log('[SOCKET] processNotificationQueue: Sorted queue IDs:', JSON.stringify(sortedQueue.map(n => n.id)));
      
      const batch = sortedQueue.slice(0, MAX_BATCH_SIZE);
      remainingInQueue = sortedQueue.slice(MAX_BATCH_SIZE);
      console.log('[SOCKET] processNotificationQueue: Batch IDs to process:', JSON.stringify(batch.map(n => n.id)), 'Remaining in queue IDs:', JSON.stringify(remainingInQueue.map(n => n.id)));
      
      if (batch.length > 0) {
        setNotifications(prevDisplayedNotifications => {
          console.log('[SOCKET] processNotificationQueue: setNotifications callback. Prev displayed IDs:', JSON.stringify(prevDisplayedNotifications.map(n => n.id)));
          const displayedIds = new Set(prevDisplayedNotifications.map(n => n.id));
          
          const newBatchItemsToShow = batch.filter(item => {
            const alreadyDisplayed = displayedIds.has(item.id);
            return !alreadyDisplayed;
          });
          console.log('[SOCKET] processNotificationQueue: New items to show IDs:', JSON.stringify(newBatchItemsToShow.map(n => n.id)));
          
          // Combine new items with existing, ensuring new ones are at the beginning for LIFO-like display stack
          const combined = [...newBatchItemsToShow, ...prevDisplayedNotifications];
          
          const finalNotifications = [];
          const seenIds = new Set();
          for (const n of combined) {
              if (!seenIds.has(n.id)) {
                  finalNotifications.push(n);
                  seenIds.add(n.id);
              }
          }
          console.log('[SOCKET] processNotificationQueue: Combined and deduplicated IDs for display:', JSON.stringify(finalNotifications.map(n => n.id)));
          const result = finalNotifications.slice(0, 10); // Keep max 10 notifications
          console.log('[SOCKET] processNotificationQueue: Resulting notifications for context (sliced) IDs:', JSON.stringify(result.map(n => n.id)));
          return result;
        });
      } else {
        console.log('[SOCKET] processNotificationQueue: Batch is empty, no call to setNotifications.');
      }
      
      // Update the queue state with what remains
      setNotificationQueue(remainingInQueue); 
      
    } catch (error) {
      console.error('[SOCKET] Error processing notification queue:', error);
    } finally {
      setIsProcessingQueue(false);
      console.log('[SOCKET] processNotificationQueue: FINISHED current run. Remaining in queue:', remainingInQueue.length);
      if (remainingInQueue.length > 0) {
        processingTimeoutRef.current = setTimeout(processNotificationQueue, BATCH_TIMEOUT);
        console.log('[SOCKET] processNotificationQueue: END. Queue has items, rescheduling.');
      } else {
        console.log('[SOCKET] processNotificationQueue: END. Queue empty.');
      }
    }
  }, [isProcessingQueue, notificationQueue, MAX_BATCH_SIZE, BATCH_TIMEOUT]); // getNotificationPriority is stable

  // Optimize notification adding with batching and deduplication
  const addNotification = useCallback((notification) => {
    if (!notification || !notification.id) {
      console.error('[SOCKET] Attempted to add invalid notification:', notification);
      return;
    }
    
    const notificationKey = `${notification.id}_${notification.type}_${notification.house || ''}_${notification.pointsChange || ''}`;
    if (recentNotifications.current.has(notificationKey)) {
      console.log('[SOCKET] Skipping duplicate notification (recent history):', notificationKey);
      return;
    }
    recentNotifications.current.add(notificationKey);
    console.log('[SOCKET] addNotification: Adding new notification with key:', notificationKey, 'ID:', notification.id);
    
    setNotificationQueue(prevQueue => {
      const isDuplicateInCurrentQueue = prevQueue.some(n => n.id === notification.id);
      if (isDuplicateInCurrentQueue) {
        console.log('[SOCKET] addNotification: Skipping duplicate already in queue. ID:', notification.id);
        return prevQueue;
      }
      
      const newQueue = [...prevQueue, notification];
      console.log('[SOCKET] addNotification: setNotificationQueue callback. New queue length:', newQueue.length, 'IDs:', JSON.stringify(newQueue.map(n => n.id)));
      
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      batchTimeoutRef.current = setTimeout(() => {
        console.log('[SOCKET] addNotification: Batch timeout fired. Calling processNotificationQueue.');
        processNotificationQueue();
      }, BATCH_TIMEOUT);
      
      return newQueue;
    });
  }, [processNotificationQueue, BATCH_TIMEOUT]); // processNotificationQueue is a dependency

  // Enhanced socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleSyncUpdate = (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });

      if (data.type === 'user_update' && data.message && data.message.includes('magic points')) {
        console.log('[SOCKET] Processing user_update for magic points sync:', data);

        // Skip this logic if it's an admin-initiated action already handled elsewhere
        if (data.data?.forceSyncOrigin === 'admin') {
          console.log('[SOCKET] Skipping sync processing for admin-initiated user_update');
          return;
        }

        // Parse points value from message
        const pointsMatch = data.message.match(/updated to (\d+)/);
        if (pointsMatch && pointsMatch[1] && user) {
          const newPoints = parseInt(pointsMatch[1], 10);

          // Primary responsibility: Update AuthContext with the new points total.
          if (user.magicPoints !== newPoints) {
            console.log(`[SOCKET] Sync update: User points changing from ${user.magicPoints} to ${newPoints}. Updating AuthContext.`);
            if (typeof setUser === 'function') {
              setUser(prevUser => ({ ...prevUser, magicPoints: newPoints }));
            } else {
              console.error('[SOCKET] setUser is not a function. Cannot update user points in AuthContext from sync_update.');
            }
          } else {
            console.log(`[SOCKET] Sync update: User points already ${newPoints}. No AuthContext update needed.`);
          }
        }
      } else if (data.type === 'force_sync') {
        console.log('[SOCKET] Received force_sync. Client should re-fetch or await specific updates.');
      }
    };

    const handleHousePointsUpdate = (data) => {
      console.log('[SOCKET] Received house_points_update:', data);
      
      if (data.newTotal !== undefined) {
        console.log('[SOCKET] Points delta:', data.points, 'New total:', data.newTotal);
        
        if (Math.abs(data.points) >= Math.abs(data.newTotal)) {
          console.warn('[SOCKET] Warning: points delta is >= newTotal, this might be incorrect', {
            points: data.points, 
            newTotal: data.newTotal
          });
        }
      }
      
      if (!data.house || data.points === undefined) {
        console.error('[SOCKET] Invalid house points data:', data);
        return;
      }
      
      const isAdminAction = data.adminAction === true;
      if (isAdminAction) {
        console.log('[SOCKET] This is an admin-initiated house points update');
      }
      
      if (isAdminUser.current) {
        console.log('[SOCKET] Admin received house points update, displaying notification');
      } else if (!user || user.house === 'muggle' || !user.house || data.house !== user.house) {
        return;
      }
      
      localStorage.setItem('lastHousePointsUpdate', Date.now().toString());
      
      if (isAdminAction) {
        localStorage.setItem('lastAdminHousePointsUpdate', Date.now().toString());
        localStorage.setItem('lastAdminHousePointsValue', data.points.toString());
      }
      
      console.log('[SOCKET] Creating house points notification with data:', {
        house: data.house,
        points: data.points,
        reason: data.reason,
        criteria: data.criteria,
        level: data.level,
        timestamp: data.timestamp
      });
      
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
        
        const reasonForCustomEvent = (data.reason && String(data.reason).trim().toLowerCase() !== 'system update' && String(data.reason).trim() !== '') 
                                     ? String(data.reason).trim() 
                                     : null;
        
        console.log('[SOCKET] Dispatching debug event for house points with reason:', reasonForCustomEvent);
        
        const debugEvent = new CustomEvent('magicPointsUIUpdate', {
          detail: { 
            source: 'housePointsUpdate',
            timestamp: new Date().toISOString(),
            points: data.points,
            reason: reasonForCustomEvent,
            delta: data.points,
            house: data.house,
            criteria: data.criteria || null,
            level: data.level || null,
            isHousePointsUpdate: true
          }
        });
        window.dispatchEvent(debugEvent);
        
        const regularUpdate = new CustomEvent('magicPointsUpdated', {
          detail: { 
            points: data.points,
            source: 'housePointsUpdate',
            timestamp: new Date().toISOString(),
            house: data.house,
            reason: reasonForCustomEvent,
            delta: data.points,
            criteria: data.criteria || null,
            level: data.level || null,
            isHousePointsUpdate: true
          }
        });
        window.dispatchEvent(regularUpdate);
      }
      
      let cleanReason = '';
      if (data.reason && String(data.reason).trim() !== '' && String(data.reason).trim().toLowerCase() !== 'system update') {
        cleanReason = String(data.reason).trim();
      }

      if (cleanReason === '') {
        const houseName = data.house.charAt(0).toUpperCase() + data.house.slice(1);
        cleanReason = `${houseName} points ${data.points > 0 ? 'awarded' : 'deducted'}`;
      }

      console.log('[SOCKET] House points notification - final reason:', cleanReason, 'from original:', data.reason);

      const message = cleanReason ? 
        `${Math.abs(data.points)} points ${data.points > 0 ? 'awarded to' : 'deducted from'} ${data.house}: ${cleanReason}` :
        `${Math.abs(data.points)} points ${data.points > 0 ? 'awarded to' : 'deducted from'} ${data.house}: ${data.house.charAt(0).toUpperCase() + data.house.slice(1)} update`;
        
      const uniqueId = `house_points_${data.house}_${data.points}_${Date.now()}`;
      console.log('[SOCKET] Creating house points notification with unique ID:', uniqueId);
      
      const notification = {
        id: uniqueId,
        type: data.points > 0 ? 'success' : 'warning',
        title: data.points > 0 ? 'HOUSE POINTS AWARDED!' : 'HOUSE POINTS DEDUCTED!',
        message: message,
        timestamp: new Date(),
        pointsChange: data.points,
        totalPoints: data.newTotal,
        reason: cleanReason,
        criteria: data.criteria || null,
        level: data.level || null,
        house: data.house,
        isHousePointsUpdate: true,
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

    const handleHouseAssessmentUpdate = (data) => {
      console.log('[SOCKET] Received house_assessment_update:', data);
      
      if (!data.house || !data.assessment) {
        console.error('[SOCKET] Invalid house assessment data:', data);
        return;
      }
      
      if (isAdminUser.current) {
        console.log('[SOCKET] Admin received house assessment update, displaying notification');
      } else if (!user || user.house === 'muggle' || !user.house || data.house !== user.house) {
        return;
      }
      
      localStorage.setItem('lastHouseAssessmentUpdate', Date.now().toString());
      
      console.log('[SOCKET] Creating house assessment notification with data:', {
        house: data.house,
        assessment: data.assessment,
        criteria: data.criteria,
        level: data.level,
        evaluator: data.evaluator,
        timestamp: data.timestamp
      });
      
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

  const removeNotification = useCallback((notificationId) => {
    console.log('[SOCKET] removeNotification called for ID:', notificationId);
    setNotifications(prevDisplayedNotifications => {
      const newDisplayed = prevDisplayedNotifications.filter(notif => notif.id !== notificationId);
      console.log('[SOCKET] removeNotification: setNotifications callback. Prev displayed IDs:', JSON.stringify(prevDisplayedNotifications.map(n => n.id)), 'New displayed IDs:', JSON.stringify(newDisplayed.map(n => n.id)));
      return newDisplayed;
    });
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
        sendMessage: useCallback((eventName, data) => {
          if (socket && isConnected) {
            socket.emit(eventName, data);
            return true;
          }
          return false;
        }, [socket, isConnected]),
        requestSync: useCallback(() => {
          if (socket && isConnected) {
            console.log('[SOCKET] Manually requesting data sync');
            socket.emit('request_sync');
            return true;
          }
          
          console.log('[SOCKET] Cannot request sync - not connected');
          return false;
        }, [socket, isConnected]),
        clearNotifications: useCallback(() => {
          console.log('[SOCKET] clearNotifications called');
          setNotifications([]);
          setNotificationQueue([]);
        }, []),
        removeNotification
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};