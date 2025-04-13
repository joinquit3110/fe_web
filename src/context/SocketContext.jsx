import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
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
      
      // Dispatch a custom event to allow components to react IMMEDIATELY
      const event = new CustomEvent('serverSyncUpdate', {
        detail: { type: 'sync_update', data }
      });
      window.dispatchEvent(event);
      
      // Enhanced user update handling with immediate effect
      if (data.type === 'user_update' && data.data?.updatedFields) {
        const updatedFields = data.data.updatedFields;
        
        // If house was updated, update the user object directly
        if (updatedFields.house && user) {
          console.log(`[SOCKET] House updated from server: ${updatedFields.house}`);
          
          // Update user object in AuthContext with high priority
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
          const changeDirection = diff > 0 ? 'increased by' : 'decreased by';
          
          if (!isNaN(newPoints)) {
            console.log(`[SOCKET] Magic points updated from server: ${newPoints} (change: ${diff})`);
            
            // Add notification about points change with more specific information
            setNotifications(prev => [
              {
                id: Date.now(),
                type: diff >= 0 ? 'success' : 'warning',
                message: diff !== 0 
                  ? `Your magic points have been ${changeDirection} ${Math.abs(diff)} by admin. New total: ${newPoints}`
                  : `Your magic points have been updated to ${newPoints}`,
                timestamp: new Date()
              },
              ...prev.slice(0, 9)
            ]);
            
            // Dispatch a custom event for MagicPointsContext with high priority flag
            const pointsEvent = new CustomEvent('magicPointsUpdated', {
              detail: { 
                points: newPoints,
                source: 'serverSync',
                immediate: true
              }
            });
            window.dispatchEvent(pointsEvent);
            
            // Update user object with new points
            setUser(prevUser => {
              if (!prevUser) return prevUser;
              
              const updatedUser = {
                ...prevUser,
                magicPoints: newPoints
              };
              
              localStorage.setItem('user', JSON.stringify(updatedUser));
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
      
      // Add notification about house points change
      if (data.house === user?.house) {
        const pointsChange = data.points;
        const isPositive = pointsChange > 0;
        
        setNotifications(prev => [
          {
            id: Date.now(),
            type: isPositive ? 'success' : 'warning',
            message: `House ${data.house} has ${isPositive ? 'gained' : 'lost'} ${Math.abs(pointsChange)} points! New total: ${data.newTotal}`,
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
        
        // Dispatch event for house points update
        const housePointsEvent = new CustomEvent('housePointsUpdated', {
          detail: {
            house: data.house,
            points: pointsChange,
            newTotal: data.newTotal,
            reason: data.reason || 'Admin action'
          }
        });
        window.dispatchEvent(housePointsEvent);
      }
    });
    
    // Listen for admin_notification - sent by admin to specific users or houses
    socket.on('admin_notification', (data) => {
      console.log('[SOCKET] Received admin notification:', data);
      setLastMessage({ type: 'admin_notification', data, timestamp: new Date() });
      
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
      
      // Play notification sound if enabled
      const notificationSound = document.getElementById('notification-sound');
      if (notificationSound) {
        notificationSound.play().catch(e => console.log('Could not play notification sound'));
      }
      
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
      
      // Play announcement sound if enabled
      const announcementSound = document.getElementById('announcement-sound');
      if (announcementSound) {
        announcementSound.play().catch(e => console.log('Could not play announcement sound'));
      }
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
      
      {/* Add hidden audio elements for notification sounds */}
      <audio id="notification-sound" preload="auto" style={{ display: 'none' }}>
        <source src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3" type="audio/mpeg" />
      </audio>
      <audio id="announcement-sound" preload="auto" style={{ display: 'none' }}>
        <source src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=interface-notification-sound-140735.mp3" type="audio/mpeg" />
      </audio>
    </SocketContext.Provider>
  );
};