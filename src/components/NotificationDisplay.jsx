import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Box, 
  Text, 
  Image,
  VStack,
  CloseButton,
  useDisclosure,
  Collapse,
  Badge,
  Heading,
  Flex,
  Stack
} from '@chakra-ui/react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import '../styles/notification.css';

// Import images for point change animations
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

// Helper function to standardize criteria text
const standardizeCriteria = (criteria) => {
  if (!criteria) return '';
  
  // Trim and standardize common criteria formats
  let normalized = criteria.trim();
  
  // Handle known criteria types
  if (normalized.toLowerCase().includes('participation')) {
    return 'Participation';
  } else if (normalized.toLowerCase().includes('english')) {
    return 'English Usage';
  } else if (normalized.toLowerCase().includes('homework')) {
    return 'Homework';
  } else if (normalized.toLowerCase().includes('assignment')) {
    return 'Assignment';
  } else if (normalized.toLowerCase().includes('quiz')) {
    return 'Quiz';
  } else if (normalized.toLowerCase().includes('test')) {
    return 'Test';
  }
  
  // Return original if no matches
  return normalized;
};

// Helper function to extract criteria and level from a notification
function extractCriteriaAndLevel(notification) {
  let criteria = null;
  let level = null;

  // Check for predefined criteria in the notification
  if (notification.criteria) {
    criteria = standardizeCriteria(notification.criteria);
  }

  // Check for level in the notification
  if (notification.level) {
    level = notification.level;
  }

  // Try to extract from message if not explicitly defined
  if (!criteria && notification.message) {
    const criteriaMatch = notification.message.match(/for\s+([^:]+)(?::|$)/i);
    if (criteriaMatch && criteriaMatch[1]) {
      criteria = standardizeCriteria(criteriaMatch[1].trim());
    }
  }

  // Extract level from reason if available
  if (!level && notification.reason) {
    const levelMatch = notification.reason.match(/\b(excellent|good|satisfactory|poor|basic)\b/i);
    if (levelMatch && levelMatch[1]) {
      level = levelMatch[1].toLowerCase();
    }
  }

  return { criteria, level };
}

// Notification display component
const NotificationDisplay = () => {
  const { notifications, removeNotification } = useSocket();
  const { user } = useAuth();
  const [activeNotification, setActiveNotification] = useState(null);
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const timerRef = useRef(null);
  const activeTimeouts = useRef([]);
  const globalDedupeRegistry = useRef(new Map());
  
  // Helper function to get notification title based on type
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
      case 'error': return 12000; // 12 seconds
      case 'warning': return 10000; // 10 seconds
      case 'success': return 8000; // 8 seconds
      case 'announcement': return 15000; // 15 seconds
      default: return 8000; // 8 seconds
    }
  };
  
  // Process notification queue
  const processQueue = () => {
    if (processingQueue.current || notificationQueue.current.length === 0) {
      return;
    }
    
    processingQueue.current = true;
    const next = notificationQueue.current.shift();
    setActiveNotification(next);
    
    // Clear any existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Auto-dismiss after a delay unless it's an important notification
    const displayTime = getDurationByType(next.type);
    timerRef.current = setTimeout(() => {
      setActiveNotification(null);
      processingQueue.current = false;
      // Process next after a short delay
      setTimeout(processQueue, 500);
    }, displayTime);
  };

  // Handle notification dismissal
  const handleDismiss = useCallback(() => {
    if (activeNotification) {
      // Clear the current timeout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Track dismissed notifications
      if (activeNotification.id) {
        removeNotification(activeNotification.id);
      }
      
      // Reset states
      setActiveNotification(null);
      processingQueue.current = false;
      
      // Process next after a short delay
      setTimeout(processQueue, 500);
    }
  }, [activeNotification, removeNotification]);

  // Watch for new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const newNotifications = notifications.filter(notification => {
        // Skip if already in queue
        const inQueue = notificationQueue.current.some(n => n.id === notification.id);
        if (inQueue) return false;
        
        // Skip if already active
        if (activeNotification && activeNotification.id === notification.id) return false;
        
        // Add to queue
        return true;
      });
      
      if (newNotifications.length > 0) {
        // Process notifications with improved validation
        const validatedNotifications = newNotifications.map(notification => {
          // Deep copy to avoid mutations
          const fixedNotification = {...notification};
          
          // Debug log every notification
          console.log('[NOTIFICATION_DEBUG] Processing notification:', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            reason: notification.reason,
            pointsChange: notification.pointsChange,
            house: notification.house,
            isHousePointsUpdate: notification.isHousePointsUpdate
          });
          
          // Ensure house points notifications have correct data
          if (notification.message && notification.message.includes('points') && 
              notification.house && notification.pointsChange) {
            console.log('[NOTIFICATION_DEBUG] Processing house points notification:', fixedNotification);
            
            // Make sure the reason is displayed correctly - improved extraction
            if (fixedNotification.reason === 'System update' || !fixedNotification.reason) {
              // Try to extract reason from message if it contains a colon
              if (notification.message && notification.message.includes(':')) {
                const parts = notification.message.split(':');
                if (parts.length > 1) {
                  fixedNotification.reason = parts[1].trim();
                  console.log('[NOTIFICATION_DEBUG] Extracted reason from message:', fixedNotification.reason);
                }
              }
              
              // If still no reason, check if this is a house points notification
              if ((!fixedNotification.reason || fixedNotification.reason === 'System update') && 
                  notification.isHousePointsUpdate && notification.house) {
                // For house notifications without reason, use a better default
                fixedNotification.reason = notification.house + ' house points update';
                console.log('[NOTIFICATION_DEBUG] Using house default reason:', fixedNotification.reason);
              }
            }
            
            console.log('[NOTIFICATION_DEBUG] Final notification reason:', fixedNotification.reason);
          }
              
          return fixedNotification;
        });
        
        // Add to queue
        notificationQueue.current = [...notificationQueue.current, ...validatedNotifications];
        
        // Start processing if not already
        if (!processingQueue.current && !activeNotification) {
          processQueue();
        }
      }
    }
  }, [notifications, activeNotification, removeNotification]);

  // Render nothing if no active notification
  if (!activeNotification) {
    return null;
  }

  // Extract criteria and level if available
  const { criteria, level } = extractCriteriaAndLevel(activeNotification);

  // Determine if this is a point change notification
  const isPointChange = activeNotification.pointsChange !== undefined;
  const pointsValue = isPointChange ? Math.abs(activeNotification.pointsChange) : 0;
  const isPointIncrease = isPointChange && activeNotification.pointsChange > 0;
  const pointsImage = isPointIncrease ? increasePointImg : decreasePointImg;
  
  // Determine if this is a house points notification
  const isHousePoints = Boolean(activeNotification.isHousePointsUpdate);

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex="toast"
      width="330px"
      className={`notification-container ${isPointChange ? 'point-animation' : ''}`}
    >
      <Box
        bg="white"
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        boxShadow="lg"
        p={4}
        className="notification-content"
      >
        <Flex justifyContent="space-between" alignItems="center" mb={2}>
          <Heading size="sm">{activeNotification.title || getNotificationTitle(activeNotification.type)}</Heading>
          <CloseButton size="sm" onClick={handleDismiss} />
        </Flex>
        
        <Text fontSize="sm" mb={2}>{activeNotification.message}</Text>
        
        {/* Render house-specific info */}
        {activeNotification.house && (
          <Flex align="center" mb={2}>
            <Badge colorScheme={activeNotification.house === 'gryffindor' ? 'red' : 
              activeNotification.house === 'slytherin' ? 'green' :
              activeNotification.house === 'ravenclaw' ? 'blue' : 'yellow'} mr={2}>
              {activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)}
            </Badge>
            {isHousePoints && (
              <Text fontSize="sm" fontWeight="bold">
                {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`} points
              </Text>
            )}
          </Flex>
        )}
        
        {/* Reason, if available - improved display with better detection */}
        {activeNotification.reason && 
         activeNotification.reason !== 'System update' && 
         activeNotification.reason.trim() !== '' && (
          <Text fontSize="xs" fontWeight="medium" color="gray.700" mb={2}>
            Reason: {activeNotification.reason}
          </Text>
        )}
        
        {/* Point change animation */}
        {isPointChange && (
          <Box className="points-animation" position="absolute" right="-20px" top="-30px">
            <Image src={pointsImage} alt={isPointIncrease ? "Points increased" : "Points decreased"} width="80px" />
            <Text 
              position="absolute" 
              top="30px" 
              right="25px" 
              fontWeight="bold" 
              color={isPointIncrease ? "#4CAF50" : "#F44336"}
              fontSize="20px"
            >
              {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`}
            </Text>
          </Box>
        )}
        
        {/* Criteria and level, if available */}
        {criteria && (
          <Flex mt={2}>
            <Badge colorScheme="purple" mr={2}>{criteria}</Badge>
            {level && <Badge colorScheme="teal">{level}</Badge>}
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default memo(NotificationDisplay);