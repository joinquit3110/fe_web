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

  // Check authentication status on initial mount
  useEffect(() => {
    // Function to check authentication status
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check local storage for saved token and user data
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
          // Parse user data and set state
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setToken(token);
          setIsAuthenticated(true);
          
          // Update localStorage flags
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('offlineMode', 'false');
          
          // Synchronize authentication state with API
          try {
            const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              // If verification succeeds, update user with fresh data from server
              const data = await response.json();
              if (data.authenticated) {
                // Update user with fresh data from server
                const adminUsers = ['hungpro', 'vipro'];
                const isUserNameAdmin = adminUsers.includes(userData.username);
                
                // Create a complete user data object with explicit admin status
                const freshUserData = {
                  ...userData,
                  ...data,
                  // Use multiple sources to determine admin status
                  isAdmin: data.isAdmin || 
                          userData.isAdmin || 
                          isUserNameAdmin || 
                          data.role === 'admin' || 
                          userData.role === 'admin' || 
                          data.house === 'admin' || 
                          userData.house === 'admin'
                };
                
                // If we're an admin user, set the admin flag in session storage as well
                if (freshUserData.isAdmin) {
                  sessionStorage.setItem('adminLogin', 'true');
                  console.log('[AuthContext] Set admin session flag for:', freshUserData.username);
                }
                
                // Update local storage with fresh data
                localStorage.setItem('user', JSON.stringify(freshUserData));
                setUser(freshUserData);
                
                console.log('[AuthContext] Authentication verified with server:', freshUserData);
              } else {
                // Auth verification failed - clear auth state
                console.warn('[AuthContext] Server rejected token, logging out');
                clearAuthState();
              }
            }
          } catch (verifyError) {
            // If verification fails due to network issue, keep the existing auth state
            // but set offline mode
            console.warn('[AuthContext] Error verifying token:', verifyError);
            localStorage.setItem('offlineMode', 'true');
          }
        } else {
          clearAuthState();
        }
      } catch (err) {
        console.error('[AuthContext] Error during auth check:', err);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };
    
    // Helper to clear auth state
    const clearAuthState = () => {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      localStorage.setItem('isAuthenticated', 'false');
      localStorage.setItem('offlineMode', navigator.onLine ? 'false' : 'true');
    };
    
    // Run the auth check
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

  // Listen for auth state change events from external sources
  useEffect(() => {
    const handleAuthStateChange = (event) => {
      console.log('[AuthContext] Received auth state change event:', event.detail);
      
      if (event.detail) {
        // Update authentication state based on event
        if (event.detail.isAuthenticated !== undefined) {
          setIsAuthenticated(event.detail.isAuthenticated);
        }
        
        // If we have user details, update user state
        if (event.detail.user) {
          setUser(event.detail.user);
          localStorage.setItem('user', JSON.stringify(event.detail.user));
        }
        
        // Handle admin status changes
        if (event.detail.isAdmin) {
          // If user exists, ensure admin flag is set
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          if (!userData.isAdmin) {
            userData.isAdmin = true;
            localStorage.setItem('user', JSON.stringify(userData));
          }
          sessionStorage.setItem('adminLogin', 'true');
        }
        
        // Update offline mode status if available
        if (event.detail.offlineMode !== undefined) {
          localStorage.setItem('offlineMode', event.detail.offlineMode ? 'true' : 'false');
        }
      }
    };
    
    // Register event listener for auth state changes
    window.addEventListener('authStateChange', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('authStateChange', handleAuthStateChange);
    };
  }, []);

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
      localStorage.setItem('offlineMode', 'false'); // Explicitly set online mode on successful login
      
      // If user is admin, set additional flags for robust admin detection
      if (isAdminUser) {
        sessionStorage.setItem('adminLogin', 'true');
        sessionStorage.setItem('user', JSON.stringify(userData)); // Backup in session storage
        sessionStorage.setItem('token', data.token);
        console.log('[AuthContext] Admin login detected, set session flags');
      }
      
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