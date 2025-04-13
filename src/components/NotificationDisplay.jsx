import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Badge, CloseButton, Fade, Stack, Image, Flex } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const API_URL = 'https://be-web-6c4k.onrender.com/api';

const NotificationDisplay = () => {
  const [serverNotifications, setServerNotifications] = useState([]);
  const [activeNotifications, setActiveNotifications] = useState([]);
  const { user, isAuthenticated } = useAuth();
  
  // Add a try-catch to safely use the socket context
  let socketNotifications = [];
  let removeNotification = () => {};
  
  try {
    // Try to get socket context - this might not be available if SocketProvider is not in the tree
    const socketContext = useSocket();
    socketNotifications = socketContext?.notifications || [];
    removeNotification = socketContext?.removeNotification || (() => {});
  } catch (error) {
    console.warn('Socket context not available:', error.message);
  }
  
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  
  // Merge server and socket notifications
  useEffect(() => {
    if (socketNotifications.length > 0) {
      // Add new socket notifications to the queue
      socketNotifications.forEach(notification => {
        // Process message to extract point change amount if it's a points notification
        let pointsChange = null;
        let reason = null;
        
        // Check if it's a point change notification
        if (notification.message && (notification.message.includes('increased by') || notification.message.includes('decreased by'))) {
          const match = notification.message.match(/(increased|decreased) by (\d+)/);
          if (match) {
            const changeType = match[1];
            const amount = parseInt(match[2], 10);
            pointsChange = changeType === 'increased' ? amount : -amount;
          }
        }
        
        // Check for reasons in house point notifications
        if (notification.message && notification.message.includes('House') && (notification.message.includes('gained') || notification.message.includes('lost'))) {
          const reasonMatch = notification.message.match(/Reason: (.+)/i);
          if (reasonMatch) {
            reason = reasonMatch[1];
          }
        }
        
        const notificationItem = {
          id: notification.id,
          type: notification.type,
          title: getNotificationTitle(notification.type),
          message: notification.message,
          timestamp: notification.timestamp,
          source: 'socket',
          duration: getDurationByType(notification.type),
          pointsChange,
          reason
        };
        
        // Add to queue if not already present
        if (!notificationQueue.current.some(item => item.id === notification.id)) {
          notificationQueue.current.push(notificationItem);
        }
      });
      
      // Process the queue if not already processing
      if (!processingQueue.current) {
        processNotificationQueue();
      }
    }
  }, [socketNotifications]);
  
  // Poll for server notifications
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
          // Update server notifications
          setServerNotifications(response.data);
          
          // Add new server notifications to the queue
          response.data.forEach(notification => {
            // Check if this notification is already in the queue
            const existingNotification = notificationQueue.current.find(
              item => item.source === 'server' && item.id === notification._id
            );
            
            if (!existingNotification) {
              // Process message to extract point change amount if it's a points notification
              let pointsChange = null;
              let reason = notification.reason || null;
              
              // Check if it's a point change notification
              if (notification.message && (notification.message.includes('increased by') || notification.message.includes('decreased by'))) {
                const match = notification.message.match(/(increased|decreased) by (\d+)/);
                if (match) {
                  const changeType = match[1];
                  const amount = parseInt(match[2], 10);
                  pointsChange = changeType === 'increased' ? amount : -amount;
                }
              }
              
              const notificationItem = {
                id: notification._id,
                type: notification.type || 'info',
                title: notification.title || getNotificationTitle(notification.type || 'info'),
                message: notification.message,
                timestamp: new Date(notification.createdAt),
                source: 'server',
                duration: getDurationByType(notification.type || 'info'),
                pointsChange,
                reason
              };
              notificationQueue.current.push(notificationItem);
            }
          });
          
          // Process the queue if not already processing
          if (!processingQueue.current) {
            processNotificationQueue();
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    // Initial fetch
    fetchNotifications();
    
    // Set up polling interval (every 15 seconds)
    if (isAuthenticated) {
      interval = setInterval(fetchNotifications, 15000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, user]);
  
  // Helper function to get appropriate title
  const getNotificationTitle = (type) => {
    switch (type) {
      case 'success': return 'Success!';
      case 'warning': return 'Warning!';
      case 'error': return 'Error!';
      case 'announcement': return 'Announcement';
      default: return 'Notification';
    }
  };
  
  // Helper function to get duration by notification type
  const getDurationByType = (type) => {
    switch (type) {
      case 'error': return 10000; // 10 seconds
      case 'warning': return 8000; // 8 seconds
      case 'success': return 6000; // 6 seconds
      case 'announcement': return 15000; // 15 seconds
      default: return 7000; // 7 seconds
    }
  };
  
  // Process notification queue
  const processNotificationQueue = () => {
    if (notificationQueue.current.length === 0) {
      processingQueue.current = false;
      return;
    }
    
    processingQueue.current = true;
    
    // Get the next notification
    const nextNotification = notificationQueue.current.shift();
    
    // Add to active notifications (limit to 3 at a time)
    setActiveNotifications(prev => {
      const updated = [...prev, nextNotification].slice(-3);
      return updated;
    });
    
    // If it's a socket notification, remove it from the socket context
    if (nextNotification.source === 'socket') {
      try {
        removeNotification(nextNotification.id);
      } catch (error) {
        console.warn('Error removing notification:', error.message);
      }
    }
    
    // Schedule next notification to be displayed after a delay
    setTimeout(() => {
      // Remove this notification after its duration
      setActiveNotifications(prev => 
        prev.filter(item => item.id !== nextNotification.id)
      );
      
      // Continue processing the queue after a short delay
      setTimeout(processNotificationQueue, 500);
    }, nextNotification.duration);
  };
  
  // Clear a specific notification
  const handleClose = (id) => {
    setActiveNotifications(prev => prev.filter(item => item.id !== id));
  };
  
  if (activeNotifications.length === 0) return null;
  
  return (
    <Stack spacing={4} position="fixed" top="100px" right="20px" zIndex={1000} maxWidth="400px">
      {activeNotifications.map(notification => (
        <Fade key={notification.id} in={true}>
          <Box
            padding="16px"
            borderRadius="8px"
            color="white"
            className="wizard-panel notification-panel"
            boxShadow="0 0 20px rgba(0,0,0,0.5)"
            backgroundColor={
              notification.type === 'success' ? 'rgba(46, 204, 113, 0.95)' :
              notification.type === 'warning' ? 'rgba(230, 126, 34, 0.95)' :
              notification.type === 'error' ? 'rgba(231, 76, 60, 0.95)' :
              notification.type === 'announcement' ? 'rgba(142, 68, 173, 0.95)' :
              'rgba(52, 152, 219, 0.95)'
            }
            animation={`pop-in 0.4s ease-out, float-${notification.id % 3} 3s ease-in-out infinite`}
            position="relative"
            overflow="hidden"
          >
            <CloseButton 
              position="absolute" 
              right="8px" 
              top="8px" 
              onClick={() => handleClose(notification.id)} 
            />
            
            {/* Point change animations and images */}
            {notification.pointsChange && (
              <Box 
                className="point-change-animation"
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                zIndex="0"
                display="flex"
                justifyContent="center"
                alignItems="center"
                pointerEvents="none"
              >
                <Image 
                  src={notification.pointsChange > 0 ? '/fe_web/asset/IncreasePoint.png' : '/fe_web/asset/DecreasePoint.png'}
                  alt={notification.pointsChange > 0 ? 'Points increased' : 'Points decreased'}
                  className={notification.pointsChange > 0 ? 'increase-animation' : 'decrease-animation'}
                  opacity="0.8"
                  width="150px"
                  height="auto"
                  position="absolute"
                />
                <Text
                  fontSize="28px"
                  fontWeight="bold"
                  color={notification.pointsChange > 0 ? "#2ecc71" : "#e74c3c"}
                  textShadow="0 0 5px rgba(0,0,0,0.7)"
                  position="relative"
                  bottom="-15px"
                  className="points-text-animation"
                >
                  {notification.pointsChange > 0 ? `+${notification.pointsChange}` : notification.pointsChange}
                </Text>
              </Box>
            )}
            
            {/* Decorative magical effect */}
            <Box 
              position="absolute"
              top="-20px"
              left="-20px"
              width="60px"
              height="60px"
              borderRadius="50%"
              backgroundColor="rgba(255,255,255,0.1)"
              opacity="0.6"
              zIndex="1"
            />
            
            <Box mb={2} position="relative" zIndex="2">
              <Badge 
                fontSize="sm" 
                colorScheme={
                  notification.type === 'success' ? 'green' :
                  notification.type === 'warning' ? 'orange' :
                  notification.type === 'error' ? 'red' :
                  notification.type === 'announcement' ? 'purple' :
                  'blue'
                }
                px={2}
                py={1}
                borderRadius="md"
              >
                {notification.title}
              </Badge>
            </Box>
            
            <Flex direction="column" position="relative" zIndex="2">
              <Text 
                fontSize="md" 
                fontWeight="semibold"
                fontFamily="'Cinzel', serif"
                letterSpacing="0.5px"
              >
                {notification.message}
              </Text>
              
              {/* Show reason if available */}
              {notification.reason && (
                <Text 
                  fontSize="sm" 
                  mt={1}
                  fontStyle="italic"
                  color="rgba(255,255,255,0.85)"
                >
                  Reason: {notification.reason}
                </Text>
              )}
            </Flex>
            
            {/* Magic sparkle animation using pseudo-elements handled in CSS */}
          </Box>
        </Fade>
      ))}
      
      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes pop-in {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes float-0 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        @keyframes float-1 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        
        .notification-panel::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255,255,255,0.7);
          animation: wipe-through 3s linear forwards;
        }
        
        @keyframes wipe-through {
          0% { left: 0; right: 100%; }
          100% { left: 0; right: 0; }
        }
        
        .increase-animation {
          animation: appear-grow 0.5s ease-out, pulse-green 2s infinite;
          filter: drop-shadow(0 0 8px rgba(46, 204, 113, 0.7));
        }
        
        .decrease-animation {
          animation: appear-grow 0.5s ease-out, pulse-red 2s infinite;
          filter: drop-shadow(0 0 8px rgba(231, 76, 60, 0.7));
        }
        
        .points-text-animation {
          animation: float-up 3s ease-out;
          transform-origin: center;
        }
        
        @keyframes appear-grow {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.2); opacity: 0.9; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        
        @keyframes pulse-green {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(46, 204, 113, 0.7)); }
          50% { filter: drop-shadow(0 0 15px rgba(46, 204, 113, 0.9)); }
        }
        
        @keyframes pulse-red {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(231, 76, 60, 0.7)); }
          50% { filter: drop-shadow(0 0 15px rgba(231, 76, 60, 0.9)); }
        }
        
        @keyframes float-up {
          0% { transform: translateY(10px); opacity: 0; }
          10% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
      `}</style>
    </Stack>
  );
};

export default NotificationDisplay; 