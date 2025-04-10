import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

// Thay API_URL thành đường dẫn tương đối
const API_URL = "https://be-web-6c4k.onrender.com/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for token
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Auto-login for local development
      const autoUser = {
        id: 'local-dev-user',
        username: 'HogwartsWizard',
        email: 'wizard@hogwarts.edu',
        role: 'user'
      };
      localStorage.setItem('token', 'dev-token');
      localStorage.setItem('user', JSON.stringify(autoUser));
      setUser(autoUser);
    }
    
    setLoading(false);
  }, []);
  
  // Login function
  const login = async (credentials) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
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
