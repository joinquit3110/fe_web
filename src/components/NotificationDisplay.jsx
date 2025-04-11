import React, { useState, useEffect } from 'react';
import { Box, Text, Badge, CloseButton, Fade } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = 'https://be-web-6c4k.onrender.com/api';

const NotificationDisplay = () => {
  const [notifications, setNotifications] = useState([]);
  const [visible, setVisible] = useState(false);
  const { user, isAuthenticated } = useAuth();
  
  // Poll for notifications
  useEffect(() => {
    let interval = null;
    
    const fetchNotifications = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get(`${API_URL}/notifications`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data && response.data.length > 0) {
          setNotifications(response.data);
          setVisible(true);
          
          // Auto-hide after 10 seconds
          setTimeout(() => {
            setVisible(false);
          }, 10000);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    // Initial fetch
    fetchNotifications();
    
    // Set up polling interval (every 10 seconds)
    if (isAuthenticated) {
      interval = setInterval(fetchNotifications, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, user]);
  
  const handleClose = () => {
    setVisible(false);
  };
  
  if (!visible || !notifications.length) return null;
  
  // Use the most recent notification
  const notification = notifications[0];
  
  return (
    <Fade in={visible}>
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={1000}
        maxWidth="90vw"
        width="500px"
        padding="16px"
        borderRadius="8px"
        color="white"
        textAlign="center"
        className="wizard-panel notification-panel"
        boxShadow="0 0 20px rgba(0,0,0,0.5)"
        backgroundColor={
          notification.type === 'success' ? 'rgba(46, 204, 113, 0.95)' :
          notification.type === 'warning' ? 'rgba(230, 126, 34, 0.95)' :
          notification.type === 'error' ? 'rgba(231, 76, 60, 0.95)' :
          'rgba(52, 152, 219, 0.95)'
        }
        animation="pop-in 0.5s ease-out, float 3s ease-in-out infinite"
      >
        <CloseButton 
          position="absolute" 
          right="8px" 
          top="8px" 
          onClick={handleClose} 
        />
        
        <Box mb={2}>
          <Badge 
            fontSize="md" 
            colorScheme={
              notification.type === 'success' ? 'green' :
              notification.type === 'warning' ? 'orange' :
              notification.type === 'error' ? 'red' :
              'blue'
            }
            px={2}
            py={1}
            borderRadius="md"
          >
            {notification.title}
          </Badge>
        </Box>
        
        <Text 
          fontSize="xl" 
          fontWeight="bold"
          fontFamily="'Cinzel', serif"
          letterSpacing="1px"
        >
          {notification.message}
        </Text>
      </Box>
    </Fade>
  );
};

export default NotificationDisplay; 