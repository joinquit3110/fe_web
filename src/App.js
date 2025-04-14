import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { AuthProvider } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { SocketProvider } from './contexts/SocketContext';
import { PRELOAD_IMAGES } from './assets';
import imageLoader from './utils/imageLoader';

import Login from './components/Login';
import Register from './components/Register';
import AdminHousePoints from './components/AdminHousePoints';
import Activity1 from './components/Activity1';
import Activity2 from './components/Activity2';

import './styles/App.css';
import './styles/HarryPotter.css';

const theme = extendTheme({
  colors: {
    primary: {
      main: '#740001',
    },
    secondary: {
      main: '#D3A625',
    },
  },
  styles: {
    global: {
      body: {
        bg: '#0A0C17',
        color: '#F8F8F8',
      },
    },
  },
});

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
  
  if (!user && !isLocalhost) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const App = () => {
  useEffect(() => {
    const preloadImages = async () => {
      try {
        await imageLoader.preloadImages(PRELOAD_IMAGES);
      } catch (error) {
        console.error('Failed to preload images:', error);
      }
    };
    preloadImages();
  }, []);

  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <AdminProvider>
          <SocketProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route 
                  path="/admin/house-points" 
                  element={
                    <PrivateRoute>
                      <AdminHousePoints />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/" 
                  element={
                    <PrivateRoute>
                      <Activity1 />
                    </PrivateRoute>
                  } 
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Router>
          </SocketProvider>
        </AdminProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

export default App;
