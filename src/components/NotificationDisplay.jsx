import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Box, Text, Badge, CloseButton, Fade, Stack, Image, Flex } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/notification.css';
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

// Placeholder for PointChangeVisualization component
const PointChangeVisualization = ({ pointsChange, increasePointImg, decreasePointImg }) => (
  <Box>
    <Text>{pointsChange > 0 ? 'Increased' : 'Decreased'} by {Math.abs(pointsChange)}</Text>
    {/* Basic visualization, replace with actual component if available */}
    <Image src={pointsChange > 0 ? increasePointImg : decreasePointImg} alt="Points change" />
  </Box>
);

// Placeholder for getNotificationTitle
const getNotificationTitle = (type) => {
  // Basic implementation, customize as needed
  switch (type) {
    case 'success': return 'Success!';
    case 'warning': return 'Warning!';
    case 'error': return 'Error!';
    case 'info': return 'Information';
    case 'announcement': return 'Announcement';
    default: return 'Notification';
  }
};

// Placeholder for getDurationByType
const getDurationByType = (type) => {
  // Basic implementation, customize as needed
  switch (type) {
    case 'error': return 10000; // 10 seconds for errors
    case 'announcement': return 8000; // 8 seconds for announcements
    default: return 5000; // 5 seconds for others
  }
};

// Placeholder for processNotificationQueue
// This function likely belongs in a context or a shared utility,
// as it seems to manage a global queue.
// For now, defining it here to resolve the immediate error.
const processNotificationQueue = () => {
  console.log('[NotificationDisplay] processNotificationQueue called (placeholder)');
  // Actual queue processing logic would go here.
};

const standardizeCriteria = (criteria) => {
  if (!criteria) return '';
  return criteria
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const standardizeLevel = (level) => {
  if (!level) return '';
  return level
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const NotificationDisplay = () => {
  const [activeNotifications, setActiveNotifications] = useState([]);
  const { user } = useAuth();
  const animationFrameRef = useRef(null);
  const lastRenderTime = useRef(0);
  const FPS_LIMIT = 60;
  const FRAME_TIME = 1000 / FPS_LIMIT;

  const socketContext = useSocket();
  const socketNotifications = useMemo(() => socketContext?.notifications || [], [socketContext?.notifications]);

  const removeNotificationFromContext = useCallback((id) => {
    socketContext?.removeNotification?.(id);
  }, [socketContext]);

  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const activeTimeouts = useRef([]);
  const globalDedupeRegistry = useRef(new Map());

  const MAX_ACTIVE_NOTIFICATIONS = 1;

  const handleClose = useCallback((id) => {
    setActiveNotifications(prev => prev.filter(item => item.id !== id));
    removeNotificationFromContext(id);
  }, [removeNotificationFromContext]);

  const getNotificationHash = (notification) => {
    const type = notification.type || 'info';
    const pointsChange = notification.pointsChange ? `pc:${notification.pointsChange}` : '';
    const criteria = notification.criteria ? `cr:${standardizeCriteria(notification.criteria || '')}` : '';
    const level = notification.level ? `lv:${standardizeLevel(notification.level || '')}` : '';
    const reason = notification.reason ? `rs:${notification.reason.substring(0, 50)}` : '';
    const msgStart = notification.message ? notification.message.substring(0, 30) : '';

    return `${type}|${pointsChange}|${criteria}|${level}|${reason}|${msgStart}`;
  };

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

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      globalDedupeRegistry.current.forEach((timestamp, key) => {
        if (now - timestamp > 60000) {
          globalDedupeRegistry.current.delete(key);
        }
      });
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    return () => {
      activeTimeouts.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

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

    checkLocalFallbackNotifications();
    const interval = setInterval(checkLocalFallbackNotifications, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleHousePointsUpdate = (event) => {
      console.log('[NOTIFICATION] Received house-points-update event:', event.detail);
    };

    window.addEventListener('house-points-update', handleHousePointsUpdate);

    return () => {
      window.removeEventListener('house-points-update', handleHousePointsUpdate);
    };
  }, []);

  useEffect(() => {
    if (activeNotifications.length === 0) return;
    const currentNotification = activeNotifications[0];
    const timer = setTimeout(() => {
      setActiveNotifications(prev => prev.slice(1));
      if (currentNotification && currentNotification.id) {
        removeNotificationFromContext(currentNotification.id);
      }
    }, currentNotification?.duration || 5000);
    return () => clearTimeout(timer);
  }, [activeNotifications, removeNotificationFromContext]);

  const renderNotification = useCallback((notification) => (
    <Fade in={true} key={notification.id} unmountOnExit>
      <Box
        className={`notification-container ${notification.type || 'info'} magical-notification`}
        p={0}
        borderRadius="16px"
        boxShadow="0 8px 24px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0,0,0,0.1)"
        bg={
          notification.type === 'success' ? 'rgba(46, 204, 113, 0.6)' :
          notification.type === 'warning' ? 'rgba(241, 196, 15, 0.6)' :
          notification.type === 'error' ? 'rgba(231, 76, 60, 0.7)' :
          notification.type === 'announcement' ? 'rgba(142, 68, 173, 0.6)' :
          'rgba(52, 152, 219, 0.65)'
        }
        backdropFilter="blur(12px) saturate(150%)"
        border="1px solid rgba(255, 255, 255, 0.12)"
        overflow="hidden"
        width="100%"
      >
        <NotificationContent 
          notification={notification} 
          onClose={handleClose}
        />
      </Box>
    </Fade>
  ), [handleClose]);

  if (activeNotifications.length === 0) return null;

  return (
    <Stack
      spacing="16px"
      position="fixed"
      top="80px"
      right="24px"
      zIndex={1000}
      maxWidth="420px"
      width="auto"
      maxHeight="calc(100vh - 120px)"
    >
      {activeNotifications.map(renderNotification)}
    </Stack>
  );
};

const NotificationContent = memo(({ notification, onClose }) => {
  return (
    <>
      <Box 
        width="100%" 
        p="10px 15px"
        borderBottom="1px solid rgba(255, 255, 255, 0.1)"
        background="rgba(0,0,0,0.15)"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        <Badge 
          fontSize="0.75rem"
          colorScheme={
            notification.type === 'success' ? 'green' :
            notification.type === 'warning' ? 'yellow' :
            notification.type === 'error' ? 'red' :
            notification.type === 'announcement' ? 'purple' :
            'blue'
          }
          py={1}
          px={2.5}
          borderRadius="md"
          fontWeight="bold"
          variant="subtle"
        >
          {notification.type}
        </Badge>
        <CloseButton 
          onClick={() => onClose(notification.id)} 
          zIndex="3"
          color="rgba(255,255,255,0.7)"
          _hover={{
            background: "rgba(255,255,255,0.15)", 
            transform: "scale(1.15)",
            color: "rgba(255,255,255,1)"
          }}
          transition="all 0.2s ease-in-out"
        />
      </Box>
      
      <Box position="relative" zIndex={2} p="12px 15px">
        {notification.pointsChange && (
          <PointChangeVisualization 
            pointsChange={notification.pointsChange}
            increasePointImg={increasePointImg}
            decreasePointImg={decreasePointImg}
          />
        )}
        <NotificationMessage notification={notification} />
        <NotificationDetails notification={notification} />
      </Box>
    </>
  );
});

const NotificationMessage = memo(({ notification }) => (
  <Box
    bg="transparent"
    p={0}
    borderRadius="md"
    borderLeft="3px solid"
    borderColor={
      notification.type === 'success' ? 'green.300' :
      notification.type === 'warning' || notification.type === 'error' ? 'red.300' :
      notification.type === 'announcement' ? 'purple.300' :
      'blue.300'
    }
    pl={3}
  >
    <Text
      fontSize="md"
      fontWeight="medium"
      lineHeight="1.4"
      color="gray.100"
    >
      {notification.message}
    </Text>
  </Box>
));

const NotificationDetails = memo(({ notification }) => (
  <Box
    borderRadius="lg"
    overflow="hidden"
    mb={2}
  >
    {notification.reason && (
      <Box
        p={3}
        borderBottom={notification.criteria || notification.level || notification.additionalDetails ? "1px solid rgba(255,255,255,0.08)" : "none"}
        bg="rgba(0,0,0,0.1)"
        position="relative"
        _hover={{bg: "rgba(0,0,0,0.15)"}}
        transition="background-color 0.2s"
        borderRadius="md"
        mb={2}
      >
        <Flex alignItems="center">
          <Box
            width="32px"
            height="32px"
            borderRadius="md"
            bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.2)" : "rgba(231, 76, 60, 0.2)"}
            border="1px solid rgba(255,255,255,0.1)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mr={3}
            boxShadow="0 1px 3px rgba(0,0,0,0.15)"
          >
            <Text fontSize="md" fontWeight="bold" color="#f0c75e">📝</Text>
          </Box>
          <Box flex="1">
            <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase" letterSpacing="0.05em" mb="2px">Reason</Text>
            <Text fontSize="sm" fontWeight="medium" lineHeight="1.4" color="gray.100">{notification.reason}</Text>
          </Box>
        </Flex>
      </Box>
    )}
    {notification.criteria && (
      <Box
        p={3}
        borderBottom={notification.level || notification.additionalDetails ? "1px solid rgba(255,255,255,0.08)" : "none"}
        bg="rgba(0,0,0,0.1)"
        position="relative"
        _hover={{bg: "rgba(0,0,0,0.15)"}}
        transition="background-color 0.2s"
        borderRadius="md"
        mb={2}
      >
        <Flex alignItems="center">
          <Box
            width="32px"
            height="32px"
            borderRadius="md"
            bg={"rgba(52, 152, 219, 0.2)"}
            border="1px solid rgba(255,255,255,0.1)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mr={3}
            boxShadow="0 1px 3px rgba(0,0,0,0.15)"
          >
            <Text fontSize="md" fontWeight="bold" color="#5dade2">🎯</Text>
          </Box>
          <Box flex="1">
            <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase" letterSpacing="0.05em" mb="2px">Criteria</Text>
            <Text fontSize="sm" fontWeight="medium" lineHeight="1.4" color="gray.100">{notification.criteria}</Text>
          </Box>
        </Flex>
      </Box>
    )}
    {notification.level && (
      <Box
        p={3}
        borderBottom={notification.additionalDetails ? "1px solid rgba(255,255,255,0.08)" : "none"}
        bg="rgba(0,0,0,0.1)"
        position="relative"
        _hover={{bg: "rgba(0,0,0,0.15)"}}
        transition="background-color 0.2s"
        borderRadius="md"
        mb={2}
      >
        <Flex alignItems="center">
          <Box
            width="32px"
            height="32px"
            borderRadius="md"
            bg={"rgba(241, 196, 15, 0.2)"}
            border="1px solid rgba(255,255,255,0.1)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mr={3}
            boxShadow="0 1px 3px rgba(0,0,0,0.15)"
          >
            <Text fontSize="md" fontWeight="bold" color="#f1c40f">🌟</Text>
          </Box>
          <Box flex="1">
            <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase" letterSpacing="0.05em" mb="2px">Level</Text>
            <Text fontSize="sm" fontWeight="medium" lineHeight="1.4" color="gray.100">{notification.level}</Text>
          </Box>
        </Flex>
      </Box>
    )}
    {notification.additionalDetails && (
      <Box
        p={3}
        bg="rgba(0,0,0,0.1)"
        position="relative"
        _hover={{bg: "rgba(0,0,0,0.15)"}}
        transition="background-color 0.2s"
        borderRadius="md"
      >
        <Flex alignItems="center">
          <Box
            width="32px"
            height="32px"
            borderRadius="md"
            bg="rgba(240, 199, 94, 0.15)"
            border="1px solid rgba(255,255,255,0.1)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mr={3}
            boxShadow="0 1px 3px rgba(0,0,0,0.15)"
          >
            <Text fontSize="md" fontWeight="bold" color="#f0c75e">🗒️</Text>
          </Box>
          <Box flex="1">
            <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase" letterSpacing="0.05em" mb="2px">Additional Details</Text>
            <Text fontSize="sm" fontWeight="medium" lineHeight="1.4" color="gray.100">{notification.additionalDetails}</Text>
          </Box>
        </Flex>
      </Box>
    )}
  </Box>
));

export default NotificationDisplay;