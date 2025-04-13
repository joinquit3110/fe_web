import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useMagicPoints } from '../context/MagicPointsContext';
import axios from 'axios';

// Constants
const ADMIN_USERS = ['hungpro', 'vipro'];
const ADMIN_PASSWORD = '31102004';
const API_URL = "https://be-web-6c4k.onrender.com/api";

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
      const isAdminUser = ADMIN_USERS.includes(user.username);
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
        throw new Error(`No users found in house: ${house}`);
      }
      
      const userIds = houseUsers.map(user => user._id || user.id);
      
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
          
          // Update user's points
          await axios.patch(`${API_URL}/users/${userId}`, 
            { 
              magicPoints: newPoints,
              lastPointsUpdate: new Date().toISOString(),
              lastUpdateReason: reason
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
          // Create a notification for users - simplified format for better compatibility
          const notification = {
            type: pointsChange > 0 ? 'success' : 'warning',
            title: pointsChange > 0 ? 'Points Awarded!' : 'Points Deducted!',
            message: `${Math.abs(pointsChange)} points ${pointsChange > 0 ? 'awarded to' : 'deducted from'} ${house}: ${reason}`,
            targetUsers: [], // Trường bắt buộc - rỗng để gửi cho tất cả người dùng
            housesAffected: [house], // Trường bắt buộc - chỉ định nhà bị ảnh hưởng
            // Thêm các trường mở rộng cho frontend
            house: house,
            pointsChange: pointsChange,
            reason: reason || 'House points update'
          };
          
          // Send notification to the backend for real-time delivery
          // Use a try-catch block specifically for the notification
          // to prevent notification errors from failing the whole operation
          try {
            await axios.post(`${API_URL}/notifications`, notification, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            console.log('House notification sent successfully');
          } catch (notifError) {
            // Log notification error but don't throw - this shouldn't stop the function
            console.error('Failed to send notification (non-critical):', notifError);
            
            // Client-side fallback: Add notification to local storage for the frontend to pick up
            try {
              const localNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
              localNotifications.push({
                ...notification,
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                clientFallback: true
              });
              localStorage.setItem('pendingNotifications', JSON.stringify(localNotifications));
              console.log('Added notification to local fallback system');
            } catch (fallbackError) {
              console.error('Failed to store notification in local fallback:', fallbackError);
            }
          }
          
          // Force sync for all affected users
          // Use the bulk sync endpoint if available
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
      console.error('Error updating house points:', err);
      setError('Failed to update house points: ' + (err.message || 'Unknown error'));
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

  // Update points based on group work criteria
  const updateGroupCriteriaPoints = async (house, criteriaType, performanceLevel, details) => {
    if (!criteriaPoints[performanceLevel]) {
      setError(`Invalid performance level: ${performanceLevel}`);
      return false;
    }
    
    const pointsChange = criteriaPoints[performanceLevel];
    let criteriaName;
    
    switch (criteriaType) {
      case 'participation':
        criteriaName = 'Level of participation of group members';
        break;
      case 'english':
        criteriaName = 'Level of English usage in the group';
        break;
      case 'completion':
        criteriaName = 'Time taken by the group to complete tasks';
        break;
      default:
        criteriaName = 'Group work';
    }
    
    // Format reason with criteria and performance level
    const reason = `${criteriaName}: ${performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1)}${details ? ` - ${details}` : ''}`;
    
    // Get authentication token
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication token not found');
    }
    
    // Update house points first
    const result = await updateHousePoints(house, pointsChange, reason);
    
    // Only proceed with notification if points update was successful
    if (result) {
      try {
        // Create notification with properly structured fields in format backend expects
        const notificationPayload = {
          type: pointsChange > 0 ? 'success' : 'warning',
          title: pointsChange > 0 ? 'Group Criteria Points Awarded!' : 'Group Criteria Points Deducted!',
          message: `${Math.abs(pointsChange)} points ${pointsChange > 0 ? 'awarded to' : 'deducted from'} ${house}. Reason: ${reason}`,
          // Include required parameters with correct types
          targetHouse: house,
          // Ensure targetUsers is always an empty array, not null
          targetUsers: [], 
          // Ensure housesAffected is a proper array of strings
          housesAffected: [house],
          // Set skipAdmin flag to string "true" instead of boolean
          skipAdmin: "true",
          // Simplified fields at root level - make everything strings to avoid type issues
          house,
          pointsChange: pointsChange.toString(),
          reason,
          criteria: criteriaName,
          level: performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1)
        };
        
        console.log('Sending group criteria notification to users:', notificationPayload);
        
        // Send notification to backend with proper error handling
        try {
          const response = await axios.post(`${API_URL}/notifications`, notificationPayload, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Notification sent successfully to users:', response.data);
        } catch (notifError) {
          console.error('Failed to send criteria notification (non-critical):', notifError);
          // Log detailed error information for debugging
          if (notifError.response) {
            console.error('Error status:', notifError.response.status);
            console.error('Error data:', notifError.response.data);
            console.error('Server message:', notifError.response.data?.message);
          }
          
          // Client-side fallback: Add criteria notification to local storage
          try {
            const localNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
            const fallbackNotification = {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              clientFallback: true,
              message: `${Math.abs(pointsChange)} points ${pointsChange > 0 ? 'awarded to' : 'deducted from'} ${house}. Reason: ${reason}`,
              type: pointsChange > 0 ? 'success' : 'warning',
              title: pointsChange > 0 ? 'Group Criteria Points Awarded!' : 'Group Criteria Points Deducted!',
              targetUsers: [],
              housesAffected: [house],
              skipAdmin: "true", // Use string instead of boolean
              house,
              pointsChange: pointsChange.toString(), // Use string instead of number
              reason,
              criteria: criteriaName,
              level: performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1)
            };
            localNotifications.push(fallbackNotification);
            localStorage.setItem('pendingNotifications', JSON.stringify(localNotifications));
            console.log('Added criteria notification to local fallback system');
          } catch (fallbackError) {
            console.error('Failed to store criteria notification in local fallback:', fallbackError);
          }
        }
      } catch (outerError) {
        console.error('Unexpected error in notification process:', outerError);
        // This catch block handles any errors in the notification preparation
      }
    }
    
    return result;
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
        skipAdmin: typeDetails?.skipAdmin ? "true" : "false"
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
        skipAdmin: typeDetails?.skipAdmin ? "true" : "false"
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
        skipAdmin: "false",
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
        skipAdmin: "false",
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