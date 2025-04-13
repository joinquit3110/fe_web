import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Badge, CloseButton, Fade, Stack, Image, Flex } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
// Import the image assets
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

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
        let criteria = null;
        let level = null;
        
        // Check if it's a point change notification
        if (notification.message) {
          // Remove "by admin" from message if present
          let message = notification.message.replace(' by admin', '');
          
          // Extract points change information
          if (message.includes('increased by') || message.includes('decreased by')) {
            const match = message.match(/(increased|decreased) by (\d+)/);
            if (match) {
              const changeType = match[1];
              const amount = parseInt(match[2], 10);
              pointsChange = changeType === 'increased' ? amount : -amount;
              // Update message without "by admin"
              notification.message = message;
            }
          }
          
          // Check for reasons in house point notifications
          if (message.includes('House') && (message.includes('gained') || message.includes('lost'))) {
            const reasonMatch = message.match(/Reason: (.+)/i);
            if (reasonMatch) {
              reason = reasonMatch[1];
            }
            
            // Try to extract criteria and level for house points
            const criteriaMatch = message.match(/Criteria: (.+?),/i);
            const levelMatch = message.match(/Level: (.+?)($|\s)/i);
            
            if (criteriaMatch) {
              criteria = criteriaMatch[1];
            }
            
            if (levelMatch) {
              level = levelMatch[1];
            }
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
          reason,
          criteria,
          level
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
              let criteria = null;
              let level = null;
              
              // Check if it's a point change notification
              if (notification.message) {
                // Remove "by admin" from message if present
                let message = notification.message.replace(' by admin', '');
                
                // Extract points change information
                if (message.includes('increased by') || message.includes('decreased by')) {
                  const match = message.match(/(increased|decreased) by (\d+)/);
                  if (match) {
                    const changeType = match[1];
                    const amount = parseInt(match[2], 10);
                    pointsChange = changeType === 'increased' ? amount : -amount;
                    // Update message without "by admin"
                    notification.message = message;
                  }
                }
                
                // Try to extract criteria and level
                if (notification.criteria) {
                  criteria = notification.criteria;
                }
                
                if (notification.level) {
                  level = notification.level;
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
                reason,
                criteria,
                level
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
    
    // More detailed debug logging
    console.log('Processing notification (DETAILED):', {
      id: nextNotification.id,
      type: nextNotification.type,
      message: nextNotification.message,
      reason: nextNotification.reason,
      criteria: nextNotification.criteria,
      level: nextNotification.level,
      source: nextNotification.source,
      pointsChange: nextNotification.pointsChange,
      fullObject: nextNotification
    });
    
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
    <Stack spacing={5} position="fixed" top="100px" right="20px" zIndex={1000} maxWidth="480px" maxHeight="calc(100vh - 150px)" overflowY="auto">
      {activeNotifications.map(notification => (
        <Fade key={notification.id} in={true}>
          <Box
            padding="0"
            borderRadius="12px"
            color="white"
            className="wizard-panel notification-panel"
            boxShadow="0 10px 30px rgba(0,0,0,0.5)"
            minHeight="auto" 
            width="100%"
            height="auto"
            position="relative"
            overflow="hidden"
            border="1px solid rgba(255, 255, 255, 0.2)"
            background={`linear-gradient(135deg, 
              ${notification.type === 'success' ? 'rgba(46, 204, 113, 0.95)' : 
                notification.type === 'warning' || notification.type === 'error' ? 'rgba(231, 76, 60, 0.95)' :
                notification.type === 'announcement' ? 'rgba(142, 68, 173, 0.95)' : 
                'rgba(52, 152, 219, 0.95)'} 0%,
              ${notification.type === 'success' ? 'rgba(39, 174, 96, 0.98)' : 
                notification.type === 'warning' || notification.type === 'error' ? 'rgba(192, 57, 43, 0.98)' :
                notification.type === 'announcement' ? 'rgba(113, 54, 138, 0.98)' : 
                'rgba(41, 128, 185, 0.98)'} 100%)`
            }
            transform="perspective(1000px)"
            _before={{
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `url(${notification.pointsChange > 0 ? increasePointImg : decreasePointImg}) no-repeat center`,
              backgroundSize: '250px',
              opacity: notification.pointsChange ? 0.07 : 0,
              zIndex: 0,
              filter: 'blur(2px)'
            }}
          >
            {/* Top ribbon with badge */}
            <Box 
              width="100%" 
              p="15px 15px 5px"
              borderBottom="1px solid rgba(255,255,255,0.2)"
              background="rgba(0,0,0,0.2)"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              backdropFilter="blur(10px)"
            >
              <Badge 
                fontSize="sm" 
                colorScheme={
                  notification.type === 'success' ? 'green' :
                  notification.type === 'warning' || notification.type === 'error' ? 'red' :
                  notification.type === 'announcement' ? 'purple' :
                  'blue'
                }
                px={3}
                py={1}
                borderRadius="full"
                fontWeight="bold"
              >
                {notification.title}
              </Badge>
              
              <CloseButton 
                size="sm"
                onClick={() => handleClose(notification.id)} 
                zIndex="3"
                _hover={{
                  background: "rgba(0,0,0,0.2)", 
                  transform: "scale(1.1)"
                }}
                transition="all 0.2s"
              />
            </Box>
            
            {/* Main content area */}
            <Box position="relative" zIndex={2} p={4}>
              {/* Point change visualization - more compact and magical */}
              {notification.pointsChange && (
                <Flex 
                  justifyContent="center" 
                  alignItems="center"
                  mb={3}
                  position="relative"
                  className="point-change-wrapper"
                >
                  <Box
                    position="relative"
                    width="130px"
                    height="130px"
                    borderRadius="50%"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    className={notification.pointsChange > 0 ? "point-glow-positive" : "point-glow-negative"}
                    background="rgba(0,0,0,0.2)"
                    border="2px solid rgba(255,255,255,0.3)"
                  >
                    <Text
                      fontSize="3xl"
                      fontWeight="bold"
                      color="white"
                      textShadow="0 0 10px rgba(0,0,0,0.5)"
                      className="points-text-animation"
                    >
                      {notification.pointsChange > 0 ? `+${notification.pointsChange}` : notification.pointsChange}
                    </Text>
                    
                    {/* Orbiting particles */}
                    <Box className="orbiting-particles">
                      {[...Array(12)].map((_, i) => (
                        <Box 
                          key={i} 
                          className="particle" 
                          style={{
                            '--angle': `${i * 30}deg`,
                            '--delay': `${i * 0.1}s`,
                            backgroundColor: notification.pointsChange > 0 ? '#2ecc71' : '#e74c3c'
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Flex>
              )}
              
              {/* Message with parchment-like styling */}
              <Box 
                bg="rgba(255,255,255,0.15)" 
                p={4} 
                borderRadius="md" 
                backdropFilter="blur(10px)"
                boxShadow="0 4px 8px rgba(0,0,0,0.1)"
                mb={3}
                className="message-parchment"
              >
                <Text 
                  fontSize="md" 
                  fontWeight="semibold"
                  fontFamily="'Cinzel', serif"
                  letterSpacing="0.5px"
                  color="white"
                  textShadow="0 1px 2px rgba(0,0,0,0.5)"
                >
                  {notification.message}
                </Text>
              </Box>
              
              {/* House points details section */}
              {(notification.reason || notification.criteria || notification.level) && (
                <Box 
                  borderRadius="md"
                  overflow="hidden"
                  className="details-scroll"
                  border="1px solid rgba(255,255,255,0.2)"
                >
                  {/* Reason section with icon */}
                  {notification.reason && (
                    <Box 
                      p={3}
                      borderBottom={notification.criteria || notification.level ? "1px solid rgba(255,255,255,0.1)" : "none"}
                      bg="rgba(0,0,0,0.15)"
                    >
                      <Flex alignItems="center">
                        <Box 
                          width="24px" 
                          height="24px" 
                          borderRadius="50%" 
                          bg="rgba(255,255,255,0.2)" 
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                        >
                          <Text fontSize="xs" fontWeight="bold">R</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="xs" opacity="0.8" mb="2px">REASON</Text>
                          <Text fontSize="sm" fontWeight="medium">{notification.reason}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Criteria section with icon */}
                  {notification.criteria && (
                    <Box 
                      p={3}
                      borderBottom={notification.level ? "1px solid rgba(255,255,255,0.1)" : "none"}
                      bg="rgba(0,0,0,0.1)"
                    >
                      <Flex alignItems="center">
                        <Box 
                          width="24px" 
                          height="24px" 
                          borderRadius="50%" 
                          bg="rgba(255,255,255,0.2)" 
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                        >
                          <Text fontSize="xs" fontWeight="bold">C</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="xs" opacity="0.8" mb="2px">CRITERIA</Text>
                          <Text fontSize="sm" fontWeight="medium">{notification.criteria}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Level section with icon */}
                  {notification.level && (
                    <Box 
                      p={3}
                      bg="rgba(0,0,0,0.15)"
                    >
                      <Flex alignItems="center">
                        <Box 
                          width="24px" 
                          height="24px" 
                          borderRadius="50%" 
                          bg="rgba(255,255,255,0.2)" 
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                        >
                          <Text fontSize="xs" fontWeight="bold">L</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="xs" opacity="0.8" mb="2px">LEVEL</Text>
                          <Text fontSize="sm" fontWeight="medium">{notification.level}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Timestamp footer */}
              <Text 
                fontSize="xs" 
                color="rgba(255,255,255,0.7)" 
                textAlign="right"
                mt={2}
                fontStyle="italic"
              >
                {new Date(notification.timestamp).toLocaleTimeString()}
              </Text>
            </Box>
          </Box>
        </Fade>
      ))}
      
      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes pop-in {
          0% { transform: scale(0.9) translateY(-10px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        
        @keyframes float-0 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(0.5deg); }
        }
        
        @keyframes float-1 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-0.5deg); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(0.3deg); }
        }
        
        .notification-panel {
          animation: pop-in 0.4s ease-out, float-${Math.floor(Math.random() * 3)} 4s ease-in-out infinite;
          transform-origin: center center;
        }
        
        .notification-panel::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255,255,255,0.7);
          z-index: 10;
          animation: wipe-through 3s linear forwards;
        }
        
        @keyframes wipe-through {
          0% { left: 0; right: 100%; }
          100% { left: 0; right: 0; }
        }
        
        .points-text-animation {
          animation: pulse-text 2s infinite;
          position: relative;
          z-index: 3;
        }
        
        @keyframes pulse-text {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        
        .point-glow-positive {
          box-shadow: 0 0 20px rgba(46, 204, 113, 0.7);
          animation: pulse-glow-positive 2s infinite;
        }
        
        .point-glow-negative {
          box-shadow: 0 0 20px rgba(231, 76, 60, 0.7);
          animation: pulse-glow-negative 2s infinite;
        }
        
        @keyframes pulse-glow-positive {
          0%, 100% { box-shadow: 0 0 15px rgba(46, 204, 113, 0.7); }
          50% { box-shadow: 0 0 30px rgba(46, 204, 113, 0.9); }
        }
        
        @keyframes pulse-glow-negative {
          0%, 100% { box-shadow: 0 0 15px rgba(231, 76, 60, 0.7); }
          50% { box-shadow: 0 0 30px rgba(231, 76, 60, 0.9); }
        }
        
        .message-parchment {
          position: relative;
          animation: hover-gentle 3s ease-in-out infinite;
        }
        
        @keyframes hover-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        
        .details-scroll {
          position: relative;
          transform: translateZ(0);
          transition: all 0.3s;
        }
        
        .details-scroll:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .orbiting-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          animation: rotate-slow 15s linear infinite;
        }
        
        .orbiting-particles .particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          top: calc(50% - 3px);
          left: calc(50% - 3px);
          transform-origin: center 65px;
          transform: rotate(var(--angle)) translateY(-65px);
          animation: particle-pulse 2s ease-in-out infinite;
          animation-delay: var(--delay);
        }
        
        @keyframes rotate-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes particle-pulse {
          0%, 100% { opacity: 0.4; transform: rotate(var(--angle)) translateY(-65px) scale(1); }
          50% { opacity: 1; transform: rotate(var(--angle)) translateY(-65px) scale(1.5); }
        }
      `}</style>
    </Stack>
  );
};

export default NotificationDisplay;