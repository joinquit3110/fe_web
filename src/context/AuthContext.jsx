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
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};