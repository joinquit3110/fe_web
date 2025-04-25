import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Badge, CloseButton, Fade, Stack, Image, Flex } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
// Import the image assets
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

const NotificationDisplay = () => {
  const [activeNotifications, setActiveNotifications] = useState([]);
  const { user } = useAuth();
  
  // Get socket notifications directly from the SocketContext
  let socketNotifications = [];
  let removeNotification = () => {};
  
  try {
    const socketContext = useSocket();
    socketNotifications = socketContext?.notifications || [];
    removeNotification = socketContext?.removeNotification || (() => {});
  } catch (error) {
    console.warn('Socket context not available:', error.message);
  }
  
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const activeTimeouts = useRef([]);
  const globalDedupeRegistry = useRef(new Map());
  
  // Helper function to create a notification hash for deduplication
  const getNotificationHash = (notification) => {
    const type = notification.type || 'info';
    const pointsChange = notification.pointsChange ? `pc:${notification.pointsChange}` : '';
    const criteria = notification.criteria ? `cr:${notification.criteria}` : '';
    const level = notification.level ? `lv:${notification.level}` : '';
    const msgStart = notification.message ? notification.message.substring(0, 30) : '';
    
    return `${type}|${pointsChange}|${criteria}|${level}|${msgStart}`;
  };
  
  // Helper function to standardize criteria text
  const standardizeCriteria = (criteriaText) => {
    if (!criteriaText) return '';
    
    const lowerCriteria = criteriaText.toLowerCase();
    
    if (lowerCriteria.includes('participation') || lowerCriteria.includes('member')) {
      return 'Level of participation of group members';
    }
    
    if (lowerCriteria.includes('english') || lowerCriteria.includes('language')) {
      return 'Level of English usage in the group';
    }
    
    if (lowerCriteria.includes('time') || lowerCriteria.includes('complete') || lowerCriteria.includes('task')) {
      return 'Time taken by the group to complete tasks';
    }
    
    return criteriaText;
  };
  
  // Helper function to standardize performance level text
  const standardizeLevel = (levelText) => {
    if (!levelText) return '';
    
    const lowerLevel = levelText.toLowerCase();
    
    if (lowerLevel.includes('excellent')) return 'Excellent';
    if (lowerLevel.includes('good')) return 'Good';
    if (lowerLevel.includes('satisfactory')) return 'Satisfactory';
    if (lowerLevel.includes('poor') && lowerLevel.includes('very')) return 'Very Poor';
    if (lowerLevel.includes('poor')) return 'Poor';
    
    return levelText;
  };
  
  // Extract criteria and level
  const extractCriteriaAndLevel = (notification) => {
    let { message, criteria, level } = notification;
    
    if (criteria && level) {
      return {
        criteria: standardizeCriteria(criteria),
        level: standardizeLevel(level)
      };
    }
    
    if (message) {
      if (!criteria) {
        const criteriaMatch = message.match(/[Cc]riteria:?\s*(.+?)(?=\.|$|\s*Level:|\s*Reason:)/);
        if (criteriaMatch) {
          criteria = criteriaMatch[1].trim();
        }
      }
      
      if (!level) {
        const levelMatch = message.match(/[Ll]evel:?\s*(.+?)(?=\.|$|\s*Criteria:|\s*Reason:)/);
        if (levelMatch) {
          level = levelMatch[1].trim();
        }
      }
    }
    
    // Fix potentially swapped values
    if (level && (
        level.toLowerCase().includes('participation') || 
        level.toLowerCase().includes('english') ||
        level.toLowerCase().includes('complete tasks')
    )) {
      const tempCriteria = level;
      level = criteria;
      criteria = tempCriteria;
    }
    
    return {
      criteria: criteria ? standardizeCriteria(criteria) : '',
      level: level ? standardizeLevel(level) : ''
    };
  };
  
  // Cleanup stale dedupe entries every minute
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      globalDedupeRegistry.current.forEach((timestamp, key) => {
        if (now - timestamp > 60000) { // 1 minute (reduced from 2 min)
          globalDedupeRegistry.current.delete(key);
        }
      });
    }, 30000); // Run cleanup every 30 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      activeTimeouts.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, []);
  
  // Process fallback notifications from localStorage
  useEffect(() => {
    const checkLocalFallbackNotifications = () => {
      try {
        const pendingNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
        
        if (pendingNotifications.length > 0) {
          console.log('[NOTIFICATION] Processing local fallback notifications:', pendingNotifications.length);
          
          pendingNotifications.forEach(notification => {
            if (!notificationQueue.current.some(item => item.id === notification.id)) {
              const notificationItem = {
                id: notification.id,
                type: notification.type || 'info',
                title: notification.title || getNotificationTitle(notification.type || 'info'),
                message: notification.message,
                timestamp: new Date(notification.timestamp),
                source: 'local-fallback',
                duration: getDurationByType(notification.type || 'info'),
                pointsChange: notification.pointsChange,
                reason: notification.reason,
                criteria: notification.criteria || notification.typeDetails?.criteria,
                level: notification.level || notification.typeDetails?.level
              };
              notificationQueue.current.push(notificationItem);
            }
          });
          
          localStorage.setItem('pendingNotifications', '[]');
          
          if (!processingQueue.current) {
            processNotificationQueue();
          }
        }
      } catch (error) {
        console.error('Error processing local fallback notifications:', error);
      }
    };
    
    // Initial check and set interval (reduced from 3000ms to 2000ms)
    checkLocalFallbackNotifications();
    const interval = setInterval(checkLocalFallbackNotifications, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Process socket notifications when they change
  useEffect(() => {
    if (socketNotifications.length > 0) {
      socketNotifications.forEach(notification => {
        // Extract data from notification
        let pointsChange = notification.pointsChange !== undefined ? notification.pointsChange : null;
        let reason = notification.reason || null;
        let criteria = notification.criteria || null;
        let level = notification.level || null;
        
        // Process message if available
        if (notification.message) {
          let message = notification.message.replace(/ by admin/g, '');
          
          // Extract points change if not already set
          if (pointsChange === null) {
            if (message.includes('increased by') || message.includes('decreased by')) {
              const match = message.match(/(increased|decreased) by (\d+)/);
              if (match) {
                const changeType = match[1];
                const amount = parseInt(match[2], 10);
                pointsChange = changeType === 'increased' ? amount : -amount;
              }
            }
            
            // Try alternative formats
            if (pointsChange === null) {
              const plusMatch = message.match(/\+(\d+) points/);
              const minusMatch = message.match(/\-(\d+) points/);
              const awardedMatch = message.match(/(\d+) points awarded to/);
              const deductedMatch = message.match(/(\d+) points deducted from/);
              
              if (plusMatch) pointsChange = parseInt(plusMatch[1], 10);
              else if (minusMatch) pointsChange = -parseInt(minusMatch[1], 10);
              else if (awardedMatch) pointsChange = parseInt(awardedMatch[1], 10);
              else if (deductedMatch) pointsChange = -parseInt(deductedMatch[1], 10);
            }
          }
          
          // Extract reason, criteria and level
          if (!reason) {
            const reasonMatch = message.match(/[Rr]eason:?\s*(.+?)(?=\.|$|\s*Criteria:|\s*Level:)/);
            if (reasonMatch) reason = reasonMatch[1].trim();
          }
          
          if (!criteria || !level) {
            const extracted = extractCriteriaAndLevel({ message, criteria, level });
            criteria = extracted.criteria;
            level = extracted.level;
          }
          
          notification.message = message;
        }
        
        // Create notification item with all data
        const notificationItem = {
          id: notification.id,
          type: notification.type,
          title: notification.title || getNotificationTitle(notification.type),
          message: notification.message,
          timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
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
      
      // Process queue with minimal delay (30ms)
      if (!processingQueue.current) {
        const delayTimeoutId = setTimeout(() => {
          processNotificationQueue();
          activeTimeouts.current = activeTimeouts.current.filter(id => id !== delayTimeoutId);
        }, 30);
        
        activeTimeouts.current.push(delayTimeoutId);
      }
    }
  }, [socketNotifications]);
  
  // Helper functions for notification display
  const getNotificationTitle = (type) => {
    switch (type) {
      case 'success': return 'Success!';
      case 'warning': return 'Warning!';
      case 'error': return 'Error!';
      case 'announcement': return 'Announcement';
      default: return 'Notification';
    }
  };
  
  const getDurationByType = (type) => {
    switch (type) {
      case 'error': return 12000; // 12 seconds
      case 'warning': return 10000; // 10 seconds
      case 'success': return 8000; // 8 seconds
      case 'announcement': return 15000; // 15 seconds
      default: return 8000; // 8 seconds
    }
  };
  
  // Create random ID helper
  const createId = () => Math.random().toString(36).substring(2, 15);
  
  // Process notification queue with improved efficiency
  const processNotificationQueue = () => {
    if (notificationQueue.current.length === 0 || processingQueue.current) {
      return;
    }
    
    processingQueue.current = true;
    
    // Filter irrelevant notifications for user
    notificationQueue.current = notificationQueue.current.filter(notification => {
      // Skip point notifications for admin/muggle/unassigned users
      if (user?.house === 'admin' || user?.house === 'muggle' || !user?.house) {
        if (notification.pointsChange || 
            (notification.message && (
              notification.message.includes('points') || 
              notification.message.includes('Points') ||
              notification.message.toLowerCase().includes('house')
            ))) {
          return false;
        }
      }
      
      // Filter out "points updated to" notifications
      if (notification.message && (
          notification.message.includes('magic points have been updated to') ||
          notification.message.includes('magic points have been increased by') || 
          notification.message.includes('magic points have been decreased by')
      )) {
        return false;
      }
      
      return true;
    });

    // Standardize data and mark fresh notifications
    notificationQueue.current.forEach(notification => {
      if (notification.criteria || notification.level) {
        const extracted = extractCriteriaAndLevel(notification);
        notification.criteria = extracted.criteria;
        notification.level = extracted.level;
      }
      
      const timestamp = notification.timestamp instanceof Date ? 
        notification.timestamp.getTime() : 
        notification.timestamp ? new Date(notification.timestamp).getTime() : Date.now();
      
      notification.isFresh = Date.now() - timestamp < 10000; // 10 seconds
    });
    
    // Sort by timestamp (newest first)
    notificationQueue.current.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : Date.now();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : Date.now();
      return timeB - timeA;
    });
    
    // Deduplicate notifications
    const dedupeGroups = new Map();
    
    notificationQueue.current.forEach(notification => {
      const hash = getNotificationHash(notification);
      
      if (!notification.isFresh && globalDedupeRegistry.current.has(hash)) {
        return; // Skip recently seen notification
      }
      
      const key = notification.isFresh ? 
        `${notification.type}:${notification.pointsChange || ''}:${Date.now()}` : 
        `${notification.type}:${notification.pointsChange || ''}:${notification.criteria || ''}`;
      
      if (!dedupeGroups.has(key)) {
        dedupeGroups.set(key, []);
      }
      
      dedupeGroups.get(key).push(notification);
    });
    
    // Take only the newest notification from each group
    const uniqueNotifications = [];
    dedupeGroups.forEach((group) => {
      uniqueNotifications.push(group[0]);
    });
    
    notificationQueue.current = uniqueNotifications;
    
    // Process a notification
    const notification = notificationQueue.current.shift();
    if (notification) {
      // Add to dedupe registry
      const hash = getNotificationHash(notification);
      if (!notification.isFresh) {
        globalDedupeRegistry.current.set(hash, Date.now());
      }
      
      // Set appropriate title
      if (notification.pointsChange) {
        if (notification.pointsChange > 0 && (!notification.title || !notification.title.includes('POINTS'))) {
          notification.title = 'POINTS AWARDED!';
        } else if (notification.pointsChange < 0 && (!notification.title || !notification.title.includes('POINTS'))) {
          notification.title = 'POINTS DEDUCTED!';
        }
      }
      
      // Ensure valid timestamp
      if (!notification.timestamp) {
        notification.timestamp = new Date();
      } else if (!(notification.timestamp instanceof Date)) {
        try {
          notification.timestamp = new Date(notification.timestamp);
          if (isNaN(notification.timestamp.getTime())) {
            notification.timestamp = new Date();
          }
        } catch {
          notification.timestamp = new Date();
        }
      }
      
      // Generate ID and display notification
      const notifId = notification.id || createId();
      
      setActiveNotifications(prev => {
        const notifWithId = { ...notification, id: notifId };
        
        // Skip exact duplicates
        if (prev.some(n => n.id === notifId)) {
          return prev;
        }
        
        return [notifWithId, ...prev].slice(0, 5); // Keep max 5 active notifications
      });
      
      // Remove from SocketContext to prevent reprocessing
      if (notification.source === 'socket') {
        try {
          removeNotification(notification.id);
        } catch (error) {
          console.warn('Error removing notification:', error.message);
        }
      }
      
      // Set auto-dismiss timeout
      let duration = notification.duration || getDurationByType(notification.type) || 7000;
      
      // Reduce duration if there are more notifications waiting
      if (notificationQueue.current.length > 2) duration = Math.min(duration, 5000);
      if (notificationQueue.current.length > 4) duration = Math.min(duration, 3000);
      
      const timeoutId = setTimeout(() => {
        setActiveNotifications(prev => prev.filter(item => item.id !== notifId));
        activeTimeouts.current = activeTimeouts.current.filter(id => id !== timeoutId);
      }, duration);
      
      activeTimeouts.current.push(timeoutId);
      
      // Process next notification after short delay (75ms)
      const nextProcessTimeoutId = setTimeout(() => {
        processingQueue.current = false;
        processNotificationQueue();
        activeTimeouts.current = activeTimeouts.current.filter(id => id !== nextProcessTimeoutId);
      }, 75);
      
      activeTimeouts.current.push(nextProcessTimeoutId);
    } else {
      processingQueue.current = false;
    }
  };

  // Handle manual close
  const handleClose = (id) => {
    setActiveNotifications(prev => prev.filter(item => item.id !== id));
  };
  
  // Responsive check
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  if (activeNotifications.length === 0) return null;
  
  return (
    <Stack
      spacing={isMobile ? 2 : 5}
      position="fixed"
      top={isMobile ? '10px' : '100px'}
      right={isMobile ? '0' : '20px'}
      left={isMobile ? '0' : undefined}
      zIndex={1000}
      maxWidth={isMobile ? '98vw' : '480px'}
      width={isMobile ? '98vw' : 'auto'}
      maxHeight={isMobile ? 'calc(100vh - 20px)' : 'calc(100vh - 150px)'}
      overflowY="auto"
      alignItems={isMobile ? 'center' : 'flex-end'}
      px={isMobile ? 1 : 0}
    >
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
              {/* Point change visualization */}
              {notification.pointsChange && (
                <Box 
                  position="relative"
                  className="point-change-container"
                  width="100%"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  mb={4}
                  mt={1}
                >
                  <Box
                    position="relative"
                    width="200px"
                    height="200px"
                    className="image-container"
                  >
                    <Image 
                      src={notification.pointsChange > 0 ? increasePointImg : decreasePointImg}
                      alt={notification.pointsChange > 0 ? 'Points increased' : 'Points decreased'}
                      className={notification.pointsChange > 0 ? 'increase-animation' : 'decrease-animation'}
                      width="100%"
                      height="100%"
                      objectFit="contain"
                    />
                    
                    <Box
                      position="absolute"
                      bottom="25%"
                      left="0"
                      right="0"
                      textAlign="center"
                      zIndex={3}
                    >
                      <Text
                        fontSize="30px"
                        fontWeight="bold"
                        color={notification.pointsChange > 0 ? "#2ecc71" : "#e74c3c"}
                        className="points-text-animation"
                        textShadow="0 0 10px rgba(0,0,0,0.6)"
                        fontFamily="'Cinzel', serif"
                      >
                        {notification.pointsChange > 0 ? `+${notification.pointsChange}` : notification.pointsChange}
                      </Text>
                    </Box>
                    
                    {/* Point change glow effect */}
                    <Box
                      position="absolute"
                      top="0"
                      left="0"
                      right="0"
                      bottom="0"
                      borderRadius="50%"
                      className={notification.pointsChange > 0 ? "point-glow-positive" : "point-glow-negative"}
                      zIndex={1}
                      pointerEvents="none"
                    />
                  </Box>
                </Box>
              )}
              
              {/* Message with styling */}
              <Box 
                bg="rgba(255,255,255,0.15)" 
                p={4} 
                borderRadius="md" 
                backdropFilter="blur(5px)"
                boxShadow="0 4px 8px rgba(0,0,0,0.1)"
                mb={3}
                className="message-parchment"
                borderLeft="4px solid"
                borderColor={
                  notification.type === 'success' ? 'rgba(46, 204, 113, 0.8)' :
                  notification.type === 'warning' || notification.type === 'error' ? 'rgba(231, 76, 60, 0.8)' :
                  notification.type === 'announcement' ? 'rgba(142, 68, 173, 0.8)' :
                  'rgba(52, 152, 219, 0.8)'
                }
              >
                <Text 
                  fontSize="md" 
                  fontWeight="semibold"
                  fontFamily="'Cinzel', serif"
                  letterSpacing="0.5px"
                  color="white"
                  textShadow="0 1px 2px rgba(0,0,0,0.5)"
                  lineHeight="1.5"
                >
                  {notification.pointsChange && (
                    <>
                      <Text as="span">
                        {Math.abs(notification.pointsChange)} points {notification.pointsChange > 0 ? 'awarded to' : 'deducted from'} {notification.house || 'unknown'}
                      </Text>
                      
                      {notification.reason && (
                        <Text 
                          as="span" 
                          color={notification.pointsChange > 0 ? "yellow.300" : "orange.300"}
                          fontWeight="bold"
                        >
                          : {notification.reason}
                        </Text>
                      )}
                    </>
                  )}
                  
                  {!notification.pointsChange && notification.message}
                </Text>
              </Box>
              
              {/* Details section */}
              {(notification.reason || notification.criteria || notification.level) && (
                <Box 
                  borderRadius="md"
                  overflow="hidden"
                  className="details-scroll"
                  border="1px solid rgba(255,255,255,0.3)"
                  boxShadow="0 5px 15px rgba(0,0,0,0.2)"
                  mb={3}
                >
                  {/* Reason section */}
                  {notification.reason && (
                    <Box 
                      p={4}
                      borderBottom={notification.criteria || notification.level ? "1px solid rgba(255,255,255,0.2)" : "none"}
                      bg="rgba(0,0,0,0.2)"
                      position="relative"
                      _hover={{bg: "rgba(0,0,0,0.25)"}}
                      transition="all 0.2s"
                    >
                      <Flex alignItems="flex-start">
                        <Box 
                          width="32px" 
                          height="32px" 
                          borderRadius="50%" 
                          bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
                          border="2px solid rgba(255,255,255,0.4)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                          mt="2px"
                          boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                        >
                          <Text fontSize="sm" fontWeight="bold">R</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Reason</Text>
                          <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{notification.reason}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Criteria section */}
                  {notification.criteria && (
                    <Box 
                      p={4}
                      borderBottom={notification.level ? "1px solid rgba(255,255,255,0.2)" : "none"}
                      bg="rgba(0,0,0,0.15)"
                      position="relative"
                      _hover={{bg: "rgba(0,0,0,0.2)"}}
                      transition="all 0.2s"
                    >
                      <Flex alignItems="flex-start">
                        <Box 
                          width="32px" 
                          height="32px" 
                          borderRadius="50%" 
                          bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
                          border="2px solid rgba(255,255,255,0.4)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                          mt="2px"
                          boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                        >
                          <Text fontSize="sm" fontWeight="bold">C</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Criteria</Text>
                          <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{standardizeCriteria(notification.criteria)}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Level section */}
                  {notification.level && (
                    <Box 
                      p={4}
                      bg="rgba(0,0,0,0.2)"
                      position="relative"
                      _hover={{bg: "rgba(0,0,0,0.25)"}}
                      transition="all 0.2s"
                    >
                      <Flex alignItems="flex-start">
                        <Box 
                          width="32px" 
                          height="32px" 
                          borderRadius="50%" 
                          bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
                          border="2px solid rgba(255,255,255,0.4)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                          mt="2px"
                          boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                        >
                          <Text fontSize="sm" fontWeight="bold">L</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Level</Text>
                          <Text 
                            fontSize="md" 
                            fontWeight="medium" 
                            lineHeight="1.4"
                            p={2}
                            bg={
                              notification.level.toLowerCase().includes('excellent') ? 'rgba(46, 204, 113, 0.2)' :
                              notification.level.toLowerCase().includes('good') ? 'rgba(52, 152, 219, 0.2)' :
                              notification.level.toLowerCase().includes('satisfactory') ? 'rgba(241, 196, 15, 0.2)' :
                              notification.level.toLowerCase().includes('poor') ? 'rgba(231, 76, 60, 0.2)' :
                              'rgba(0,0,0,0.1)'
                            }
                            borderRadius="md"
                            display="inline-block"
                          >
                            {standardizeLevel(notification.level)}
                          </Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Timestamp */}
              <Text 
                fontSize="xs" 
                color="rgba(255,255,255,0.7)" 
                textAlign="right"
                mt={2}
                fontStyle="italic"
              >
                {notification.timestamp instanceof Date && !isNaN(notification.timestamp.getTime()) 
                  ? notification.timestamp.toLocaleTimeString()
                  : new Date().toLocaleTimeString()}
              </Text>
            </Box>
          </Box>
        </Fade>
      ))}
      
      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes pop-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .notification-panel {
          animation: pop-in 0.3s ease-out;
          transform-origin: center center;
        }
        
        @keyframes points-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); text-shadow: 0 0 15px rgba(0,0,0,0.8); }
        }
        
        .points-text-animation {
          animation: points-pulse 1.5s ease-in-out infinite;
        }
        
        .point-glow-positive {
          box-shadow: 0 0 15px rgba(46, 204, 113, 0.7);
          animation: glow-positive 2s ease-in-out infinite;
        }
        
        @keyframes glow-positive {
          0%, 100% { box-shadow: 0 0 15px rgba(46, 204, 113, 0.7); }
          50% { box-shadow: 0 0 25px rgba(46, 204, 113, 1); }
        }
        
        .point-glow-negative {
          box-shadow: 0 0 15px rgba(231, 76, 60, 0.7);
          animation: glow-negative 2s ease-in-out infinite;
        }
        
        @keyframes glow-negative {
          0%, 100% { box-shadow: 0 0 15px rgba(231, 76, 60, 0.7); }
          50% { box-shadow: 0 0 25px rgba(231, 76, 60, 1); }
        }
        
        .image-container {
          position: relative;
          transform-origin: center center;
          animation: container-float 3s ease-in-out infinite;
        }
        
        @keyframes container-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .increase-animation {
          filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7));
          animation: increase-image-animation 3s ease-in-out infinite;
        }
        
        @keyframes increase-image-animation {
          0% { filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7)); transform: rotate(-2deg) scale(1); }
          50% { filter: drop-shadow(0 0 25px rgba(46, 204, 113, 1)); transform: rotate(2deg) scale(1.1); }
          100% { filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7)); transform: rotate(-2deg) scale(1); }
        }
        
        .decrease-animation {
          filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7));
          animation: decrease-image-animation 3s ease-in-out infinite;
        }
        
        @keyframes decrease-image-animation {
          0% { filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7)); transform: rotate(2deg) scale(1); }
          50% { filter: drop-shadow(0 0 25px rgba(231, 76, 60, 1)); transform: rotate(-2deg) scale(1.1); }
          100% { filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7)); transform: rotate(2deg) scale(1); }
        }
      `}</style>
    </Stack>
  );
};

export default NotificationDisplay;