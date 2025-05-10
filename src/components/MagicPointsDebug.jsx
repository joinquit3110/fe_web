import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Text, Heading, VStack, HStack, Badge, Code, 
  Divider, useToast, Alert, AlertIcon, Input
} from '@chakra-ui/react';
import { useMagicPoints } from '../context/MagicPointsContext';
import { checkAuthStatus } from '../api/magicPointsApi';
import { useAdmin } from '../contexts/AdminContext';
import axios from 'axios';

// Get API URL and admin credentials from AdminContext
const API_URL = "https://be-web-6c4k.onrender.com/api";
const ADMIN_USERS = ['hungpro', 'vipro'];
const ADMIN_PASSWORD = '31102004';

const MagicPointsDebug = () => {
  const { isAdmin } = useAdmin();
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
  
  // Run debug on initial load with online check and auth verification
  useEffect(() => {
    // First get the current state immediately
    const data = debugPointsState(true); // Silent mode for initial load
    setDebugData(data);
    
    // Then check auth status
    checkServerAuth();
    
    // Set a timer to refresh data again after a short delay
    // This helps after initial page load to catch any asynchronous state updates
    const refreshTimer = setTimeout(() => {
      const updatedData = debugPointsState(true);
      setDebugData(updatedData);
    }, 1500);
    
    return () => clearTimeout(refreshTimer);
  }, [debugPointsState]);
  
  // Enhanced event listener for real-time updates
  useEffect(() => {
    const handlePointsUpdate = (event) => {
      console.log('[DEBUG] Received magicPointsUpdated event:', event.detail);
      
      // Directly update debugData with the new points value from the event
      if (event.detail?.points !== undefined) {
        setDebugData(prevData => ({
          ...prevData,
          magicPoints: event.detail.points
        }));
      } else {
        // Fallback to fetching the full state
        const data = debugPointsState(true); // Silent mode for automatic updates
        setDebugData(data);
      }
    };
    
    const handleSyncCompleted = () => {
      console.log('[DEBUG] Received serverSyncCompleted event');
      const data = debugPointsState(true); // Silent mode for automatic updates
      setDebugData(data);
    };
    
    const handleAuthUpdate = (event) => {
      console.log('[DEBUG] Received auth update event:', event.detail);
      setDebugData(prevData => ({
        ...prevData,
        isAuthenticated: event.detail.authenticated
      }));
      
      // Update auth status
      if (event.detail.authenticated) {
        setAuthStatus({
          authenticated: true,
          userId: event.detail.userId,
          wasRetry: event.detail.wasRetry
        });
        
        // Show toast for retry success
        if (event.detail.wasRetry) {
          toast({
            title: 'Authentication Verified',
            description: 'Auth state verified after retry',
            status: 'success',
            duration: 3000,
          });
        }
      }
    };
    
    const handleSocketUpdate = (event) => {
      console.log('[DEBUG] Received socket connection event:', event.detail);
      setDebugData(prevData => ({
        ...prevData,
        isOnline: true
      }));
    };
    
    const handleUIUpdate = (event) => {
      console.log('[DEBUG] Received UI update event:', event.detail);
      const data = debugPointsState(true); // Silent mode for automatic updates
      setDebugData(data);
    };
    
    window.addEventListener('magicPointsUpdated', handlePointsUpdate);
    window.addEventListener('serverSyncCompleted', handleSyncCompleted);
    window.addEventListener('magicPointsUIUpdate', handleUIUpdate);
    window.addEventListener('authVerified', handleAuthUpdate);
    window.addEventListener('socketConnected', handleSocketUpdate);
    
    return () => {
      window.removeEventListener('magicPointsUpdated', handlePointsUpdate);
      window.removeEventListener('serverSyncCompleted', handleSyncCompleted);
      window.removeEventListener('magicPointsUIUpdate', handleUIUpdate);
      window.removeEventListener('authVerified', handleAuthUpdate);
      window.removeEventListener('socketConnected', handleSocketUpdate);
    };
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
  
  // Early return for admin users, but only AFTER all hooks are defined
  if (isAdmin) {
    return null;
  }
  
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
  
  const handleToggleAuth = async () => {
    if (isAuthenticated) {
      updateAuthentication(null); // logout
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user'); // Also remove user object
      
      toast({
        title: 'Logged Out',
        status: 'info',
        duration: 2000,
      });
    } else {
      try {
        // Use actual login to get a real JWT token
        const response = await axios.post(`${API_URL}/auth/login`, {
          username: ADMIN_USERS[0], // Use the first admin user (hungpro)
          password: ADMIN_PASSWORD  // Use the admin password '31102004'
        });
        
        if (response.data && response.data.token) {
          // Add explicit house and role fields to ensure admin privileges
          const authData = {
            token: response.data.token,
            user: {
              ...response.data.user,
              house: 'admin',
              role: 'admin',
              isAdmin: true
            }
          };
          
          // Update authentication in context
          updateAuthentication(authData);
          
          // Also save to localStorage
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('authToken', response.data.token);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('user', JSON.stringify(authData.user));
          
          toast({
            title: 'Authenticated',
            description: `Logged in as ${response.data.user.username} with admin privileges`,
            status: 'success',
            duration: 3000,
          });
          
          // Verify the token immediately to confirm it works
          checkServerAuth();
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err) {
        console.error('Login error:', err);
        toast({
          title: 'Authentication Failed',
          description: err.response?.data?.message || err.message || 'Unknown error',
          status: 'error',
          duration: 3000,
        });
      }
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