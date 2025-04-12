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
  const { user, isAuthenticated } = useAuth();
  
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

  // Enhanced socket event handling
  useEffect(() => {
    if (!socket) return;

    // Listen for sync_update - targeted to this specific user
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      
      // Dispatch a custom event to allow MagicPointsContext to react
      const event = new CustomEvent('magicPointsSocketUpdate', {
        detail: { type: 'sync_update', data }
      });
      window.dispatchEvent(event);
      
      // Add to notifications if appropriate
      if (data.type === 'user_update') {
        const updatedFields = data.data?.updatedFields || {};
        let message = 'Your profile has been updated by an admin';
        
        // More specific messages based on what changed
        if (updatedFields.house) {
          message = `Your house has been updated to ${updatedFields.house}`;
        } else if (updatedFields.magicPoints !== undefined) {
          message = `Your magic points have been updated to ${updatedFields.magicPoints}`;
        }
        
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'info',
            message,
            timestamp: new Date()
          },
          ...prev.slice(0, 9) 
        ]);
      } else if (data.type === 'force_sync') {
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'info',
            message: data.message || 'Syncing data with server...',
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
      }
    });

    // Listen for house_update - for house-wide events
    socket.on('house_update', (data) => {
      console.log('[SOCKET] Received house update:', data);
      setLastMessage({ type: 'house_update', data, timestamp: new Date() });
      
      // Dispatch custom event for MagicPointsContext
      const event = new CustomEvent('magicPointsSocketUpdate', {
        detail: { type: 'house_update', data }
      });
      window.dispatchEvent(event);
      
      // For house points changes
      if (data.type === 'house_points_changed' || data.type === 'member_points_changed') {
        const message = data.reason || 
                       (data.pointsChange ? 
                        `House points ${data.pointsChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.pointsChange)}` : 
                        'House points updated');
                        
        setNotifications(prev => [
          {
            id: Date.now(),
            type: data.pointsChange > 0 ? 'success' : 'warning',
            message,
            timestamp: new Date()
          },
          ...prev.slice(0, 9)
        ]);
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

    return () => {
      // Remove all listeners when component unmounts or socket changes
      socket.off('sync_update');
      socket.off('house_update');
      socket.off('global_update');
      socket.off('connection_status');
    };
  }, [socket]);

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