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
  const isDevMode = true; // Restored and enabled dev mode section

  // Run debug on initial load
  useEffect(() => {
    if (isDevMode) {
      console.log("Developer mode is active");
    }
  }, [isDevMode]);

  return (
    <Box>
      <Heading size="lg">Magic Points Debug Panel</Heading>
      <VStack align="start" spacing={4}>
        <HStack>
          <Button size="xs" onClick={() => setShowDebug(false)}>Close</Button>
        </HStack>

        {/* Restored Developer Mode Section */}
        {isDevMode && (
          <Box mt={2} p={3} borderWidth="1px" borderRadius="md" borderColor="yellow.500" bg="yellow.50">
            <Heading size="sm" color="yellow.700">Developer Mode Active</Heading>
            <Text fontSize="xs" color="yellow.600">
              This panel provides additional debugging tools and information.
            </Text>
            {/* You can add more developer-specific buttons or info here */}
            <Button size="xs" colorScheme="yellow" mt={2} onClick={() => console.log("Dev mode button clicked")}>
              Log Dev Info
            </Button>
          </Box>
        )}
        
        <Divider />
      </VStack>
    </Box>
  );
};

export default MagicPointsDebug;

