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
    // Check local storage for saved auth state with server verification
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        // Set initial state from localStorage
        setUser(JSON.parse(savedUser));
        setToken(token);
        setIsAuthenticated(true);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Verify token with server in the background
        try {
          const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[AUTH] Token verified with server:', data);
            
            // Dispatch an event to notify other components about verified auth
            window.dispatchEvent(new CustomEvent('authVerified', { 
              detail: { authenticated: true, userId: data.userId }
            }));
          } else {
            console.warn('[AUTH] Token verification failed, status:', response.status);
            // Don't log out immediately on first failure - we'll retry
          }
        } catch (error) {
          console.error('[AUTH] Error verifying token with server:', error);
        }
      } else {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        localStorage.setItem('isAuthenticated', 'false');
      }
      setIsLoading(false);
    };
    
    checkAuth();
    
    // Set up a retry mechanism for token verification
    let retryCount = 0;
    const maxRetries = 3;
    
    const retryVerification = async () => {
      const token = localStorage.getItem('token');
      if (!token || retryCount >= maxRetries) return;
      
      try {
        console.log(`[AUTH] Retry token verification attempt ${retryCount + 1}`);
        const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[AUTH] Token verified on retry:', data);
          window.dispatchEvent(new CustomEvent('authVerified', { 
            detail: { authenticated: true, userId: data.userId, wasRetry: true }
          }));
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(retryVerification, 1000 * retryCount); // Exponential backoff
          }
        }
      } catch (error) {
        console.error('[AUTH] Error during retry verification:', error);
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(retryVerification, 1000 * retryCount);
        }
      }
    };
    
    // Start first retry after a small delay
    setTimeout(retryVerification, 2000);
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

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      // Parse JSON response properly
      const data = await response.json();
      
      // Store user data in state and localStorage as objects, not double-stringified
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token); // Store token directly as string
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      
      console.log('Login successful', data);
      return data; // Return the response data
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