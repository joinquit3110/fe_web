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
const API_URL = "/api"; // Updated to use relative path for Vercel proxy
const ADMIN_USERS = ['hungpro', 'vipro'];
const ADMIN_PASSWORD = '31102004';

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
  const isDevMode = true;

  // Run debug on initial load - only log once when component mounts
  useEffect(() => {
    console.log("Developer mode is active");
    // First check if debugPointsState exists and is a function
    if (debugPointsState && typeof debugPointsState === 'function') {
      try {
        const data = debugPointsState(true); // Silent mode for initial load
        setDebugData(data);
      } catch (error) {
        console.error('[MagicPointsDebug] Error calling debugPointsState:', error);
        setDebugData({
          magicPoints: magicPoints || 0,
          isOnline: isOnline || navigator.onLine,
          offlineMode: isOfflineMode || false,
          error: 'Failed to get debug data'
        });
      }
    } else {
      console.warn('[MagicPointsDebug] debugPointsState function not available');
      setDebugData({
        magicPoints: magicPoints || 0,
        isOnline: typeof isOnline === 'boolean' ? isOnline : navigator.onLine,
        offlineMode: typeof isOfflineMode === 'boolean' ? isOfflineMode : false,
        error: 'debugPointsState function not available'
      });
    }
    
    if (isDevMode) {
      console.log("Developer mode is active");
    }
  }, [debugPointsState, magicPoints, isOnline, isOfflineMode]);
  
  // Listen for magic points updates from socket events
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
    
    window.addEventListener('magicPointsUpdated', handlePointsUpdate);
    window.addEventListener('serverSyncCompleted', handlePointsUpdate);
    window.addEventListener('magicPointsUIUpdate', handlePointsUpdate);
    
    return () => {
      window.removeEventListener('magicPointsUpdated', handlePointsUpdate);
      window.removeEventListener('serverSyncCompleted', handlePointsUpdate);
      window.removeEventListener('magicPointsUIUpdate', handlePointsUpdate);
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
    toast({
      title: 'Local Storage Cleared',
      description: 'Local storage cleared. Please refresh the page.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };
  
  const handleResetPoints = async () => {
    try {
      const success = await resetPoints();
      if (success) {
        toast({
          title: 'Points Reset',
          description: 'Points reset to 100. Syncing with server...',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Reset Failed',
          description: 'Failed to reset points. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error resetting points:', error);
      toast({
        title: 'Reset Error',
        description: `Error resetting points: ${error.message}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  const handleToggleAuth = async () => {
    if (isAuthenticated) {
      updateAuthentication(null); // logout
      localStorage.removeItem('token');
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
          // We should trust the server's response for admin status
          // But for backwards compatibility, ensure admin fields are set
          const userData = {
            ...response.data.user,
            isAdmin: response.data.user.isAdmin === true || response.data.user.role === 'admin' || response.data.user.house === 'admin'
          };
          
          const authData = {
            token: response.data.token,
            user: userData
          };
          
          // Update authentication in context
          updateAuthentication(authData);
          
          // Also save to localStorage
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('user', JSON.stringify(userData));
          
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
    console.log('[DEBUG] Current auth token:', currentToken || 'none');
    
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
      color="white"
      p={4}
      borderRadius="md"
      boxShadow="lg"
      maxWidth="400px"
      maxHeight="90vh"
      overflowY="auto"
    >
      <VStack align="start" spacing={4}>
        <HStack justify="space-between" width="100%">
          <Heading size="md">Magic Points Debug</Heading>
          <Button size="xs" onClick={() => setShowDebug(false)}>Close</Button>
        </HStack>

        {isDevMode && (
          <Box mt={2} p={3} borderWidth="1px" borderRadius="md" borderColor="yellow.500" bg="yellow.900" width="100%">
            <Heading size="sm" color="yellow.300">Developer Mode Active</Heading>
            <Text fontSize="xs" color="yellow.200" mb={2}>
              This panel provides additional debugging tools and information.
            </Text>
            <Button size="xs" colorScheme="yellow" onClick={handleRefreshDebug}>
              Refresh Debug Data
            </Button>
          </Box>
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
        
        <Box border="1px solid gray" borderRadius="md" p={2} mt={2} width="100%">
          <Text fontSize="sm" fontWeight="bold">Current Magic Points:</Text>
          <Code colorScheme="yellow" fontSize="lg">{debugData?.magicPoints ?? magicPoints ?? 'N/A'}</Code>
        </Box>
        
        <Text fontSize="xs" color="gray.400">Last Synced: {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}</Text>
        
        <Divider />
        
        <Box width="100%">
          <Heading size="sm" mb={2}>Debug Actions</Heading>
          <VStack align="start" spacing={2}>
            <Button onClick={handleForceSync} size="sm" colorScheme="blue" width="full">
              Force Sync
            </Button>
            <Button onClick={handleForceSyncWithDebug} size="sm" colorScheme="teal" width="full">
              Force Sync With Debug
            </Button>
            <Button onClick={handleResetRevelioAttempts} size="sm" colorScheme="orange" width="full">
              Reset Revelio Attempts
            </Button>
            <Button onClick={handleResetPoints} size="sm" colorScheme="green" width="full">
              Reset Points to 100
            </Button>
            <Button onClick={handleClearLocalStorage} size="sm" colorScheme="red" width="full">
              Clear LocalStorage
            </Button>
          </VStack>
        </Box>
        
        <Divider />
        
        <Box width="100%">
          <Heading size="sm" mb={2}>Authentication Debug</Heading>
          <VStack align="start" spacing={2}>
            <Button 
              onClick={handleToggleAuth} 
              size="sm" 
              colorScheme={isAuthenticated ? "red" : "green"}
              width="full"
            >
              {isAuthenticated ? "Force Logout" : "Force Login (Admin)"}
            </Button>
            <Button onClick={checkServerAuth} size="sm" colorScheme="blue" width="full">
              Check Server Authentication
            </Button>
            <HStack width="full">
              <Input 
                placeholder="Enter JWT token" 
                size="sm" 
                value={tokenInput} 
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <Button onClick={handleManualTokenSet} size="sm">
                Set
              </Button>
            </HStack>
            <Button onClick={handleForceSyncError} size="sm" colorScheme="yellow" width="full">
              Debug Auth Issues
            </Button>
          </VStack>
        </Box>
        
        {authStatus && (
          <>
            <Divider />
            <Box width="100%">
              <Heading size="sm" mb={2}>Auth Status</Heading>
              <Alert status={authStatus.authenticated ? "success" : "error"}>
                <AlertIcon />
                {authStatus.authenticated 
                  ? `Authenticated: ${authStatus.userId}` 
                  : `Not Authenticated: ${authStatus.reason || authStatus.error || 'Unknown reason'}`
                }
              </Alert>
            </Box>
          </>
        )}
        
        {pendingOperations && pendingOperations.length > 0 && (
          <>
            <Divider />
            <Box width="100%">
              <Heading size="sm" mb={2}>Pending Operations ({pendingOperations.length})</Heading>
              <Box maxHeight="100px" overflowY="auto" bg="gray.700" p={2} borderRadius="md">
                <Code as="pre" variant="outline" p={2} fontSize="xs">
                  {JSON.stringify(pendingOperations, null, 2)}
                </Code>
              </Box>
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
};

export default MagicPointsDebug;
