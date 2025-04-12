import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// Constants for sync intervals
const USER_SYNC_INTERVAL = 30000; // 30 seconds
const OFFLINE_RETRY_INTERVAL = 60000; // 1 minute
const SYNC_TIMEOUT = 10000; // 10 seconds

/**
 * UserSyncManager - Handles real-time synchronization of user data
 * 
 * This component doesn't render anything visible but manages:
 * 1. Periodic synchronization of user data from server
 * 2. Triggers userDataChanged events when updates happen
 * 3. Handles reconnection when coming online
 */
const UserSyncManager = () => {
  const { user, setUser, isAuthenticated, authToken } = useAuth();
  const toast = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);
  const previousUserRef = useRef(user);
  const syncInProgressRef = useRef(false);

  // Function to sync user data with server
  const syncUserData = useCallback(async (showNotification = false) => {
    // If not authenticated or sync already in progress, don't proceed
    if (!isAuthenticated || !authToken || syncInProgressRef.current) return;
    
    syncInProgressRef.current = true;
    
    try {
      // Get user data from server
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/users/me`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          timeout: SYNC_TIMEOUT,
        }
      );
      
      const serverUser = response.data;
      
      // If user data has changed, update local state
      if (serverUser && JSON.stringify(serverUser) !== JSON.stringify(user)) {
        // Store previous house value for comparison
        const prevHouse = user?.house;
        const newHouse = serverUser.house;
        
        // Update user in context
        setUser(serverUser);
        
        // Show notification if enabled and house has changed
        if (showNotification && prevHouse && newHouse && prevHouse !== newHouse) {
          toast({
            title: 'House Assignment Updated',
            description: `You have been ${prevHouse ? 'reassigned' : 'assigned'} to ${newHouse.charAt(0).toUpperCase() + newHouse.slice(1)}!`,
            status: 'info',
            duration: 5000,
            isClosable: true,
            position: 'top-right',
          });
        }
        
        // Show points notification if points have changed
        if (showNotification && 
            user?.points !== undefined && 
            serverUser.points !== undefined && 
            user.points !== serverUser.points) {
          const pointsDiff = serverUser.points - user.points;
          if (pointsDiff !== 0) {
            toast({
              title: `House Points ${pointsDiff > 0 ? 'Awarded' : 'Deducted'}`,
              description: `${Math.abs(pointsDiff)} points have been ${pointsDiff > 0 ? 'awarded to' : 'deducted from'} your house!`,
              status: pointsDiff > 0 ? 'success' : 'warning',
              duration: 5000,
              isClosable: true,
              position: 'top-right',
            });
          }
        }
        
        // Update last sync time
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
      if (showNotification) {
        toast({
          title: 'Sync Error',
          description: 'Unable to sync your profile with the server.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isAuthenticated, authToken, user, setUser, toast]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncUserData(true); // Force sync when coming back online
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncUserData]);

  // Set up periodic sync
  useEffect(() => {
    if (!isOnline) return;
    
    const intervalId = setInterval(() => {
      syncUserData(false);
    }, USER_SYNC_INTERVAL);
    
    // Initial sync on component mount
    syncUserData(false);
    
    return () => clearInterval(intervalId);
  }, [syncUserData, isOnline]);
  
  // Force sync handler that can be exposed to other components
  useEffect(() => {
    // Adds the syncUserData function to the window object so 
    // it can be called from outside React components
    window.forceUserSync = () => syncUserData(true);
    
    return () => {
      delete window.forceUserSync;
    };
  }, [syncUserData]);
  
  // This component doesn't render anything visible
  return null;
};

export default UserSyncManager; 