import React, { useState, useEffect } from 'react';
import { Box, Button, Text, Heading, VStack, HStack, Badge, Code, Divider } from '@chakra-ui/react';
import { useMagicPoints } from '../context/MagicPointsContext';

const MagicPointsDebug = () => {
  const { 
    magicPoints,
    isOnline,
    isOfflineMode,
    isAuthenticated,
    isSyncing,
    lastSynced,
    pendingOperations,
    forceSync,
    forceSyncWithDebug,
    debugPointsState,
    resetRevelioAttempts,
    updateAuthentication,
    resetPoints
  } = useMagicPoints();
  
  const [debugData, setDebugData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // Check if we're in offline/dev mode
  const isDevMode = false; // Set to false since we're online now
  
  // Run debug on initial load
  useEffect(() => {
    const data = debugPointsState();
    setDebugData(data);
  }, [debugPointsState]);
  
  // Refresh debug data every 2 seconds
  useEffect(() => {
    if (showDebug) {
      const interval = setInterval(() => {
        const data = debugPointsState();
        setDebugData(data);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [showDebug, debugPointsState]);
  
  const handleForceSync = async () => {
    try {
      await forceSync();
      const data = debugPointsState();
      setDebugData(data);
    } catch (error) {
      console.error('Force sync error:', error);
    }
  };
  
  const handleForceSyncWithDebug = async () => {
    try {
      await forceSyncWithDebug();
      const data = debugPointsState();
      setDebugData(data);
    } catch (error) {
      console.error('Force sync with debug error:', error);
    }
  };
  
  const handleResetRevelioAttempts = () => {
    resetRevelioAttempts();
    const data = debugPointsState();
    setDebugData(data);
  };
  
  const handleClearLocalStorage = () => {
    localStorage.removeItem('revelioAttempts');
    localStorage.removeItem('correctBlanks');
    localStorage.removeItem('pendingOperations');
    localStorage.removeItem('syncRetryCount');
    alert('Local storage cleared. Please refresh the page.');
  };
  
  const handleResetPoints = async () => {
    try {
      const success = await resetPoints();
      if (success) {
        alert('Points reset to 100. Syncing with server...');
      } else {
        alert('Failed to reset points. Please try again.');
      }
    } catch (error) {
      console.error('Error resetting points:', error);
      alert('Error resetting points: ' + error.message);
    }
  };
  
  const handleToggleAuth = () => {
    if (isAuthenticated) {
      updateAuthentication(null); // logout
    } else {
      // Create a dummy auth token for testing
      const dummyAuth = {
        token: 'test-token-' + Date.now(),
        user: { id: 'test-user' }
      };
      updateAuthentication(dummyAuth);
    }
  };
  
  const handleForceSyncError = () => {
    // Store auth token for debugging
    const currentToken = localStorage.getItem('authToken');
    console.log('[DEBUG] Current auth token:', currentToken || 'none');
    
    // Log auth headers that would be sent
    console.log('[DEBUG] Auth headers that would be sent:', {
      'Authorization': `Bearer ${currentToken || ''}`
    });
    
    // Log retry count
    console.log('[DEBUG] Current retry count:', localStorage.getItem('syncRetryCount') || '0');
  };
  
  if (!showDebug) {
    return (
      <Box position="fixed" bottom="10px" right="10px" zIndex={1000}>
        <Button size="sm" colorScheme="blue" onClick={() => setShowDebug(true)}>
          Debug
        </Button>
      </Box>
    );
  }
  
  return (
    <Box 
      position="fixed" 
      bottom="10px" 
      right="10px" 
      zIndex={1000} 
      bg="white" 
      boxShadow="lg" 
      borderRadius="md" 
      p={4} 
      maxW="400px"
      maxH="80vh"
      overflowY="auto"
    >
      <VStack align="stretch" spacing={3}>
        <HStack justifyContent="space-between">
          <Heading size="md">Magic Points Debug</Heading>
          <Button size="xs" onClick={() => setShowDebug(false)}>Close</Button>
        </HStack>
        
        {isDevMode && (
          <Badge colorScheme="purple" fontSize="sm" p={1} borderRadius="md" textAlign="center">
            DEVELOPMENT MODE - Using Local Storage Only
          </Badge>
        )}
        
        <Divider />
        
        <HStack>
          <Badge colorScheme={isOnline ? "green" : "red"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <Badge colorScheme={isAuthenticated ? "green" : "red"}>
            {isAuthenticated ? "Authenticated" : "Not Authenticated"}
          </Badge>
          <Badge colorScheme={isSyncing ? "yellow" : "blue"}>
            {isSyncing ? "Syncing" : "Idle"}
          </Badge>
          <Badge colorScheme={isOfflineMode ? "purple" : "green"}>
            {isOfflineMode ? "Offline Mode" : "Online Mode"}
          </Badge>
        </HStack>
        
        <Box>
          <Text fontWeight="bold">Current Points: {magicPoints}</Text>
          <Text fontSize="sm">Last Synced: {lastSynced || 'Never'}</Text>
          <Text fontSize="sm">Auth Token: {localStorage.getItem('authToken') ? 'Present' : 'Missing'}</Text>
          <Text fontSize="sm">Retry Count: {localStorage.getItem('syncRetryCount') || '0'}</Text>
        </Box>
        
        {debugData && (
          <>
            <Text fontWeight="bold">Pending Operations: {debugData.pendingOperations.length}</Text>
            {debugData.pendingOperations.length > 0 && (
              <Box bg="gray.100" p={2} borderRadius="md" fontSize="sm">
                <Code>{JSON.stringify(debugData.pendingOperations.slice(0, 5), null, 2)}</Code>
                {debugData.pendingOperations.length > 5 && (
                  <Text>...and {debugData.pendingOperations.length - 5} more</Text>
                )}
              </Box>
            )}
          </>
        )}
        
        <HStack wrap="wrap" spacing={2}>
          <Button size="sm" colorScheme="blue" onClick={debugPointsState}>
            Refresh
          </Button>
          <Button size="sm" colorScheme="green" onClick={handleForceSync}>
            Force Sync
          </Button>
          <Button size="sm" colorScheme="purple" onClick={handleForceSyncWithDebug}>
            Debug Sync
          </Button>
        </HStack>
        
        <HStack wrap="wrap" spacing={2}>
          <Button size="sm" colorScheme="orange" onClick={handleResetRevelioAttempts}>
            Reset Revelio
          </Button>
          <Button size="sm" colorScheme="red" onClick={handleClearLocalStorage}>
            Clear Storage
          </Button>
          <Button size="sm" colorScheme="yellow" onClick={handleResetPoints}>
            Reset Points
          </Button>
        </HStack>
        
        <HStack wrap="wrap" spacing={2}>
          <Button size="sm" colorScheme={isAuthenticated ? "red" : "green"} onClick={handleToggleAuth}>
            {isAuthenticated ? "Logout" : "Login"}
          </Button>
          <Button size="sm" colorScheme="teal" onClick={handleForceSyncError}>
            Check Auth
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default MagicPointsDebug;