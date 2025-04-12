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
        // console.log('[SOCKET] Heartbeat sent'); // Uncomment for debugging
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
        oldHouse: userHouse !== user.house ? userHouse : null,
        newHouse: user.house
      });
    }
  }, [socket, isConnected, user?.house, userHouse]);

  // Enhanced socket event handling - now with user state updating capability
  useEffect(() => {
    if (!socket) return;

    // Listen for sync_update - targeted to this specific user
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      
      // Dispatch a custom event to allow MagicPointsContext to react IMMEDIATELY
      const event = new CustomEvent('magicPointsSocketUpdate', {
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
          
          if (!isNaN(newPoints)) {
            console.log(`[SOCKET] Magic points updated from server: ${newPoints}`);
            
            // Add notification about points change
            setNotifications(prev => [
              {
                id: Date.now(),
                type: 'info',
                message: `Your magic points have been updated to ${newPoints}`,
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
          }
        }
      }
      
      // Handle special reset_attempts notification
      if (data.type === 'reset_attempts') {
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'warning',
            message: data.message || 'Your attempts have been reset by admin',
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
      }
      
      // Handle force_sync notification
      if (data.type === 'force_sync') {
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'info',
            message: 'Admin requested sync - updating your data...',
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
      }
    });

    // Listen for house_update - events in the user's house room
    socket.on('house_update', (data) => {
      console.log('[SOCKET] Received house update:', data);
      setLastMessage({ type: 'house_update', data, timestamp: new Date() });
      
      // Dispatch custom event for MagicPointsContext with immediate flag
      const event = new CustomEvent('magicPointsSocketUpdate', {
        detail: { type: 'house_update', data, immediate: true }
      });
      window.dispatchEvent(event);
      
      // Add notification for points changes
      if (data.type === 'house_points_changed' || data.type === 'member_points_changed') {
        const message = data.message || 
          `${data.username || 'Someone'} in ${data.house} ${data.pointsChange > 0 ? 'earned' : 'lost'} ${Math.abs(data.pointsChange || 0)} points`;
        
        setNotifications(prev => [
          {
            id: Date.now(),
            type: data.pointsChange > 0 ? 'success' : 'warning',
            message,
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
        
        // Force an immediate check for updated points if this affects the user's house
        if (user?.house === data.house) {
          // Immediate update without delay
          const pointsEvent = new CustomEvent('checkHousePointsUpdate', {
            detail: { house: data.house, immediate: true }
          });
          window.dispatchEvent(pointsEvent);
        }
      }
    });

    // Listen for global_update - system-wide events
    socket.on('global_update', (data) => {
      console.log('[SOCKET] Received global update:', data);
      setLastMessage({ type: 'global_update', data, timestamp: new Date() });
      
      // Dispatch custom event for MagicPointsContext
      const event = new CustomEvent('magicPointsSocketUpdate', {
        detail: { type: 'global_update', data }
      });
      window.dispatchEvent(event);
      
      // Add notification
      setNotifications(prev => [
        {
          id: Date.now(),
          type: 'info',
          message: data.message || 'System update received',
          timestamp: new Date()
        },
        ...prev.slice(0, 9)
      ]);
    });

    // Listen for connection_status updates
    socket.on('connection_status', (data) => {
      console.log('[SOCKET] Connection status update:', data);
      setConnectionQuality(data.quality || 'good');
      
      if (data.message) {
        setNotifications(prev => [
          {
            id: Date.now(), 
            type: data.quality === 'poor' ? 'warning' : 'info',
            message: data.message,
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
      }
    });

    return () => {
      socket.off('sync_update');
      socket.off('house_update');
      socket.off('global_update');
      socket.off('connection_status');
    };
  }, [socket, user, setUser]);

  // Extract user ID and house from user object
  const userId = user?.id || user?._id;
  const userHouse = user?.house;
  
  // Add a manual sync function for the user to trigger
  const requestSync = useCallback(() => {
    if (socket && isConnected) {
      console.log('[SOCKET] Manually requesting sync');
      socket.emit('request_sync');
      return true;
    }
    console.log('[SOCKET] Cannot request sync - not connected');
    return false;
  }, [socket, isConnected]);

  // Context value
  const value = {
    socket,
    isConnected,
    connectionQuality,
    lastMessage,
    notifications,
    clearNotifications: () => setNotifications([]),
    removeNotification: (id) => setNotifications(prev => prev.filter(notif => notif.id !== id)),
    userId,
    userHouse,
    requestSync,
    lastHeartbeat
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};