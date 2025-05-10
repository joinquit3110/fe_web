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
import '../styles/HarryPotter.css';

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
  // Track processed notification IDs to prevent duplicates
  const processedIds = useRef(new Set());

  // Helper function to get house-specific colors
  const getHouseColors = (house) => {
    switch(house?.toLowerCase()) {
      case 'gryffindor':
        return {
          bgColor: 'linear-gradient(to bottom, rgba(122, 10, 10, 0.92), rgba(80, 5, 5, 0.95))',
          borderColor: 'rgba(218, 165, 32, 0.7)',
          textColor: '#F8F8F8',
          accentColor: '#DAA520',  // Gold
        };
      case 'slytherin':
        return {
          bgColor: 'linear-gradient(to bottom, rgba(5, 77, 35, 0.92), rgba(3, 50, 23, 0.95))',
          borderColor: 'rgba(192, 192, 192, 0.7)',
          textColor: '#F8F8F8',
          accentColor: '#C0C0C0',  // Silver
        };
      case 'ravenclaw':
        return {
          bgColor: 'linear-gradient(to bottom, rgba(10, 30, 90, 0.92), rgba(5, 15, 50, 0.95))',
          borderColor: 'rgba(176, 196, 222, 0.7)',
          textColor: '#F8F8F8',
          accentColor: '#B0C4DE',  // Bronze
        };
      case 'hufflepuff':
        return {
          bgColor: 'linear-gradient(to bottom, rgba(100, 85, 10, 0.92), rgba(70, 60, 5, 0.95))',
          borderColor: 'rgba(50, 50, 50, 0.7)',
          textColor: '#F8F8F8',
          accentColor: '#333333',  // Black
        };
      default:
        return {
          bgColor: 'linear-gradient(to bottom, rgba(40, 40, 90, 0.92), rgba(30, 30, 70, 0.95))',
          borderColor: 'rgba(211, 166, 37, 0.7)',
          textColor: '#F8F8F8',
          accentColor: '#D3A625',  // Default gold accent
        };
    }
  };

  const getNotificationTitle = (type) => {
    switch (type) {
      case 'success': return 'Success!';
      case 'warning': return 'Warning!';
      case 'error': return 'Error!';
      case 'announcement': return 'Announcement';
      case 'info': return 'Update';
      default: return 'Notification';
    }
  };

  const getDurationByType = (type) => {
    switch (type) {
      case 'error': return 12000;
      case 'warning': return 10000;
      case 'success': return 8000;
      case 'announcement': return 15000;
      default: return 7000;
    }
  };

  const handleDismiss = useCallback(() => {
    if (activeNotification) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // Add dismissing class for animation
      const notificationElement = document.querySelector('.notification-container');
      if (notificationElement) {
        notificationElement.classList.add('dismissing');
        
        // Wait for animation to complete before removing
        setTimeout(() => {
          if (activeNotification.id) {
            removeNotification(activeNotification.id);
          }
          
          setActiveNotification(null);
          processingQueue.current = false;
          
          if (notificationQueue.current.length > 0) {
            setTimeout(() => processQueue(), 300);
          }
        }, 300); // Animation duration
      } else {
        // Fallback if element not found
        if (activeNotification.id) {
          removeNotification(activeNotification.id);
        }
        
        setActiveNotification(null);
        processingQueue.current = false;
        
        if (notificationQueue.current.length > 0) {
          setTimeout(() => processQueue(), 300);
        }
      }
    }
  }, [activeNotification, removeNotification, setActiveNotification, notificationQueue, timerRef, processQueue]);

  const processQueue = useCallback(() => {
    if (processingQueue.current || notificationQueue.current.length === 0) {
      return;
    }
    
    processingQueue.current = true;
    const next = notificationQueue.current.shift();
    setActiveNotification(next);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Determine how long to display this notification
    // First use the explicit duration if provided
    // Otherwise, use the type-based duration
    // For house-related notifications, give a bit more time
    let displayTime = next.duration;
    if (!displayTime) {
      displayTime = getDurationByType(next.type);
      // House notifications get a bit more time
      if (next.isHousePointsUpdate || next.isHouseAssessmentUpdate) {
        displayTime = Math.max(displayTime, 10000); // Minimum 10s for house notifications
      }
    }
    
    console.log(`[NOTIFICATION] Will auto-dismiss in ${displayTime}ms:`, next.id);
    
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, displayTime);
  }, [timerRef, processingQueue, setActiveNotification, notificationQueue, handleDismiss, getDurationByType]);

  useEffect(() => {
    if (notifications.length > 0) {
      const newNotifications = notifications.filter(notification => {
        // Skip if notification has no ID
        if (!notification.id) return false;
        
        // Skip if this notification ID has been processed before
        if (processedIds.current.has(notification.id)) return false;
        
        // Skip if this is already in the queue
        const inQueue = notificationQueue.current.some(n => n.id === notification.id);
        if (inQueue) return false;
        
        // Skip if this is the active notification
        if (activeNotification && activeNotification.id === notification.id) return false;
        
        // This is a new notification - track it
        processedIds.current.add(notification.id);
        return true;
      });
      
      if (newNotifications.length > 0) {
        // Limit how many notifications we process at once to prevent spamming
        const toProcess = newNotifications.slice(0, 3);
        
        const validatedNotifications = toProcess.map(notification => {
          const fixedNotification = {...notification};
          
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
          
          let notificationType = "standard";
          if (notification.isHousePointsUpdate) notificationType = "house points";
          if (notification.isPersonalPointsUpdate) notificationType = "personal points";
          console.log(`[NOTIFICATION_DEBUG] Processing ${notificationType} notification:`, fixedNotification);
          
          if (notification.pointsChange !== undefined) {
            console.log('[NOTIFICATION_DEBUG] Full notification details:', {
              id: notification.id,
              type: notification.type,
              message: notification.message, 
              reason: notification.reason,
              house: notification.house,
              isHousePoints: notification.isHousePointsUpdate,
              isPersonal: notification.isPersonalPointsUpdate
            });
            
            if (fixedNotification.reason === 'System update' || !fixedNotification.reason) {
              if (notification.message && notification.message.includes(':')) {
                const parts = notification.message.split(':');
                if (parts.length > 1) {
                  fixedNotification.reason = parts[1].trim();
                  console.log('[NOTIFICATION_DEBUG] 1️⃣ Extracted reason from message:', fixedNotification.reason);
                }
              }
              
              if ((!fixedNotification.reason || fixedNotification.reason === 'System update') && 
                  notification.isHousePointsUpdate && notification.house) {
                const houseName = notification.house.charAt(0).toUpperCase() + notification.house.slice(1);
                fixedNotification.reason = `${houseName} house points update`;
                console.log('[NOTIFICATION_DEBUG] 2️⃣ Using house default reason:', fixedNotification.reason);
              } 
              
              else if ((!fixedNotification.reason || fixedNotification.reason === 'System update') && 
                  notification.isPersonalPointsUpdate) {
                fixedNotification.reason = 'Personal points update';
                console.log('[NOTIFICATION_DEBUG] 3️⃣ Using personal default reason:', fixedNotification.reason);
              }
              
              else if (!fixedNotification.reason || fixedNotification.reason === 'System update') {
                fixedNotification.reason = notification.pointsChange > 0 ? 'Achievement reward' : 'Point adjustment';
                console.log('[NOTIFICATION_DEBUG] 4️⃣ Using generic fallback reason');
              }
            }
            
            console.log('[NOTIFICATION_DEBUG] Final notification reason:', fixedNotification.reason);
          }
              
          return fixedNotification;
        });
        
        notificationQueue.current = [...notificationQueue.current, ...validatedNotifications];
        
        if (!processingQueue.current && !activeNotification) {
          processQueue();
        }
      }
    }
  }, [notifications, activeNotification, removeNotification]);

  if (!activeNotification) {
    return null;
  }

  const { criteria, level } = extractCriteriaAndLevel(activeNotification);

  const isPointChange = activeNotification.pointsChange !== undefined;
  const pointsValue = isPointChange ? Math.abs(activeNotification.pointsChange) : 0;
  const isPointIncrease = isPointChange && activeNotification.pointsChange > 0;
  const pointsImage = isPointIncrease ? increasePointImg : decreasePointImg;
  
  const isHousePoints = Boolean(activeNotification.isHousePointsUpdate);
  const isHouseAssessment = Boolean(activeNotification.isHouseAssessmentUpdate);
  
  // Get theme colors based on notification house or type
  const houseColors = getHouseColors(activeNotification.house);

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex="toast"
      width={{ base: "85vw", sm: "330px", md: "360px" }}  // responsive width
      maxWidth="95vw"
      className={`notification-container ${activeNotification.type || 'default'}`}
    >
      <Box
        bg={houseColors.bgColor}
        borderWidth="2px"
        borderRadius="lg"
        overflow="hidden"
        borderColor={houseColors.borderColor}
        p={4}
        className="magical-notification"
      >
        {/* Add magical glow bar */}
        <div className="notification-glow-bar" style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '4px',
          height: '100%',
          background: houseColors.accentColor,
          boxShadow: `0 0 10px ${houseColors.accentColor}`
        }}></div>
        
        {/* Add magical sparkles */}
        <div className="magical-sparkle sparkle-1"></div>
        <div className="magical-sparkle sparkle-2"></div>
        <div className="magical-sparkle sparkle-3"></div>
        
        <Flex justifyContent="space-between" alignItems="center" mb={2}>
          <Heading size="sm" color={houseColors.textColor} className="notification-title">
            {activeNotification.title || getNotificationTitle(activeNotification.type)}
          </Heading>
          <CloseButton size="sm" color={houseColors.textColor} onClick={handleDismiss} />
        </Flex>
        
        <Text fontSize="sm" mb={2} color={houseColors.textColor}>{activeNotification.message}</Text>
        
        {activeNotification.house && (
          <Flex align="center" mb={2} className="notification-house-info">
            <Badge 
              bg={activeNotification.house === 'gryffindor' ? '#740001' : 
                activeNotification.house === 'slytherin' ? '#1A472A' :
                activeNotification.house === 'ravenclaw' ? '#0E1A40' : '#FFB81C'} 
              color={activeNotification.house === 'hufflepuff' ? '#000000' : '#FFFFFF'}
              mr={2}
              p={1}
              borderRadius="md"
              className="house-badge"
            >
              {activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)}
            </Badge>
            {(isHousePoints || isHouseAssessment) && (
              <Text fontSize="sm" fontWeight="bold" color={houseColors.accentColor}>
                {isPointChange ? (isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`) : ''} 
                {isPointChange ? 'points' : ''}
              </Text>
            )}
          </Flex>
        )}
        
        {activeNotification.reason && 
         activeNotification.reason !== 'System update' && 
         activeNotification.reason.trim() !== '' && (
          <Text fontSize="xs" fontWeight="medium" color={houseColors.accentColor} mb={2} className="notification-reason">
            Reason: {activeNotification.reason}
          </Text>
        )}
        
        {isPointChange && (
          <Box className="points-animation notification-icon-container" position="absolute" right="-20px" top="-30px">
            <Image src={pointsImage} alt={isPointIncrease ? "Points increased" : "Points decreased"} width="80px" className="notification-icon" />
            <Text 
              position="absolute" 
              top="30px" 
              right="25px" 
              fontWeight="bold" 
              color={isPointIncrease ? "#FFDF00" : "#FF6B6B"}
              fontSize="20px"
              textShadow="0 0 5px rgba(0,0,0,0.5)"
            >
              {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`}
            </Text>
          </Box>
        )}
        
        {criteria && (
          <Flex mt={2}>
            <Badge 
              bg="rgba(128, 90, 213, 0.8)" 
              color="white" 
              mr={2}
              p={1}
              boxShadow="0 0 5px rgba(128, 90, 213, 0.5)"
            >
              {criteria}
            </Badge>
            {level && (
              <Badge 
                bg="rgba(49, 151, 149, 0.8)" 
                color="white"
                p={1}
                boxShadow="0 0 5px rgba(49, 151, 149, 0.5)"
              >
                {level}
              </Badge>
            )}
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default memo(NotificationDisplay);