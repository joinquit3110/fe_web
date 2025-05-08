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
  
  const MAX_ACTIVE_NOTIFICATIONS = 1;
  const NOTIFICATION_DURATION = {
    success: 8000,
    warning: 10000,
    error: 12000,
    announcement: 15000,
    default: 8000
  };

  // Enhanced notification hash generation
  const getNotificationHash = useCallback((notification) => {
    const type = notification.type || 'info';
    const pointsChange = notification.pointsChange ? `pc:${notification.pointsChange}` : '';
    const criteria = notification.criteria ? `cr:${notification.criteria}` : '';
    const level = notification.level ? `lv:${notification.level}` : '';
    const msgStart = notification.message ? notification.message.substring(0, 30) : '';
    const timestamp = notification.timestamp ? notification.timestamp.getTime().toString().substring(0, 8) : '';
    const house = notification.house || '';
    
    return `${type}|${pointsChange}|${criteria}|${level}|${msgStart}|${timestamp}|${house}`;
  }, []);

  // Enhanced notification processing with error handling
  const processSocketNotifications = useCallback((newNotifications) => {
    if (!newNotifications || newNotifications.length === 0) return;
    
    console.log('[NOTIFICATION] Processing socket notifications:', newNotifications);
    
    try {
      const processedNotifications = newNotifications
        .map(notification => {
          try {
            // Create a unique identifier based on content for deduplication
            const notificationHash = getNotificationHash(notification);
            
            // Check if we've seen this notification recently
            if (globalDedupeRegistry.current.has(notificationHash)) {
              console.log('[NOTIFICATION] Skipping duplicate notification:', notification);
              return null;
            }
            
            // Add to dedupe registry with expiry
            globalDedupeRegistry.current.set(notificationHash, Date.now());
            setTimeout(() => {
              globalDedupeRegistry.current.delete(notificationHash);
            }, 5000);
            
            // Validate notification data
            if (!notification.id) {
              notification.id = `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            
            if (!notification.timestamp) {
              notification.timestamp = new Date();
            }
            
            // Create socket notification with additional properties
            const socketNotification = {
              ...notification,
              source: 'socket',
              read: false,
              visible: true,
              created: notification.timestamp,
              duration: NOTIFICATION_DURATION[notification.type] || NOTIFICATION_DURATION.default
            };
            
            console.log('[NOTIFICATION] Created socket notification item:', socketNotification);
            return socketNotification;
          } catch (error) {
            console.error('[NOTIFICATION] Error processing notification:', error);
            return null;
          }
        })
        .filter(Boolean); // Remove null entries (duplicates or errors)
      
      // Only update state if we have valid notifications
      if (processedNotifications.length > 0) {
        notificationQueue.current.push(...processedNotifications);
        
        if (!processingQueue.current) {
          animationFrameRef.current = requestAnimationFrame(processNotificationQueue);
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error processing notification batch:', error);
    }
  }, [getNotificationHash]);

  // Enhanced notification queue processing with error handling
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
          return newNotifications.slice(0, MAX_ACTIVE_NOTIFICATIONS);
        });
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error processing notification queue:', error);
    } finally {
      processingQueue.current = false;
      
      if (notificationQueue.current.length > 0) {
        animationFrameRef.current = requestAnimationFrame(processNotificationQueue);
      }
    }
  }, []);

  // Enhanced notification display handling
  const handleNotificationDisplay = useCallback((notification) => {
    const duration = notification.duration || NOTIFICATION_DURATION.default;
    
    try {
      const timeout = setTimeout(() => {
        handleClose(notification.id);
      }, duration);
      
      activeTimeouts.current.push(timeout);
    } catch (error) {
      console.error('[NOTIFICATION] Error setting notification timeout:', error);
    }
  }, []);

  // Enhanced notification removal
  const handleClose = useCallback((id) => {
    try {
      setActiveNotifications(prev => prev.filter(item => item.id !== id));
      removeNotification(id);
    } catch (error) {
      console.error('[NOTIFICATION] Error removing notification:', error);
    }
  }, [removeNotification]);

  // Process socket notifications when they change
  useEffect(() => {
    if (socketNotifications.length === 0) return;
    processSocketNotifications(socketNotifications);
  }, [socketNotifications, processSocketNotifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      activeTimeouts.current.forEach(timeout => clearTimeout(timeout));
      activeTimeouts.current = [];
    };
  }, []);

  // Auto-dismiss notifications after duration
  useEffect(() => {
    if (activeNotifications.length === 0) return;
    
    const notification = activeNotifications[0];
    const duration = notification.duration || NOTIFICATION_DURATION.default;
    
    const timer = setTimeout(() => {
      handleClose(notification.id);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [activeNotifications, handleClose]);

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
    type: notification.type,
    isAssessment: notification.isAssessment
  });
  
  // Check if we have criteria and level data
  const hasCriteria = notification.criteria && notification.criteria.trim() !== '';
  const hasLevel = notification.level && notification.level.trim() !== '';
  
  // Determine if this is a house assessment notification
  const isAssessment = notification.isAssessment || (hasCriteria && hasLevel);
  
  // Check if reason is valid for display
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
            
            {/* Show assessment details if it's an assessment */}
            {isAssessment && (
              <>
                <Text 
                  as="span" 
                  color="cyan.200"
                  fontWeight="bold"
                  display="block"
                  mt={1}
                >
                  Assessment: {standardizeCriteria(notification.criteria)}
                </Text>
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
              </>
            )}
            
            {/* Show reason if provided and valid */}
            {!isAssessment && hasValidReason && (
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
            
            {/* Show new total if available */}
            {notification.newTotal !== undefined && (
              <Text 
                as="span" 
                color="white"
                fontWeight="bold"
                display="block"
                mt={1}
              >
                New Total: {notification.newTotal} points
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