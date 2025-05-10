import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const MagicPointsContext = createContext();

export const MagicPointsProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const { isAuthenticated, token } = useAuth();
  const [points, setPoints] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loadingPoints, setLoadingPoints] = useState(true);

  // Fetch points from the server
  const fetchPoints = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setLoadingPoints(false);
      return;
    }
    
    try {
      setLoadingPoints(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/points/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPoints(data.points || 0);
        setLastUpdate(new Date());
      } else {
        console.error('Failed to fetch points:', response.status);
      }
    } catch (error) {
      console.error('Error fetching points:', error);
    } finally {
      setLoadingPoints(false);
    }
  }, [isAuthenticated, token]);

  // Listen for socket events related to points
  useEffect(() => {
    if (socket && isConnected) {
      const handlePointsUpdate = (data) => {
        console.log('Points updated via socket:', data);
        setPoints(data.points || 0);
        setLastUpdate(new Date());
      };
      
      socket.on('points:update', handlePointsUpdate);
      
      // Request an immediate update when socket connects
      socket.emit('points:getBalance');
      
      return () => {
        socket.off('points:update', handlePointsUpdate);
      };
    }
  }, [socket, isConnected]);

  // Initial points fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchPoints();
    } else {
      setPoints(0);
      setLoadingPoints(false);
    }
  }, [isAuthenticated, fetchPoints]);

  // Refetch points when connection status changes
  useEffect(() => {
    if (isConnected && isAuthenticated) {
      fetchPoints();
    }
  }, [isConnected, isAuthenticated, fetchPoints]);

  // If we're authenticated but offline, retry connection and points fetch periodically
  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      const timer = setTimeout(() => {
        fetchPoints();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isConnected, fetchPoints]);

  return (
    <MagicPointsContext.Provider
      value={{
        points,
        loadingPoints,
        lastUpdate,
        refreshPoints: fetchPoints,
      }}
    >
      {children}
    </MagicPointsContext.Provider>
  );
};

export const useMagicPoints = () => useContext(MagicPointsContext);
