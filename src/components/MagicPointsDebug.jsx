import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Text, Heading, VStack, HStack, Badge, Code, 
  Divider, useToast, Alert, AlertIcon, Input
} from '@chakra-ui/react';
import { useMagicPoints } from '../context/MagicPointsContext';
import { checkAuthStatus } from '../api/magicPointsApi';

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
  const [authStatus, setAuthStatus] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const toast = useToast();
  
  // Check if we're in offline/dev mode
  const isDevMode = false; // Set to false since we're online now
  
  // Run debug on initial load
  useEffect(() => {
    const data = debugPointsState(true); // Silent mode for initial load
    setDebugData(data);
  }, [debugPointsState]);
  
  // Refresh debug data every 2 seconds (silently)
  useEffect(() => {
    if (showDebug) {
      const interval = setInterval(() => {
        const data = debugPointsState(true); // Silent mode for automatic updates
        setDebugData(data);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [showDebug, debugPointsState]);
  
  const handleForceSync = async () => {
    try {
      await forceSync();
      const data = debugPointsState(); // Regular mode for manual action
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
  
  const checkServerAuth = async () => {
    try {
      const status = await checkAuthStatus();
      setAuthStatus(status);
      console.log('[DEBUG] Auth check result:', status);
      
      toast({
        title: status.authenticated ? 'Authenticated' : 'Not Authenticated',
        description: status.authenticated 
          ? `User ID: ${status.userId}` 
          : `Reason: ${status.reason}`,
        status: status.authenticated ? 'success' : 'error',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('[DEBUG] Auth check error:', error);
      setAuthStatus({ authenticated: false, error: error.message });
      
      toast({
        title: 'Auth Check Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleManualTokenSet = () => {
    if (!tokenInput.trim()) {
      toast({
        title: 'Error',
        description: 'Token cannot be empty',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    try {
      localStorage.setItem('token', tokenInput.trim());
      localStorage.setItem('authToken', tokenInput.trim());
      localStorage.setItem('isAuthenticated', 'true');
      
      toast({
        title: 'Token Set',
        description: 'Auth token manually updated',
        status: 'success',
        duration: 3000,
      });
      
      // Refresh debug data
      const data = debugPointsState();
      setDebugData(data);
    } catch (error) {
      console.error('Error setting token:', error);
      toast({
        title: 'Error',
        description: 'Failed to set token: ' + error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  const handleForceSyncError = () => {
    // Store auth token for debugging
    const currentToken = localStorage.getItem('token');
    const altToken = localStorage.getItem('authToken');
    console.log('[DEBUG] Current auth token:', currentToken || 'none');
    console.log('[DEBUG] Alternative auth token:', altToken || 'none');
    
    // Log token details
    if (currentToken) {
      console.log('[DEBUG] Token length:', currentToken.length);
      console.log('[DEBUG] Token first/last chars:', 
        `${currentToken.substring(0, 5)}...${currentToken.substring(currentToken.length - 5)}`);
    }
    
    // Log auth headers that would be sent
    console.log('[DEBUG] Auth headers that would be sent:', {
      'Authorization': `Bearer ${currentToken || ''}`
    });
    
    // Log retry count
    console.log('[DEBUG] Current retry count:', localStorage.getItem('syncRetryCount') || '0');
    
    // Check server auth status
    checkServerAuth();
  };
  
  const handleRefreshDebug = () => {
    // Use regular (non-silent) mode for manual refresh
    const data = debugPointsState();
    setDebugData(data);
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
      bg="gray.800" 
      boxShadow="lg" 
      borderRadius="md" 
      p={4} 
      maxW="400px"
      maxH="80vh"
      overflowY="auto"
      color="white"
    >
      <VStack align="stretch" spacing={3}>
        <HStack justifyContent="space-between">
          <Heading size="md" color="white">Magic Points Debug</Heading>
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
          <Text fontWeight="bold" color="white">Current Points: {magicPoints}</Text>
          <Text fontSize="sm" color="gray.200">Last Synced: {lastSynced || 'Never'}</Text>
          <Text fontSize="sm" color="gray.200">Auth Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</Text>
          <Text fontSize="sm" color="gray.200">Retry Count: {localStorage.getItem('syncRetryCount') || '0'}</Text>
        </Box>
        
        {authStatus && (
          <Alert 
            status={authStatus.authenticated ? 'success' : 'error'} 
            borderRadius="md"
            size="sm"
          >
            <AlertIcon />
            <Text fontSize="xs">
              {authStatus.authenticated 
                ? 'Server authentication verified' 
                : `Auth failed: ${authStatus.reason || authStatus.error || 'Unknown error'}`}
            </Text>
          </Alert>
        )}
        
        {/* Manual token input */}
        <VStack spacing={1}>
          <Input 
            placeholder="Enter JWT token" 
            size="xs"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            bg="gray.700"
            color="white"
            fontSize="xs"
          />
          <Button size="xs" colorScheme="purple" onClick={handleManualTokenSet} width="100%">
            Set Token Manually
          </Button>
        </VStack>
        
        {debugData && (
          <>
            <Text fontWeight="bold" color="white">Pending Operations: {debugData.pendingOperations.length}</Text>
            {debugData.pendingOperations.length > 0 && (
              <Box bg="gray.700" p={2} borderRadius="md" fontSize="sm">
                <Code bg="gray.700" color="green.300">{JSON.stringify(debugData.pendingOperations.slice(0, 5), null, 2)}</Code>
                {debugData.pendingOperations.length > 5 && (
                  <Text color="gray.300">...and {debugData.pendingOperations.length - 5} more</Text>
                )}
              </Box>
            )}
          </>
        )}
        
        <HStack wrap="wrap" spacing={2}>
          <Button size="sm" colorScheme="blue" onClick={handleRefreshDebug}>
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