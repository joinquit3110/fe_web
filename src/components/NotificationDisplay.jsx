import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Box, Text, Badge, CloseButton, Fade, Stack, Image, Flex, Heading, VStack } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/notification.css';
// Import the image assets
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';
// Import the NotificationDetails component
import NotificationDetails from './NotificationDetails';

// Helper function to standardize criteria text
const standardizeCriteria = (criteria) => {
  if (!criteria) return '';
  return criteria
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to standardize level text
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
  
  // Get socket notifications with memoization
  const socketContext = useSocket();
  const socketNotifications = useMemo(() => socketContext?.notifications || [], [socketContext?.notifications]);
  const removeNotification = useCallback((id) => {
    socketContext?.removeNotification?.(id);
  }, [socketContext]);
  
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const activeTimeouts = useRef([]);
  const globalDedupeRegistry = useRef(new Map());
  
  const MAX_ACTIVE_NOTIFICATIONS = 1; // Only show 1 notification at a time
  
  // Helper function to create a notification hash for deduplication
  const getNotificationHash = (notification) => {
    const type = notification.type || 'info';
    const pointsChange = notification.pointsChange ? `pc:${notification.pointsChange}` : '';
    const criteria = notification.criteria ? `cr:${notification.criteria}` : '';
    const level = notification.level ? `lv:${notification.level}` : '';
    const msgStart = notification.message ? notification.message.substring(0, 30) : '';
    
    return `${type}|${pointsChange}|${criteria}|${level}|${msgStart}`;
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
  
  // Listen for custom house points update events
  useEffect(() => {
    const handleHousePointsUpdate = (event) => {
      console.log('[NOTIFICATION] Received house-points-update event:', event.detail);
      console.log('[NOTIFICATION] Detail fields:', {
        house: event.detail.house,
        points: event.detail.points,
        reason: event.detail.reason,
        criteria: event.detail.criteria,
        level: event.detail.level
      });
      
      const { house, points, reason, criteria, level, timestamp } = event.detail;
      if (!user || user.house !== house) return;
      
      // Create a house points notification directly
      const notificationItem = {
        id: `house_points_${Date.now()}`,
        type: points > 0 ? 'success' : 'warning',
        title: points > 0 ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
        message: `${Math.abs(points)} points ${points > 0 ? 'awarded to' : 'deducted from'} ${house}`,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        source: 'custom-event',
        duration: getDurationByType(points > 0 ? 'success' : 'warning'),
        pointsChange: points,
        reason: reason || 'House points update',
        criteria,
        level,
        house: house
      };
      
      console.log('[NOTIFICATION] Created notification item:', notificationItem);
      
      notificationQueue.current.push(notificationItem);
      
      if (!processingQueue.current) {
        requestAnimationFrame(processNotificationQueue);
      }
    };
    
    window.addEventListener('house-points-update', handleHousePointsUpdate);
    
    return () => {
      window.removeEventListener('house-points-update', handleHousePointsUpdate);
    };
  }, [user]);
  
  // Optimize notification queue processing
  const processNotificationQueue = useCallback(() => {
    if (processingQueue.current) return;
    const now = performance.now();
    const elapsed = now - lastRenderTime.current;
    if (elapsed < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(processNotificationQueue);
      return;
    }
    lastRenderTime.current = now;
    processingQueue.current = true;
    try {
      // Only process 1 notification at a time
      const batchSize = 1;
      const batch = notificationQueue.current.splice(0, batchSize);
      if (batch.length > 0) {
        setActiveNotifications(prev => {
          const newNotifications = [...batch, ...prev];
          return newNotifications.slice(0, MAX_ACTIVE_NOTIFICATIONS); // Only 1 active notification
        });
      }
    } finally {
      processingQueue.current = false;
      if (notificationQueue.current.length > 0) {
        animationFrameRef.current = requestAnimationFrame(processNotificationQueue);
      }
    }
  }, []);
  
  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Optimize socket notification processing
  useEffect(() => {
    if (socketNotifications.length === 0) return;
    
    console.log('[NOTIFICATION] Processing socket notifications:', socketNotifications);
    
    socketNotifications.forEach(notification => {
      if (!notificationQueue.current.some(item => item.id === notification.id)) {
        const notificationItem = {
          id: notification.id,
          type: notification.type,
          title: notification.title || getNotificationTitle(notification.type),
          message: notification.message,
          timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
          source: 'socket',
          duration: getDurationByType(notification.type),
          pointsChange: notification.pointsChange,
          reason: notification.reason,
          criteria: notification.criteria,
          level: notification.level
        };
        
        console.log('[NOTIFICATION] Created socket notification item:', notificationItem);
        
        notificationQueue.current.push(notificationItem);
      }
    });
    
    if (!processingQueue.current) {
      animationFrameRef.current = requestAnimationFrame(processNotificationQueue);
    }
  }, [socketNotifications, processNotificationQueue]);
  
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
  
  // Optimize notification removal
  const handleClose = useCallback((id) => {
    setActiveNotifications(prev => prev.filter(item => item.id !== id));
  }, []);
  
  // Memoize notification rendering
  const renderNotification = useCallback((notification) => (
    <Fade key={notification.id} in={true}>
      <Box
        padding="0"
        borderRadius="18px"
        color="white"
        className="wizard-panel notification-panel magic-glow"
        boxShadow="0 0 40px 10px rgba(80,0,200,0.25), 0 10px 30px rgba(0,0,0,0.5)"
        minHeight="auto"
        width="100%"
        height="auto"
        position="relative"
        overflow="hidden"
        border="2px solid rgba(255, 255, 255, 0.4)"
        background={`radial-gradient(circle at 60% 40%, rgba(80,0,200,0.18) 0%, rgba(52, 152, 219, 0.95) 100%)`}
        style={{
          filter: 'drop-shadow(0 0 30px #a084ee) blur(0.5px)',
          backdropFilter: 'blur(6px)'
        }}
      >
        <NotificationContent 
          notification={notification} 
          onClose={handleClose}
        />
      </Box>
    </Fade>
  ), [handleClose]);
  
  // Responsive check
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  // In useEffect for activeNotifications, auto-dismiss after duration
  useEffect(() => {
    if (activeNotifications.length === 0) return;
    const timer = setTimeout(() => {
      setActiveNotifications(prev => prev.slice(1));
    }, activeNotifications[0]?.duration || 5000);
    return () => clearTimeout(timer);
  }, [activeNotifications]);

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
      {activeNotifications.map(renderNotification)}
      
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
        
        .magic-glow {
          box-shadow: 0 0 40px 10px #a084ee, 0 0 80px 20px #f0c75e44;
          border: 2px solid #f0c75e;
          animation: magic-glow-anim 2.5s ease-in-out infinite alternate;
        }
        @keyframes magic-glow-anim {
          0% { box-shadow: 0 0 40px 10px #a084ee, 0 0 80px 20px #f0c75e44; }
          100% { box-shadow: 0 0 60px 20px #f0c75e, 0 0 120px 40px #a084ee44; }
        }
      `}</style>
    </Stack>
  );
};

// Separate notification content component for better performance
const NotificationContent = memo(({ notification, onClose }) => {
  return (
    <>
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
          onClick={() => onClose(notification.id)} 
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
        <PointChangeVisualization 
          pointsChange={notification.pointsChange}
          increasePointImg={increasePointImg}
          decreasePointImg={decreasePointImg}
        />
        
        {/* Message with styling */}
        <NotificationMessage notification={notification} />
        
        {/* Details section using the external component */}
        <NotificationDetails notification={notification} />
        
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
    </>
  );
});

// Separate point change visualization component
const PointChangeVisualization = memo(({ pointsChange, increasePointImg, decreasePointImg }) => (
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
        src={pointsChange > 0 ? increasePointImg : decreasePointImg}
        alt={pointsChange > 0 ? 'Points increased' : 'Points decreased'}
        className={pointsChange > 0 ? 'increase-animation' : 'decrease-animation'}
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
          color={pointsChange > 0 ? "#2ecc71" : "#e74c3c"}
          className="points-text-animation"
          textShadow="0 0 10px rgba(0,0,0,0.6)"
          fontFamily="'Cinzel', serif"
        >
          {pointsChange > 0 ? `+${pointsChange}` : pointsChange}
        </Text>
      </Box>
      
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        borderRadius="50%"
        className={pointsChange > 0 ? "point-glow-positive" : "point-glow-negative"}
        zIndex={1}
        pointerEvents="none"
      />
    </Box>
  </Box>
));

// Separate message component
const NotificationMessage = memo(({ notification }) => {
  console.log('[NOTIFICATION_MESSAGE] Rendering notification:', {
    pointsChange: notification.pointsChange,
    reason: notification.reason,
    criteria: notification.criteria,
    level: notification.level,
    type: notification.type
  });
  
  // Check if we have criteria and level data
  const hasCriteria = notification.criteria && notification.criteria.trim() !== '';
  const hasLevel = notification.level && notification.level.trim() !== '';
  
  // Determine if this is a regular house point or house assessment notification
  const isAssessment = hasCriteria || hasLevel;
  
  // Check if reason is valid for display (not a default system message)
  const hasValidReason = notification.reason && 
                       notification.reason !== 'System update' && 
                       notification.reason !== 'House points update' && 
                       notification.reason !== 'Point update' &&
                       notification.reason !== 'Admin action';

  return (
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
            {/* Main message showing points change */}
            <Text as="span">
              {Math.abs(notification.pointsChange)} points {notification.pointsChange > 0 ? 'awarded to' : 'deducted from'} {notification.house || 'unknown'}
            </Text>
            
            {/* Only show reason if admin provided one (not system default) */}
            {hasValidReason && (
              <Text 
                as="span" 
                color={notification.pointsChange > 0 ? "yellow.300" : "orange.300"}
                fontWeight="bold"
                display="block"
                mt={1}
              >
                Reason: {notification.reason}
              </Text>
            )}
            
            {/* Only show criteria details if provided */}
            {hasCriteria && (
              <Text 
                as="span" 
                color="cyan.200"
                fontWeight="bold"
                display="block"
                mt={1}
              >
                Criteria: {standardizeCriteria(notification.criteria)}
              </Text>
            )}
            
            {/* Only show level details if provided */}
            {hasLevel && (
              <Text 
                as="span" 
                color={
                  notification.level.toLowerCase().includes('excellent') ? 'green.300' :
                  notification.level.toLowerCase().includes('good') ? 'blue.300' :
                  notification.level.toLowerCase().includes('satisfactory') ? 'yellow.300' :
                  notification.level.toLowerCase().includes('poor') ? 'red.300' :
                  'gray.300'
                }
                fontWeight="bold"
                display="block"
                mt={1}
              >
                Level: {standardizeLevel(notification.level)}
              </Text>
            )}
          </>
        )}
        
        {!notification.pointsChange && notification.message}
      </Text>
    </Box>
  );
});

export default NotificationDisplay;