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
    
    // Create new socket instance
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
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

  // Enhanced socket event handling - now with user state updating capability
  useEffect(() => {
    if (!socket) return;

    // Listen for sync_update - targeted to this specific user
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      
      // Log the full data for debugging
      console.log('[SOCKET] Full sync update data:', JSON.stringify(data));
      
      // Dispatch a custom event to allow components to react IMMEDIATELY
      const event = new CustomEvent('serverSyncUpdate', {
        detail: { type: 'sync_update', data }
      });
      window.dispatchEvent(event);
      
      // Enhanced user update handling with immediate effect
      if (data.type === 'user_update' && data.data?.updatedFields) {
        const updatedFields = data.data.updatedFields;
        
        // If house was updated, update the user object directly
        if (updatedFields.house && user && setUser) {
          console.log(`[SOCKET] House updated from server: ${updatedFields.house}`);
          
          // Update user object in AuthContext with high priority
          try {
            setUser(prevUser => {
              if (!prevUser) return prevUser;
              
              // Create a new user object with updated house
              const updatedUser = {
                ...prevUser,
                previousHouse: prevUser.house,
                house: updatedFields.house
              };
              
              // Also update localStorage to persist the change
              localStorage.setItem('user', JSON.stringify(updatedUser));
              
              // Dispatch a custom event for other components that might need to react
              const houseEvent = new CustomEvent('userHouseChanged', {
                detail: { house: updatedFields.house, immediate: true }
              });
              window.dispatchEvent(houseEvent);
              
              return updatedUser;
            });
          } catch (error) {
            console.error('[SOCKET] Error updating user house:', error);
          }
          
          // Add notification about house change
          setNotifications(prev => [
            {
              id: Date.now(),
              type: 'info',
              message: `Your house has been updated to ${updatedFields.house}`,
              timestamp: new Date()
            },
            ...prev.slice(0, 9)
          ]);
        }
        
        // If magic points were updated, show notification and dispatch event
        if (updatedFields.magicPoints !== undefined) {
          const newPoints = parseInt(updatedFields.magicPoints, 10);
          const prevPoints = user?.magicPoints || parseInt(localStorage.getItem('magicPoints') || '100', 10);
          const diff = newPoints - prevPoints;
          // Only consider it a reset if it comes with a reason indicating it's a reset by admin
          const isReset = updatedFields.lastUpdateReason === 'Points reset by admin';
          const changeDirection = diff > 0 ? 'increased by' : 'decreased by';
          
          if (!isNaN(newPoints)) {
            console.log(`[SOCKET] Magic points updated from server: ${newPoints} (change: ${diff}, isReset: ${isReset})`);
            
            // Add notification about points change with more specific information
            setNotifications(prev => [
              {
                id: Date.now(),
                type: isReset ? 'warning' : (diff >= 0 ? 'success' : 'warning'),
                message: isReset 
                  ? `Your magic points have been RESET to 100 by admin!`
                  : (diff !== 0 
                  ? `Your magic points have been ${changeDirection} ${Math.abs(diff)}`
                    : `Your magic points have been updated to ${newPoints}`),
                timestamp: new Date()
              },
              ...prev.slice(0, 9)
            ]);
            
            // Dispatch a custom event for MagicPointsContext with high priority flag
            const pointsEvent = new CustomEvent('magicPointsUpdated', {
              detail: { 
                points: newPoints,
                source: 'serverSync',
                immediate: true,
                isReset: isReset
              }
            });
            window.dispatchEvent(pointsEvent);
            
            // Update user object with new points immediately
            setUser(prevUser => {
              if (!prevUser) return prevUser;
              
              const updatedUser = {
                ...prevUser,
                magicPoints: newPoints
              };
              
              localStorage.setItem('user', JSON.stringify(updatedUser));
              
              // Force update localStorage magic points separately for redundancy
              localStorage.setItem('magicPoints', newPoints.toString());
              
              return updatedUser;
            });
          }
        }
      }
    });
    
    // Listen for house_points_update - broadcasts to all in a house
    socket.on('house_points_update', (data) => {
      console.log('[SOCKET] Received house points update:', data);
      setLastMessage({ type: 'house_points_update', data, timestamp: new Date() });
      
      // Skip notifications for admin, muggle, or unassigned users
      if (isAdminUser.current || user?.house === 'muggle' || !user?.house) {
        console.log(`[SOCKET] Skipping house points notification for user ${user?.username} (${user?.house || 'unassigned'})`);
        return;
      }
      
      // For regular users that should see this notification, show it
      // Add notification about house points change
      if (data.house === user?.house) {
        const pointsChange = data.points;
        const isPositive = pointsChange > 0;
        
        // Create a uniqueId for this house points update to prevent duplicates
        // Using timestamp from server or current time as a fallback
        const uniqueId = `house_points_${data.house}_${pointsChange}_${data.timestamp || Date.now()}`;
        
        // Check for exact duplicates using a more robust key
        const dedupeKey = `${data.house}:${pointsChange}:${data.criteria || ''}:${data.level || ''}`;
        
        // Make sure we have valid criteria and level data
        const criteria = data.criteria || null;
        const level = data.level || null;
        const reason = data.reason || 'Admin action';
        
        // If we've seen this exact notification recently, skip it
        if (recentNotifications.current.has(dedupeKey)) {
          console.log(`[SOCKET] Skipping duplicate notification with key: ${dedupeKey}`);
          return;
        }
        
        // Add to recent notifications to prevent duplicates
        recentNotifications.current.add(dedupeKey);
        
        // Create a full message that includes all the details
        let fullMessage = `House ${data.house} has ${isPositive ? 'gained' : 'lost'} ${Math.abs(pointsChange)} points! New total: ${data.newTotal}`;
        if (criteria) fullMessage += `. Criteria: ${criteria}`;
        if (level) fullMessage += `. Level: ${level}`;
        if (reason && reason !== 'Admin action') fullMessage += `. Reason: ${reason}`;
        
        setNotifications(prev => {
          // Check if we already have very similar notifications in the last few seconds
          // This prevents duplicates coming from multiple house members
          const similarExists = prev.some(n => 
            n.source === 'house_points_update' &&
            n.pointsChange === pointsChange &&
            n.criteria === criteria &&
            n.level === level &&
            (Date.now() - new Date(n.timestamp).getTime()) < 30000 // Within 30 seconds
          );
          
          if (similarExists) {
            console.log('[SOCKET] Skipping duplicate house points notification');
            return prev; // Skip duplicate
          }
          
          return [
            {
              id: uniqueId,
              type: isPositive ? 'success' : 'warning',
              title: isPositive ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
              message: fullMessage,
              timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
              // Include additional data for the notification system
              pointsChange,
              reason,
              criteria,
              level,
              // Add additional keys to help with debugging and duplicate detection
              source: 'house_points_update',
              eventTime: data.timestamp || new Date().toISOString()
            },
            ...prev.slice(0, 9)
          ];
        });
        
        // Dispatch event for house points update
        const housePointsEvent = new CustomEvent('housePointsUpdated', {
          detail: {
            house: data.house,
            points: pointsChange,
            newTotal: data.newTotal,
            reason,
            criteria,
            level,
            timestamp: data.timestamp || new Date().toISOString(),
            uniqueKey: dedupeKey // Add the unique key to help other components deduplicate
          }
        });
        window.dispatchEvent(housePointsEvent);
      }
    });
    
    // Listen for admin_notification - sent by admin to specific users or houses
    socket.on('admin_notification', (data) => {
      console.log('[SOCKET] Received admin notification:', data);
      setLastMessage({ type: 'admin_notification', data, timestamp: new Date() });
      
      // Skip if this notification should skip admins and the current user is an admin
      if (data.skipAdmin === true || data.skipAdmin === "true") {
        if (isAdminUser.current) {
          console.log(`[SOCKET] Skipping admin notification for admin user: ${user?.username}`);
          return;
        }
      }
      
      // Add to notifications
      setNotifications(prev => [
        {
          id: Date.now(),
          type: data.notificationType || 'info',
          message: data.message,
          timestamp: new Date()
        },
        ...prev.slice(0, 9)
      ]);
      
      // Dispatch a custom event for the notification
      const notificationEvent = new CustomEvent('adminNotification', {
        detail: data
      });
      window.dispatchEvent(notificationEvent);
    });
    
    // Listen for global_announcement - sent to all connected users
    socket.on('global_announcement', (data) => {
      console.log('[SOCKET] Received global announcement:', data);
      setLastMessage({ type: 'global_announcement', data, timestamp: new Date() });
      
      // Add to notifications with special styling
        setNotifications(prev => [
          {
            id: Date.now(), 
          type: 'announcement',
          message: `ANNOUNCEMENT: ${data.message}`,
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
    });

    return () => {
      // Clean up all listeners
      socket.off('sync_update');
      socket.off('house_points_update');
      socket.off('admin_notification');
      socket.off('global_announcement');
    };
  }, [socket, user, setUser]);

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