import React from 'react';
import { ActivityStateProvider } from './context/ActivityStateContext';
import MagicPointsDebug from './components/MagicPointsDebug';
import NotificationDisplay from './components/NotificationDisplay';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';

// Import main components
import Login from './components/Login';
import Register from './components/Register';
// Import other components as needed

function App() {
  return (
    // The NotificationDisplay is now rendered at the root level
    // outside of ActivityStateProvider but inside all global providers
    // from index.js (AuthProvider, SocketProvider, etc.)
    <>
      <NotificationDisplay />
      
      <ActivityStateProvider>
        {/* Your existing app content */}
        <MagicPointsDebug />
        
        {/* Your routes and other content */}
      </ActivityStateProvider>
    </>
  );
}

export default App;
