import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

export const useRealTimeUpdates = (onUpdate) => {
  const socket = useSocket();
  const debounceTimer = useRef(null);

  const handleUpdate = useCallback((data) => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce updates to prevent rapid re-renders
    debounceTimer.current = setTimeout(() => {
      onUpdate(data);
    }, 100);
  }, [onUpdate]);

  useEffect(() => {
    if (!socket) return;

    // Set up optimized event listeners
    socket.on('points:update', handleUpdate);
    socket.on('house:update', handleUpdate);
    socket.on('status:update', handleUpdate);

    // Batch multiple updates
    socket.on('batch:update', (updates) => {
      const batchedUpdates = updates.reduce((acc, update) => ({
        ...acc,
        ...update
      }), {});
      handleUpdate(batchedUpdates);
    });

    return () => {
      // Cleanup listeners and timer
      socket.off('points:update', handleUpdate);
      socket.off('house:update', handleUpdate);
      socket.off('status:update', handleUpdate);
      socket.off('batch:update');
      
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [socket, handleUpdate]);
};