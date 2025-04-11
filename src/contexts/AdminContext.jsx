import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useMagicPoints } from '../context/MagicPointsContext';

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

  // Fetch all users (except admins)
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll simulate with mock data
      const mockUsers = [
        { id: '1', username: 'student1', email: 'student1@hogwarts.edu', house: 'gryffindor', magicPoints: 80 },
        { id: '2', username: 'student2', email: 'student2@hogwarts.edu', house: 'slytherin', magicPoints: 95 },
        { id: '3', username: 'student3', email: 'student3@hogwarts.edu', house: 'ravenclaw', magicPoints: 110 },
        { id: '4', username: 'student4', email: 'student4@hogwarts.edu', house: 'hufflepuff', magicPoints: 75 },
      ];
      
      // Filter out admin users
      const filteredUsers = mockUsers.filter(u => !ADMIN_USERS.includes(u.username));
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users');
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

  // Assign house to user
  const assignHouse = async (userId, house) => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll update the local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, house } : user
        )
      );
      
      return true;
    } catch (err) {
      console.error('Error assigning house:', err);
      setError('Failed to assign house');
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
      forceSyncForUsers
    }}>
      {children}
    </AdminContext.Provider>
  );
}; 