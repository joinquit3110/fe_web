// This component is no longer used.
// The original functionality is now directly in App.js to maintain the original code structure.
// This file is kept as a placeholder for future use if needed. 

import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import AdminHousePoints from './AdminHousePoints';
import {
  Box, VStack, HStack, Text, Heading, Spinner, 
  Progress, Badge, Divider, Flex, useToast
} from '@chakra-ui/react';
import axios from 'axios';

const API_URL = "https://be-web-6c4k.onrender.com/api";

// Component for displaying house points (for regular users)
const HousePointsDisplay = () => {
  const [housePoints, setHousePoints] = useState({
    gryffindor: { name: 'Gryffindor', points: 0, color: '#740001', textColor: '#FFC500' },
    slytherin: { name: 'Slytherin', points: 0, color: '#1A472A', textColor: '#AAAAAA' },
    ravenclaw: { name: 'Ravenclaw', points: 0, color: '#0E1A40', textColor: '#946B2D' },
    hufflepuff: { name: 'Hufflepuff', points: 0, color: '#ecb939', textColor: '#000000' }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const toast = useToast();
  
  // Function to fetch house points
  const fetchHousePoints = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }
      
      const response = await axios.get(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && Array.isArray(response.data.users)) {
        // Calculate total points for each house
        const houses = {
          gryffindor: { name: 'Gryffindor', points: 0, color: '#740001', textColor: '#FFC500' },
          slytherin: { name: 'Slytherin', points: 0, color: '#1A472A', textColor: '#AAAAAA' },
          ravenclaw: { name: 'Ravenclaw', points: 0, color: '#0E1A40', textColor: '#946B2D' },
          hufflepuff: { name: 'Hufflepuff', points: 0, color: '#ecb939', textColor: '#000000' }
        };
        
        response.data.users.forEach(user => {
          if (user.house && houses[user.house]) {
            houses[user.house].points += user.magicPoints || 0;
          }
        });
        
        setHousePoints(houses);
      }
    } catch (err) {
      console.error('Error fetching house points:', err);
      setError('Failed to fetch house points');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchHousePoints();
    
    // Set up polling interval for real-time updates (every 10 seconds)
    const interval = setInterval(fetchHousePoints, 10000);
    
    // Set up event listener for user house changes
    const handleUserUpdate = () => {
      fetchHousePoints();
    };
    
    window.addEventListener('userDataChanged', handleUserUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('userDataChanged', handleUserUpdate);
    };
  }, []);
  
  // Find user's house
  const userHouse = user?.house || 'muggle';
  
  // Sort houses by points (highest first)
  const sortedHouses = Object.values(housePoints).sort((a, b) => b.points - a.points);
  const maxPoints = Math.max(...sortedHouses.map(house => house.points), 1);
  
  if (loading) {
    return (
      <Box className="wizard-panel" p={6} textAlign="center">
        <Spinner size="xl" color="#D3A625" thickness="4px" />
        <Text mt={4}>Loading house points...</Text>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box className="wizard-panel error-panel" p={6}>
        <Heading size="md" color="red.500">Error</Heading>
        <Text>{error}</Text>
      </Box>
    );
  }
  
  return (
    <Box className="wizard-panel" p={6}>
      <Heading 
        as="h2" 
        size="lg" 
        mb={6} 
        textAlign="center"
        className="activity-title"
        style={{ 
          fontFamily: "'Cinzel', serif",
          position: "relative",
          textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
          letterSpacing: "1px"
        }}
      >
        <span style={{
          display: "inline-block",
          padding: "0 30px",
          position: "relative"
        }}>
          Hogwarts House Points
          <span style={{
            position: "absolute",
            bottom: "-5px",
            left: "0",
            right: "0",
            height: "2px",
            background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
            animation: "shimmer 2s infinite"
          }}></span>
        </span>
      </Heading>
      
      <VStack spacing={6} align="stretch">
        {sortedHouses.map((house, index) => (
          <Box 
            key={house.name.toLowerCase()} 
            borderRadius="md" 
            overflow="hidden"
            boxShadow="md"
            border={userHouse === house.name.toLowerCase() ? '2px solid gold' : '1px solid rgba(255,255,255,0.2)'}
            transition="all 0.3s ease"
            className={`house-points-container ${userHouse === house.name.toLowerCase() ? 'my-house' : ''}`}
            position="relative"
          >
            {index === 0 && (
              <Badge 
                position="absolute" 
                top="-10px" 
                right="10px" 
                zIndex="1" 
                colorScheme="yellow" 
                fontSize="lg"
                px={3}
                py={1}
                borderRadius="full"
                boxShadow="0 0 10px rgba(255, 215, 0, 0.5)"
              >
                1st Place
              </Badge>
            )}
            {userHouse === house.name.toLowerCase() && (
              <Badge 
                position="absolute" 
                top="-10px" 
                left="10px" 
                zIndex="1" 
                colorScheme="blue" 
                fontSize="md"
                px={2}
                py={1}
                borderRadius="full"
              >
                Your House
              </Badge>
            )}
            <Box 
              bg={house.color} 
              color={house.textColor}
              p={4}
            >
              <Flex justifyContent="space-between" alignItems="center">
                <Heading size="md">{house.name}</Heading>
                <Text fontWeight="bold" fontSize="xl">{house.points} points</Text>
              </Flex>
            </Box>
            <Box bg="rgba(0,0,0,0.3)" p={2}>
              <Progress 
                value={(house.points / maxPoints) * 100} 
                colorScheme={
                  house.name.toLowerCase() === 'gryffindor' ? 'red' :
                  house.name.toLowerCase() === 'slytherin' ? 'green' :
                  house.name.toLowerCase() === 'ravenclaw' ? 'blue' :
                  'yellow'
                }
                height="8px"
                borderRadius="full"
              />
            </Box>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

// Main Activity2 component
const Activity2 = () => {
  const { isAdmin } = useAdmin();
  const { user, isAuthenticated } = useAuth();
  const [userSync, setUserSync] = useState({
    lastSync: null,
    isLoading: false
  });
  
  // Function to sync user data with server
  const syncUserData = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      setUserSync(prev => ({ ...prev, isLoading: true }));
      
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Fetch updated user data
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data) {
        // Update local storage with new user data
        localStorage.setItem('user', JSON.stringify(response.data));
        
        // Dispatch event to notify other components
        const event = new CustomEvent('userDataChanged', {
          detail: { user: response.data }
        });
        window.dispatchEvent(event);
        
        setUserSync({
          lastSync: new Date(),
          isLoading: false
        });
      }
    } catch (err) {
      console.error('Error syncing user data:', err);
    } finally {
      setUserSync(prev => ({ ...prev, isLoading: false }));
    }
  };
  
  // Set up initial sync and polling
  useEffect(() => {
    // Initial sync
    syncUserData();
    
    // Set up polling interval (every 30 seconds)
    const interval = setInterval(syncUserData, 30000);
    
    // Clean up
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);
  
  // If user is admin, show admin UI
  if (isAdmin) {
    return <AdminHousePoints />;
  }
  
  // For regular users, show the house points display
  return <HousePointsDisplay />;
};

export default Activity2; 