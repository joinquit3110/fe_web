import React, { createContext, useContext, useState, useEffect } from 'react';

// Define BACKEND_URL constant
const BACKEND_URL = 'https://be-web-6c4k.onrender.com';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check local storage for saved auth state
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        setUser(JSON.parse(savedUser));
        setToken(token);
        setIsAuthenticated(true);
        localStorage.setItem('isAuthenticated', 'true');
      } else {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        localStorage.setItem('isAuthenticated', 'false');
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // Listen for user house changes from sockets or other parts of the application
  useEffect(() => {
    const handleHouseChange = (event) => {
      if (event.detail && event.detail.house && user) {
        console.log(`[AUTH] Received house change event: ${event.detail.house}`);
        
        setUser(prevUser => {
          if (!prevUser) return prevUser;
          
          // Create a new user object with updated house
          const updatedUser = {
            ...prevUser,
            house: event.detail.house
          };
          
          // Also update localStorage to persist the change
          localStorage.setItem('user', JSON.stringify(updatedUser));
          
          return updatedUser;
        });
      }
    };
    
    // Listen for the custom event
    window.addEventListener('userHouseChanged', handleHouseChange);
    
    return () => {
      window.removeEventListener('userHouseChanged', handleHouseChange);
    };
  }, [user]);

  // Add a function to update user's house directly
  const updateUserHouse = async (house) => {
    try {
      if (!user || !token) {
        throw new Error("Not logged in");
      }
      
      // Update on the server
      const response = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ house })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update house: ${response.status}`);
      }
      
      // Update local state and storage
      const updatedUser = {...user, house};
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Return success
      return { success: true };
    } catch (err) {
      console.error("Error updating house:", err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const login = async (credentials) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check for admin credentials
      const adminUsers = ['hungpro', 'vipro'];
      const adminPassword = '31102004';
      
      // Handle login with either {username, password} or {email, password}
      const username = credentials.username || credentials.email;
      const password = credentials.password;
      
      // Log what's being sent to the server
      console.log(`[AuthContext] Logging in with username: ${username}`);
      
      // Use the proper API endpoint format and send username consistently
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: username, 
          password: password 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      // Parse JSON response properly
      const data = await response.json();
      
      // Check for admin privileges
      const isAdminUser = 
        adminUsers.includes(username) || 
        data.user.isAdmin === true || 
        data.user.role === 'admin' || 
        data.user.house === 'admin';
      
      // Make sure isAdmin flag is set in the user object
      const userData = {
        ...data.user,
        isAdmin: isAdminUser
      };
      
      console.log('[AuthContext] Login response:', {
        username: userData.username,
        isAdmin: userData.isAdmin,
        role: userData.role,
        house: userData.house
      });
      
      // Store user data in state and localStorage as objects, not double-stringified
      setUser(userData);
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', data.token); // Store token directly as string
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      
      console.log('Login successful', data);
      return { ...data, user: userData }; // Return the response data with updated user object
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.setItem('isAuthenticated', 'false');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoading, 
      error,
      token,
      login, 
      logout,
      updateUserHouse
    }}>
      {children}
    </AuthContext.Provider>
  );
};