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

  // Assign house to user in MongoDB
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
        console.log(`House updated in MongoDB for user ${userId}: ${house}`);
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
      
      // In a real implementation, this would call an API endpoint
      // For now, we'll update the local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          targetUserIds.includes(user.id) 
            ? { ...user, magicPoints: 100 } 
            : user
        )
      );
      
      // Reset points in the MagicPointsContext
      // This is just for demonstration, in a real implementation
      // the API would handle this
      if (resetPoints) {
        await resetPoints();
      }
      
      return true;
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
      
      // In a real implementation, this would call an API endpoint
      // For now, we'll just call the local resetRevelioAttempts
      if (resetRevelioAttempts) {
        resetRevelioAttempts();
      }
      
      return true;
    } catch (err) {
      console.error('Error resetting attempts:', err);
      setError(err.message || 'Failed to reset attempts');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Force sync for selected users
  const forceSyncForUsers = async (userIds = []) => {
    setLoading(true);
    setError(null);
    
    try {
      // If no userIds provided, use selectedUsers
      const targetUserIds = userIds.length > 0 ? userIds : selectedUsers;
      
      if (targetUserIds.length === 0) {
        throw new Error('No users selected');
      }
      
      // In a real implementation, this would call an API endpoint
      // For now, we'll just call the local forceSync
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
      
      // Create a notification for users
      const notification = {
        type: pointsChange > 0 ? 'success' : 'warning',
        title: pointsChange > 0 ? 'Points Awarded!' : 'Points Deducted!',
        message: `${Math.abs(pointsChange)} points ${pointsChange > 0 ? 'awarded to' : 'deducted from'} ${house}: ${reason}`,
        timestamp: new Date().toISOString(),
        targetUsers: userIds,
        housesAffected: [house]
      };
      
      // Send notification to the backend for real-time delivery
      await axios.post(`${API_URL}/notifications`, notification, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Update points in the database
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
            { magicPoints: newPoints },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (userError) {
          console.error(`Error updating points for user ${userId}:`, userError);
          // Continue with other users even if one fails
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
      
      return true;
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
    
    const reason = `${criteriaName}: ${performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1)}${details ? ` - ${details}` : ''}`;
    
    return await updateHousePoints(house, pointsChange, reason);
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
      notifications
    }}>
      {children}
    </AdminContext.Provider>
  );
}; 