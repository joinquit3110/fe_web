import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useMagicPoints } from '../context/MagicPointsContext';
import axios from 'axios';
import { useToast } from '@chakra-ui/react'; // Added useToast import

// Constants
const ADMIN_USERS = ['hungpro', 'vipro'];
const ADMIN_PASSWORD = '31102004';
const API_URL = process.env.REACT_APP_API_URL || "https://be-web-6c4k.onrender.com/api";

// Create context
const AdminContext = createContext();

// Custom hook to use the admin context
export const useAdmin = () => useContext(AdminContext);

export const AdminProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { 
    magicPoints, 
    forceSync, 
    forceSyncWithDebug, 
    resetRevelioAttempts, 
    resetPoints 
  } = useMagicPoints();
  const toast = useToast(); // Initialized useToast

  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]); // Store notifications to be sent to users

  // Fetch all users from MongoDB
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get authentication token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Check if the token is valid first
      const authStatus = await axios.get(`${API_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Only proceed if authentication is valid
      if (!authStatus.data.authenticated) {
        throw new Error('Authentication invalid');
      }
      
      // Call the API to get real student data from MongoDB
      const response = await axios.get(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && Array.isArray(response.data.users)) {
        // Filter out admin users
        const filteredUsers = response.data.users.filter(u => !ADMIN_USERS.includes(u.username));
        setUsers(filteredUsers);
      } else {
        // Log the actual response for debugging
        console.error('API returned unexpected format:', response.data);
        setError('Failed to fetch users: API returned unexpected format');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if current user is an admin
  useEffect(() => {
    if (isAuthenticated && user) {
      // Check multiple ways to determine if user is admin
      const isAdminUser = 
        // Check username against hardcoded admin list
        ADMIN_USERS.includes(user.username) ||
        // Check isAdmin flag from token/user object
        user.isAdmin === true ||
        // Check role field
        user.role === 'admin' ||
        // Check house field
        user.house === 'admin';
      
      console.log('[AdminContext] Admin check:', { 
        username: user.username, 
        isInAdminList: ADMIN_USERS.includes(user.username),
        isAdminFlag: user.isAdmin,
        role: user.role,
        house: user.house,
        result: isAdminUser
      });
      
      setIsAdmin(isAdminUser);
      
      // If admin, fetch users
      if (isAdminUser) {
        fetchUsers();
      }
    } else {
      setIsAdmin(false);
    }
  }, [isAuthenticated, user, fetchUsers]);

  // Assign house to user in MongoDB with improved handling
  const assignHouse = async (userId, house) => {
    setLoading(true);
    setError(null);
    
    // Handle missing userId
    if (!userId) {
      console.error('Error: userId is undefined or null');
      setError('Missing user ID. Cannot update house.');
      setLoading(false);
      return false;
    }
    
    try {
      // Get authentication token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      console.log(`Making API call to update house for user ${userId} to ${house}`);
      
      // Call the API to update house in MongoDB
      const response = await axios.patch(`${API_URL}/users/${userId}`, 
        { house },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status === 200 || response.status === 204) {
        // Update local state after successful API call
        setUsers(prevUsers => 
          prevUsers.map(user => 
            (user.id === userId || user._id === userId) ? { ...user, house } : user
          )
        );
        
        // Force a sync for the user to ensure they get the house change immediately
        console.log(`House updated in MongoDB for user ${userId}: ${house}. Triggering sync.`);
        
        // Force sync for the specific user
        await forceSyncForUsers([userId]);
        
        // For admin users, ensure proper house setting
        const adminUsers = ['hungpro', 'vipro'];
        const targetUser = users.find(u => u.id === userId || u._id === userId);
        
        if (targetUser && adminUsers.includes(targetUser.username) && house !== 'admin') {
          console.log(`Warning: Admin user ${targetUser.username} should have admin house.`);
        }
        
        return true;
      } else {
        throw new Error(`Failed to update house: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error assigning house:', err);
      setError('Failed to assign house: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Handle selection of users
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Select all users
  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.id));
    }
  };

  // Reset points for selected users
  const resetPointsForUsers = async (userIds = []) => {
    setLoading(true);
    setError(null);
    
    try {
      // If no userIds provided, use selectedUsers
      const targetUserIds = userIds.length > 0 ? userIds : selectedUsers;
      
      if (targetUserIds.length === 0) {
        throw new Error('No users selected');
      }
      
      // Get authentication token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Get user info if available - helps with debugging
      const userStr = localStorage.getItem('user');
      const userInfo = userStr ? JSON.parse(userStr) : {};
      console.log('Current user info:', userInfo);
      
      // Log auth header to help with debugging
      console.log('Using auth header:', `Bearer ${token.substring(0, 10)}...`);
      
      try {
        // Call backend to reset points for these users
        const response = await axios.post(`${API_URL}/users/bulk-update`, 
          { 
            userIds: targetUserIds,
            magicPoints: 100,
            reason: 'Points reset by admin'
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('Reset points response:', response.data);
        
        // Update local state to reflect changes
        setUsers(prevUsers => 
          prevUsers.map(user => 
            targetUserIds.includes(user._id || user.id) 
              ? { ...user, magicPoints: 100 } 
              : user
          )
        );
        
        // Force sync all users who had points reset
        await forceSyncForUsers(targetUserIds);
        
        // Refresh user data
        await fetchUsers();
        
        return true;
      } catch (apiError) {
        // Enhanced error handling with more detail
        console.error('API Error in resetPointsForUsers:', apiError);
        
        if (apiError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('API Error details:', {
            status: apiError.response.status,
            headers: apiError.response.headers,
            data: apiError.response.data
          });
          
          if (apiError.response.status === 403) {
            // Try to reauthenticate - the token might be expired or invalid
            throw new Error('Authentication failed: You do not have admin privileges or your session has expired. Please log out and log back in.');
          } else if (apiError.response.status === 401) {
            throw new Error('Authentication required: Your session has expired. Please log out and log back in.');
          } else {
            throw new Error(`Server error: ${apiError.response.data?.message || apiError.message || 'Unknown error'}`);
          }
        } else if (apiError.request) {
          // The request was made but no response was received
          throw new Error('Network error: No response received from server. Please check your internet connection.');
        } else {
          // Something happened in setting up the request that triggered an Error
          throw new Error(`Request error: ${apiError.message}`);
        }
      }
    } catch (err) {
      console.error('Error resetting points:', err);
      setError(err.message || 'Failed to reset points');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Reset attempts for selected users
  const resetAttemptsForUsers = async (userIds = []) => {
    setLoading(true);
    setError(null);
    
    try {
      // If no userIds provided, use selectedUsers
      const targetUserIds = userIds.length > 0 ? userIds : selectedUsers;
      
      if (targetUserIds.length === 0) {
        throw new Error('No users selected');
      }
      
      // Get authentication token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Call backend API to mark users for sync with resetAttempts flag
      const response = await axios.post(`${API_URL}/users/bulk-update`, 
        { 
          userIds: targetUserIds,
          resetAttempts: true,
          needsSync: true,
          reason: 'Attempts reset by admin' 
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Reset attempts response:', response.data);
      
      // Force sync all affected users to ensure they get updated
      await forceSyncForUsers(targetUserIds);
      
      // Also reset local revelioAttempts if available
      if (resetRevelioAttempts) {
        resetRevelioAttempts();
      }
      
      // Refresh user data
      await fetchUsers();
      
      return true;
    } catch (err) {
      console.error('Error resetting attempts:', err);
      setError(err.message || 'Failed to reset attempts');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Force sync for selected users - enhanced with API integration
  const forceSyncForUsers = async (userIds = []) => {
    setLoading(true);
    setError(null);
    
    try {
      // If no userIds provided, use selectedUsers
      const targetUserIds = userIds.length > 0 ? userIds : selectedUsers;
      
      if (targetUserIds.length === 0) {
        throw new Error('No users selected');
      }
      
      // Get authentication token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Call the backend API to trigger server-side sync for these users
      const response = await axios.post(`${API_URL}/users/force-sync`, 
        { userIds: targetUserIds },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Also run local force sync for the admin's own data
      if (forceSync) {
        await forceSync();
      }
      
      // Refresh user data
      await fetchUsers();
      
      return true;
    } catch (err) {
      console.error('Error forcing sync:', err);
      setError(err.message || 'Failed to force sync');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update points for all users in a specific house
  const updateHousePoints = async (house, pointsChange, reason) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get authentication token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Filter users by house
      const houseUsers = users.filter(user => user.house === house);
      
      if (houseUsers.length === 0) {
        console.warn(`No users found locally for house: ${house}. The operation will target users on the backend.`);
      }
      
      const userIds = houseUsers.map(user => user._id || user.id).filter(id => id);

      if (userIds.length === 0) {
        toast({
          title: 'No Users Found',
          description: `No users were found locally for house ${house}. Points not updated.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        setLoading(false);
        return false;
      }
      
      console.log(`[AdminContext] Updating ${pointsChange} points for ${userIds.length} users in house ${house}. Reason: ${reason}`);

      // Debug the token being used
      console.log(`[AdminContext] Token prefix: ${token.substring(0, 20)}...`);
      
      // Skip admin operations if using a fake token
      if (token.startsWith('admin-token-')) {
        console.error('[AdminContext] Invalid admin token detected (fake client-side token). Please log in properly using the Login component.');
        toast({
          title: 'Invalid Admin Token',
          description: 'You are using a client-side generated token which will not authenticate with the server. Please log in again properly.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        throw new Error('Invalid admin token. Please log in properly.');
      }

      // Verify user authentication status before proceeding
      const authCheckResponse = await axios.get(`${API_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`[AdminContext] Auth verification result:`, authCheckResponse.data);

      if (!authCheckResponse.data.authenticated) {
        throw new Error('Authentication verification failed. Please try logging in again.');
      }
      
      // Explicitly check admin status
      if (!authCheckResponse.data.isAdmin) {
        console.error('[AdminContext] User is authenticated but lacks admin privileges:', authCheckResponse.data);
        toast({
          title: 'Admin Privileges Required',
          description: 'Your account is authenticated but lacks admin privileges required for this action.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        throw new Error('Admin privileges required for this operation.');
      }

      // Call the backend's bulk-update endpoint
      const response = await axios.post(`${API_URL}/users/bulk-update`, 
        { 
          house,
          pointsChange,
          reason: reason || 'House points update by admin',
          targetUserIdsForHousePoints: userIds
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.success) {
        toast({
          title: 'House Points Updated',
          description: `${response.data.updated || 0} users in ${house} had their points adjusted by ${pointsChange}. Reason: ${reason}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        await fetchUsers();

      } else {
        throw new Error(response.data.message || 'Failed to update house points via bulk operation.');
      }
      
      return true;
    } catch (err) {
      console.error('Error updating house points:', err);
      setError(err.message || 'Failed to update house points');
      toast({
        title: 'Error Updating Points',
        description: err.message || 'An unknown error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Group criteria points system
  const criteriaPoints = {
    excellent: 15,
    good: 10,
    satisfactory: 5,
    poor: -5,
    veryPoor: -10,
  };

  // Define criteria types and performance levels with standardized options
  const criteriaTypes = [
    { value: 'participation', label: 'Level of participation of group members' },
    { value: 'english', label: 'Level of English usage in the group' },
    { value: 'completion', label: 'Time taken by the group to complete tasks' }
  ];

  const performanceLevels = [
    { value: 'excellent', label: 'Excellent', points: 15 },
    { value: 'good', label: 'Good', points: 10 },
    { value: 'satisfactory', label: 'Satisfactory', points: 5 },
    { value: 'poor', label: 'Poor', points: -5 },
    { value: 'veryPoor', label: 'Very Poor', points: -10 }
  ];

  // Define fetchHouses function to fix undefined variable
  const fetchHouses = async () => {
    // Get token
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return;
    
    try {
      // Fetch updated house information if API available
      const response = await axios.get(`${API_URL}/houses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (err) {
      console.error('Error fetching houses:', err);
      // Silently fail - non-critical operation
      return null;
    }
  };

  // Find criteria & level from points rules based on criteria type and level
  const getCriteriaAndLevelLabels = (criteriaType, performanceLevel) => {
    const criteria = criteriaTypes.find(c => c.value === criteriaType);
    const level = performanceLevels.find(l => l.value === performanceLevel);
    
    return {
      criteriaLabel: criteria ? criteria.label : '',
      levelLabel: level ? level.label : ''
    };
  };

  // Update points based on group criteria
  const updateGroupCriteriaPoints = async (house, criteriaType, performanceLevel, details) => {
    if (!house || !criteriaType || !performanceLevel) {
      throw new Error('Missing required fields');
    }

    try {
      // Find performance level information
      const selectedPerformance = performanceLevels.find(p => p.value === performanceLevel);
      if (!selectedPerformance) {
        throw new Error('Invalid performance level');
      }

      // Find criteria information
      const selectedCriteria = criteriaTypes.find(c => c.value === criteriaType);
      if (!selectedCriteria) {
        throw new Error('Invalid criteria type');
      }

      // Get the criteria and level labels
      const { criteriaLabel, levelLabel } = getCriteriaAndLevelLabels(criteriaType, performanceLevel);
      
      // Make reason optional - only include if provided by user
      const userReason = details ? details.trim() : null;
      
      // Create a system-generated reason with criteria and level
      const systemInfo = `Criteria: ${criteriaLabel}. Level: ${levelLabel}.`;
      
      // Get authentication token
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Filter users by house
      const houseUsers = users.filter(user => user.house === house);
      
      if (houseUsers.length === 0) {
        throw new Error(`No users found in house: ${house}`);
      }
      
      const userIds = houseUsers.map(user => user._id || user.id);
      const pointsChange = selectedPerformance.points;
      
      // Update points in the database first - this is the critical operation
      const updatedUserIds = []; // Keep track of successfully updated users
      
      for (const userId of userIds) {
        try {
          // Get current user's points
          const userResponse = await axios.get(`${API_URL}/users/${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const user = userResponse.data;
          const currentPoints = user.magicPoints || 0;
          const newPoints = Math.max(0, currentPoints + pointsChange); // Ensure points don't go below 0
          
          // Create the final reason that will be stored in the database
          // If user provided a reason, include it followed by the system info
          const finalReason = userReason ? `${userReason}. ${systemInfo}` : systemInfo;
          
          // Update user's points
          await axios.patch(`${API_URL}/users/${userId}`, 
            { 
              magicPoints: newPoints,
              lastPointsUpdate: new Date().toISOString(),
              lastUpdateReason: finalReason // Use the combined reason
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          // Add to successful list
          updatedUserIds.push(userId);
        } catch (userError) {
          console.error(`Error updating points for user ${userId}:`, userError);
          // Continue with other users even if one fails
        }
      }
      
      // Only try to send notification if points were updated successfully
      if (updatedUserIds.length > 0) {
        try {
          // Direct socket notification approach
          if (window.socket && typeof window.socket.emit === 'function') {
            console.log('Sending group criteria house_points_update via socket');
            window.socket.emit('client_house_notification', {
              house,
              points: pointsChange,
              reason: userReason, // Optional user-provided reason
              criteria: criteriaLabel,
              level: levelLabel,
              newTotal: houseUsers.reduce((total, user) => 
                total + Math.max(0, (user.magicPoints || 0) + pointsChange), 0),
              timestamp: new Date().toISOString()
            });
          }
          
          // Dispatch a custom event for local notification display
          const notificationEvent = new CustomEvent('house-points-update', {
            detail: {
              house,
              points: pointsChange,
              reason: userReason, // Optional user-provided reason
              criteria: criteriaLabel,
              level: levelLabel,
              timestamp: new Date().toISOString()
            }
          });
          window.dispatchEvent(notificationEvent);
          
          // Force sync for all affected users
          try {
            await axios.post(`${API_URL}/users/force-sync`, 
              { userIds: updatedUserIds },
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log('Force sync initiated for updated users');
          } catch (syncError) {
            console.error('Error initiating sync (non-critical):', syncError);
          }
        } catch (postUpdateError) {
          console.error('Error in post-update operations:', postUpdateError);
          // Don't throw here - the points were already updated successfully
        }
      }
      
      // Update local state to reflect changes
      setUsers(prevUsers => 
        prevUsers.map(user => 
          userIds.includes(user._id || user.id) 
            ? { ...user, magicPoints: Math.max(0, (user.magicPoints || 0) + pointsChange) } 
            : user
        )
      );

      return updatedUserIds.length > 0;
    } catch (err) {
      console.error('Error updating group criteria points:', err);
      throw err;
    }
  };

  const sendAppNotification = async (message, type = 'success', user_id = null, typeDetails = null) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Create a standardized payload format that matches backend expectations
      const payload = {
        message,
        type,
        title: typeDetails?.title || (type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Notification'),
        // Required fields with consistent types (use strings where appropriate)
        targetUsers: user_id ? [user_id.toString()] : [],
        housesAffected: typeDetails?.housesAffected?.map(h => h.toString()) || [],
        targetHouse: typeDetails?.house || null,
        // Make sure numeric values are sent as strings
        pointsChange: typeDetails?.pointsChange ? typeDetails.pointsChange.toString() : null,
        // Other fields
        reason: typeDetails?.reason || null,
        criteria: typeDetails?.criteria || null,
        level: typeDetails?.level || null,
        house: typeDetails?.house || null,
        // Make sure any boolean values are passed as strings
        skipAdmin: "true"
      };

      console.log('Sending notification payload:', payload);

      const response = await axios.post(`${API_URL}/notifications`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Notification sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending notification:', error);
      // If available, log the detailed response
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        console.error('Server message:', error.response.data?.message);
      }
      
      // Store notification locally as fallback
      const pendingNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
      
      const fallbackNotification = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message,
        type,
        title: typeDetails?.title || (type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Notification'),
        timestamp: Date.now(),
        clientFallback: true,
        // Include these fields explicitly with consistent types
        targetUsers: user_id ? [user_id.toString()] : [],
        housesAffected: typeDetails?.housesAffected?.map(h => h.toString()) || [],
        reason: typeDetails?.reason || null,
        criteria: typeDetails?.criteria || null,
        level: typeDetails?.level || null,
        house: typeDetails?.house || null,
        pointsChange: typeDetails?.pointsChange ? typeDetails.pointsChange.toString() : null,
        skipAdmin: "true"
      };
      
      pendingNotifications.push(fallbackNotification);
      localStorage.setItem('pendingNotifications', JSON.stringify(pendingNotifications));
      console.log('Saved notification to local fallback system:', fallbackNotification);
      
      return false;
    }
  };

  // Send notifications for criteria
  const sendCriteriaNotification = async (criteria, level, reason, user_id = null) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Generate appropriate message based on criteria
      let message = `${criteria} criteria has been updated to level ${level}`;
      if (reason) {
        message += `: ${reason}`;
      }

      // Create a standardized notification payload that matches backend expectations
      const payload = {
        message,
        type: 'criteria',
        title: `Criteria Updated: ${criteria}`,
        // Include these fields directly in the top-level payload as strings
        reason: reason || null,
        criteria: criteria,
        level: level,
        // These fields are required by backend with proper types
        targetUsers: user_id ? [user_id.toString()] : [],
        housesAffected: [], // Empty array for no specific house affected
        targetHouse: null,
        // Make sure skipAdmin is a string
        skipAdmin: "true",
        // Include the typeDetails as simple objects with string values
        typeDetails: {
          criteria: criteria,
          level: level,
          reason: reason || null
        },
        // Add metadata for debugging
        meta: {
          timestamp: new Date().toISOString(),
          source: 'criteria_notification'
        }
      };

      console.log('Sending criteria notification payload:', payload);

      const response = await axios.post(`${API_URL}/notifications`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Criteria notification sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending criteria notification:', error);
      // If available, log the detailed response
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        console.error('Server message:', error.response.data?.message);
      }
      
      // Store notification locally as fallback
      const pendingNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
      
      // Generate appropriate message based on criteria
      let message = `${criteria} criteria has been updated to level ${level}`;
      if (reason) {
        message += `: ${reason}`;
      }
      
      const fallbackNotification = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message,
        type: 'criteria',
        title: `Criteria Updated: ${criteria}`,
        timestamp: Date.now(),
        clientFallback: true,
        // Include these fields with consistent types
        reason: reason || null,
        criteria: criteria,
        level: level,
        targetUsers: user_id ? [user_id.toString()] : [],
        housesAffected: [],
        skipAdmin: "true",
        // Include the typeDetails with strings
        typeDetails: {
          criteria: criteria,
          level: level,
          reason: reason || null
        }
      };
      
      pendingNotifications.push(fallbackNotification);
      localStorage.setItem('pendingNotifications', JSON.stringify(pendingNotifications));
      console.log('Saved criteria notification to local fallback system:', fallbackNotification);
      
      return false;
    }
  };

  return (
    <AdminContext.Provider value={{
      isAdmin,
      users,
      selectedUsers,
      loading,
      error,
      fetchUsers,
      assignHouse,
      toggleUserSelection,
      selectAllUsers,
      resetPointsForUsers,
      resetAttemptsForUsers,
      forceSyncForUsers,
      updateHousePoints,
      updateGroupCriteriaPoints,
      criteriaPoints,
      notifications,
      sendAppNotification,
      sendCriteriaNotification
    }}>
      {children}
    </AdminContext.Provider>
  );
};