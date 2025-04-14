import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = "https://inequality-web-api.onrender.com";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now());
  const { user, isAuthenticated } = useAuth();
  const isAdminUser = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    newSocket.on('connect', () => {
      console.log('[SOCKET] Connected');
      setIsConnected(true);
      setConnectionQuality('good');
      
      // Authenticate socket with user data
      if (user?.id && user?.house) {
        newSocket.emit('authenticate', {
          userId: user.id,
          house: user.house
        });
      }
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error);
      setConnectionQuality('poor');
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      setIsConnected(false);
      setConnectionQuality('disconnected');
    });
    
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated, user]);
  
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    const interval = setInterval(() => {
        socket.emit('heartbeat');
      setLastHeartbeat(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, [socket, isConnected]);
  
  const value = {
        socket,
        isConnected,
        lastMessage,
    connectionQuality,
    lastHeartbeat
};

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};