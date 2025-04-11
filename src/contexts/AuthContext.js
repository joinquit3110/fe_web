import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

// Use a consistent API URL for all requests
const API_URL = "https://be-web-6c4k.onrender.com/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if user is already authenticated on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedIsAuthenticated = localStorage.getItem('isAuthenticated');
        
        if (token && storedUser && storedIsAuthenticated === 'true') {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Authentication check error:', error);
        // Clear potentially corrupted auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Login function
  const login = async (credentials) => {
    try {
      setError(null);
      
      console.log('Login attempt with:', credentials.email || credentials.username);
      
      // Check for admin credentials first
      const adminUsers = ['hungpro', 'vipro'];
      const adminPassword = '3110';
      
      const username = credentials.email || credentials.username;
      const password = credentials.password;
      
      if (adminUsers.includes(username) && password === adminPassword) {
        console.log('Admin login detected');
        
        // Create admin user
        const adminUser = {
          id: `admin-${username}`,
          username: username,
          email: `${username}@hogwarts.admin.edu`,
          fullName: `Admin ${username.charAt(0).toUpperCase() + username.slice(1)}`,
          isAdmin: true,
          role: 'admin'
        };
        
        // Set authentication data
        localStorage.setItem('token', `admin-token-${Date.now()}`);
        localStorage.setItem('user', JSON.stringify(adminUser));
        localStorage.setItem('isAuthenticated', 'true');
        
        // Update state
        setUser(adminUser);
        setIsAuthenticated(true);
        
        return adminUser;
      }
      
      // For regular users, continue with API login
      // Make sure we're sending the expected format
      const loginData = {
        username: username,
        password: password
      };
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Login response error:', data);
        throw new Error(data.message || 'Login failed');
      }
      
      console.log('Login successful:', data);
      
      // Ensure user object has isAdmin property (regular user)
      if (data.user && !data.user.hasOwnProperty('isAdmin')) {
        data.user.isAdmin = false;
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isAuthenticated', 'true');
      setUser(data.user);
      setIsAuthenticated(true);
      
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      throw error;
    }
  };
  
  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    setUser(null);
    setIsAuthenticated(false);
  };
  
  // Register function
  const register = async (userData) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed');
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };
  
  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Profile update failed');
      
      // Update local storage
      const updatedUser = { ...user, ...profileData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      return data;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };
  
  // Update password function
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Password update failed');
      
      return data;
    } catch (error) {
      console.error('Password update error:', error);
      throw error;
    }
  };
  
  const value = {
    user,
    loading,
    isAuthenticated,
    error,
    login,
    logout,
    register,
    updateProfile,
    updatePassword
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
