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

  // Enhanced real-time notification processor
  useEffect(() => {
    if (!socket) return;

    // Process notifications more efficiently with immediate delivery
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      
      // Enhanced user update handling with immediate effect
      if (data.type === 'user_update' && data.data?.updatedFields) {
        const updatedFields = data.data.updatedFields;
        
        // If house was updated, update the user object immediately
        if (updatedFields.house && user && setUser) {
          console.log(`[SOCKET] House updated from server: ${updatedFields.house}`);
          
          try {
            setUser(prevUser => {
              if (!prevUser) return prevUser;
              
              const updatedUser = {
                ...prevUser,
                previousHouse: prevUser.house,
                house: updatedFields.house
              };
              
              localStorage.setItem('user', JSON.stringify(updatedUser));
              
              window.dispatchEvent(new CustomEvent('userHouseChanged', {
                detail: { house: updatedFields.house, immediate: true }
              }));
              
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
        
        // If magic points were updated, handle with high priority
        if (updatedFields.magicPoints !== undefined) {
          const newPoints = parseInt(updatedFields.magicPoints, 10);
          const prevPoints = user?.magicPoints || parseInt(localStorage.getItem('magicPoints') || '100', 10);
          const diff = newPoints - prevPoints;
          const isReset = updatedFields.lastUpdateReason === 'Points reset by admin';
          const changeDirection = diff > 0 ? 'increased by' : 'decreased by';
          
          if (!isNaN(newPoints)) {
            console.log(`[SOCKET] Magic points updated from server: ${newPoints} (change: ${diff}, isReset: ${isReset})`);
            
            // Add immediate notification about points change
            setNotifications(prev => [
              {
                id: Date.now(),
                type: isReset ? 'warning' : (diff >= 0 ? 'success' : 'warning'),
                message: isReset 
                  ? `Your magic points have been RESET to 100 by admin!`
                  : (diff !== 0 
                  ? `Your magic points have been ${changeDirection} ${Math.abs(diff)}`
                    : `Your magic points have been updated to ${newPoints}`),
                timestamp: new Date(),
                pointsChange: diff
              },
              ...prev.slice(0, 9)
            ]);
            
            // Dispatch high priority event
            window.dispatchEvent(new CustomEvent('magicPointsUpdated', {
              detail: { 
                points: newPoints,
                source: 'serverSync',
                immediate: true,
                isReset: isReset
              }
            }));
            
            // Update user object with new points immediately
            setUser(prevUser => {
              if (!prevUser) return prevUser;
              
              const updatedUser = {
                ...prevUser,
                magicPoints: newPoints
              };
              
              localStorage.setItem('user', JSON.stringify(updatedUser));
              localStorage.setItem('magicPoints', newPoints.toString());
              
              return updatedUser;
            });
          }
        }
      }
    });
    
    // Optimize house_points_update handling
    socket.on('house_points_update', (data) => {
      console.log('[SOCKET] Received house points update:', data);
      setLastMessage({ type: 'house_points_update', data, timestamp: new Date() });
      
      // Skip for specific user types
      if (isAdminUser.current || user?.house === 'muggle' || !user?.house) {
        return;
      }
      
      // Add house points notification for relevant users
      if (data.house === user?.house) {
        const pointsChange = data.points;
        const isPositive = pointsChange > 0;
        const uniqueId = `house_points_${data.house}_${pointsChange}_${data.timestamp || Date.now()}`;
        const dedupeKey = `${data.house}:${pointsChange}:${data.criteria || ''}:${data.level || ''}`;
        
        // Get data fields with defaults
        const criteria = data.criteria || null;
        const level = data.level || null;
        const reason = data.reason || 'Admin action';
        
        // Skip duplicate notifications
        if (recentNotifications.current.has(dedupeKey)) {
          return;
        }
        
        // Mark as seen for deduplication
        recentNotifications.current.add(dedupeKey);
        
        // Format comprehensive message
        let fullMessage = `House ${data.house} has ${isPositive ? 'gained' : 'lost'} ${Math.abs(pointsChange)} points! New total: ${data.newTotal}`;
        if (criteria) fullMessage += `. Criteria: ${criteria}`;
        if (level) fullMessage += `. Level: ${level}`;
        if (reason && reason !== 'Admin action') fullMessage += `. Reason: ${reason}`;
        
        // Add notification immediately
        setNotifications(prev => {
          // Skip if very similar notification exists
          const similarExists = prev.some(n => 
            n.source === 'house_points_update' &&
            n.pointsChange === pointsChange &&
            n.criteria === criteria &&
            n.level === level &&
            (Date.now() - new Date(n.timestamp).getTime()) < 15000 // Within 15 seconds
          );
          
          if (similarExists) return prev;
          
          return [
            {
              id: uniqueId,
              type: isPositive ? 'success' : 'warning',
              title: isPositive ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
              message: fullMessage,
              timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
              pointsChange,
              reason,
              criteria,
              level,
              source: 'house_points_update',
              house: data.house
            },
            ...prev.slice(0, 9)
          ];
        });
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('housePointsUpdated', {
          detail: {
            house: data.house,
            points: pointsChange,
            newTotal: data.newTotal,
            reason,
            criteria,
            level,
            timestamp: data.timestamp || new Date().toISOString(),
            uniqueKey: dedupeKey
          }
        }));
      }
    });
    
    // Optimize admin_notification handling
    socket.on('admin_notification', (data) => {
      console.log('[SOCKET] Received admin notification:', data);
      setLastMessage({ type: 'admin_notification', data, timestamp: new Date() });
      
      // Skip if this notification should skip admins and the current user is an admin
      if ((data.skipAdmin === true || data.skipAdmin === "true") && isAdminUser.current) {
        return;
      }
      
      // Add to notifications immediately
      setNotifications(prev => [
        {
          id: Date.now(),
          type: data.notificationType || 'info',
          message: data.message,
          timestamp: new Date()
        },
        ...prev.slice(0, 9)
      ]);
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('adminNotification', {
        detail: data
      }));
    });
    
    // Handle global announcements
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