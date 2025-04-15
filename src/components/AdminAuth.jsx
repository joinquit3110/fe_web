import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Text, Heading, VStack, HStack, 
  Code, Divider, useToast, Alert, AlertIcon, Input
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// Backend URL for API calls
const API_URL = "https://be-web-6c4k.onrender.com/api";
const ADMIN_USERS = ['hungpro', 'vipro'];
const ADMIN_PASSWORD = '31102004';

const AdminAuth = () => {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  
  // Check token and decode it
  const checkAdminToken = async () => {
    setIsChecking(true);
    try {
      // Get current token
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast({
          title: 'No Token Found',
          description: 'No authentication token available',
          status: 'error',
          duration: 3000,
        });
        return;
      }
      
      // Decode token to show payload (this is client-side and doesn't verify signature)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      // Decode the payload (second part)
      const payload = JSON.parse(atob(tokenParts[1]));
      
      // Check token expiry
      const expiry = new Date(payload.exp * 1000);
      const now = new Date();
      const isExpired = now > expiry;
      
      // Display token info
      setTokenInfo({
        payload,
        expiry: expiry.toLocaleString(),
        isExpired,
        id: payload.id,
        tokenHeader: token.substring(0, 15) + '...'
      });
      
      // Check admin status on server
      const response = await axios.get(`${API_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast({
        title: 'Token Check',
        description: `Auth: ${response.data.authenticated ? 'Valid' : 'Invalid'}, Admin: ${response.data.isAdmin ? 'Yes' : 'No'}`,
        status: response.data.authenticated ? 'success' : 'error',
        duration: 5000,
      });
      
    } catch (error) {
      console.error('Token check error:', error);
      toast({
        title: 'Error Checking Token',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  // Force refresh the token
  const refreshAdminToken = async () => {
    try {
      // Use the login endpoint to get a fresh token
      const response = await axios.post(`${API_URL}/auth/login`, {
        username: ADMIN_USERS[0], // Use hungpro
        password: ADMIN_PASSWORD
      });
      
      if (response.data && response.data.token) {
        // Save the new token
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('isAuthenticated', 'true');
        
        toast({
          title: 'Token Refreshed',
          description: `New token generated for ${response.data.user.username}`,
          status: 'success',
          duration: 3000,
        });
        
        // Check the new token
        checkAdminToken();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      toast({
        title: 'Error Refreshing Token',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  // Test admin endpoint access
  const testAdminEndpoint = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Try to access an admin-only endpoint
      const response = await axios.get(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast({
        title: 'Admin Access Successful',
        description: `Retrieved ${response.data.users ? response.data.users.length : 0} users`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Admin endpoint test error:', error);
      toast({
        title: 'Admin Access Failed',
        description: error.response ? `${error.response.status}: ${error.response.data.message}` : error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };
  
  return (
    <Box 
      bg="gray.900" 
      color="white" 
      p={4} 
      borderRadius="md"
      boxShadow="0 4px 12px rgba(0,0,0,0.3)"
    >
      <VStack align="stretch" spacing={4}>
        <Heading size="md" color="purple.300">Admin Authentication Debug</Heading>
        
        <HStack>
          <Button 
            colorScheme="blue" 
            size="sm" 
            onClick={checkAdminToken}
            isLoading={isChecking}
          >
            Verify Admin Token
          </Button>
          <Button 
            colorScheme="purple" 
            size="sm" 
            onClick={refreshAdminToken}
          >
            Refresh Admin Token
          </Button>
          <Button 
            colorScheme="green" 
            size="sm" 
            onClick={testAdminEndpoint}
          >
            Test Admin Access
          </Button>
        </HStack>
        
        <Divider />
        
        <Text fontSize="sm">Current User: {user?.username || 'None'}</Text>
        <Text fontSize="sm">Is Authenticated: {isAuthenticated ? 'Yes' : 'No'}</Text>
        <Text fontSize="sm">Is Admin User: {user && ADMIN_USERS.includes(user.username) ? 'Yes' : 'No'}</Text>
        
        {tokenInfo && (
          <>
            <Heading size="xs" mt={2}>Token Information</Heading>
            <Box bg="gray.800" p={2} borderRadius="md" fontSize="sm">
              <Text>Token Header: {tokenInfo.tokenHeader}</Text>
              <Text>User ID: {tokenInfo.id}</Text>
              <Text>Expires: {tokenInfo.expiry} ({tokenInfo.isExpired ? 'EXPIRED' : 'Valid'})</Text>
              <Text mt={2}>Full Payload:</Text>
              <Code bg="gray.700" p={2} borderRadius="md" fontSize="xs" whiteSpace="pre-wrap">
                {JSON.stringify(tokenInfo.payload, null, 2)}
              </Code>
            </Box>
          </>
        )}
        
        {!isAuthenticated && (
          <Alert status="warning">
            <AlertIcon />
            You are not authenticated. Log in as an admin user first.
          </Alert>
        )}
      </VStack>
    </Box>
  );
};

export default AdminAuth;