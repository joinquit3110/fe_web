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
  Stack,
  Icon
} from '@chakra-ui/react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { FaBolt, FaSkull } from 'react-icons/fa';
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

  // Define dismissHandler function reference first to avoid circular dependency
  const dismissHandler = () => {
    if (activeNotification?.id) {
      removeNotification(activeNotification.id);
    }
    setActiveNotification(null);
    processingQueue.current = false;
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
          
          // We'll let the useEffect handle processing the next notification
          // This avoids calling processQueue directly, breaking the circular dependency
        }, 300); // Animation duration
      } else {
        // Fallback if element not found
        if (activeNotification.id) {
          removeNotification(activeNotification.id);
        }
        
        setActiveNotification(null);
        processingQueue.current = false;
      }
    }
  }, [activeNotification, removeNotification]);

  // Separate function from handleDismiss to break circular reference
  const processQueue = useCallback(() => {
    if (processingQueue.current || notificationQueue.current.length === 0) {
      return;
    }
    
    processingQueue.current = true;
    const next = notificationQueue.current.shift();
    
    // Enhanced safety checks for malformed notifications
    if (!next || typeof next !== 'object') {
      console.error('[NOTIFICATION] Encountered invalid notification in queue:', next);
      processingQueue.current = false;
      return;
    }
    
    // Validate required fields
    if (!next.id) {
      console.error('[NOTIFICATION] Notification missing ID:', next);
      processingQueue.current = false;
      return;
    }
    
    // Ensure we have a message
    if (!next.message) {
      console.log('[NOTIFICATION] Adding default message for notification:', next.id);
      next.message = next.title || 'Notification';
    }
    
    setActiveNotification(next);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Determine how long to display this notification
    // First use the explicit duration if provided
    // Otherwise, use the type-based duration
    // For house-related notifications, give a bit more time
    let displayTime = next.duration;
    if (!displayTime) {
      displayTime = getDurationByType(next.type || 'info');
      // House notifications get a bit more time
      if (next.isHousePointsUpdate || next.isHouseAssessmentUpdate) {
        displayTime = Math.max(displayTime, 10000); // Minimum 10s for house notifications
      }
    }
    
    console.log(`[NOTIFICATION] Will auto-dismiss in ${displayTime}ms:`, next.id);
    
    timerRef.current = setTimeout(() => {
      // Add dismissing class for animation
      const notificationElement = document.querySelector('.notification-container');
      if (notificationElement) {
        notificationElement.classList.add('dismissing');
        
        // Wait for animation to complete before removing
        setTimeout(() => {
          if (next.id) {
            removeNotification(next.id);
          }
          
          setActiveNotification(null);
          processingQueue.current = false;
          
          // Process the next notification after a brief delay
          if (notificationQueue.current.length > 0) {
            setTimeout(() => {
              processQueue();
            }, 300);
          }
        }, 300); // Animation duration
      } else {
        // Direct removal if element not found
        if (next.id) {
          removeNotification(next.id);
        }
        
        setActiveNotification(null);
        processingQueue.current = false;
        
        if (notificationQueue.current.length > 0) {
          setTimeout(() => processQueue(), 300);
        }
      }
    }, displayTime);
  }, [timerRef, removeNotification, setActiveNotification, notificationQueue, getDurationByType]);

  useEffect(() => {
    // When activeNotification is null and queue has items, process the next notification
    if (!activeNotification && notificationQueue.current.length > 0 && !processingQueue.current) {
      processQueue();
    }
  }, [activeNotification, processQueue]);

  useEffect(() => {
    if (notifications.length > 0) {
      const newNotifications = notifications.filter(notification => {
        // Safety check for malformed notifications
        if (!notification || typeof notification !== 'object') {
          console.error('[NOTIFICATION] Received invalid notification:', notification);
          return false;
        }
        
        // Skip if notification has no ID
        if (!notification.id) {
          console.log('[NOTIFICATION] Skipping notification without ID');
          return false;
        }
        
        // Skip if this notification ID has been processed before
        if (processedIds.current.has(notification.id)) {
          console.log('[NOTIFICATION] Skipping already processed notification:', notification.id);
          return false;
        }
        
        // Skip if this is already in the queue
        const inQueue = notificationQueue.current.some(n => n.id === notification.id);
        if (inQueue) {
          console.log('[NOTIFICATION] Skipping notification already in queue:', notification.id);
          return false;
        }
        
        // Skip if this is the active notification
        if (activeNotification && activeNotification.id === notification.id) {
          console.log('[NOTIFICATION] Skipping active notification:', notification.id);
          return false;
        }
        
        // This is a new notification - track it
        processedIds.current.add(notification.id);
        console.log('[NOTIFICATION] Adding new notification to queue:', notification.id);
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
            
            // Enhanced reason extraction for all notification types
            if (fixedNotification.reason === 'System update' || !fixedNotification.reason) {
              // First check if the message contains an explicit reason after a colon
              if (notification.message && notification.message.includes(':')) {
                const parts = notification.message.split(':');
                if (parts.length > 1) {
                  fixedNotification.reason = parts[1].trim();
                  console.log('[NOTIFICATION_DEBUG] 1️⃣ Extracted reason from message:', fixedNotification.reason);
                }
              }
              
              // Special handling for house points updates - ensure the reason is always included
              if (notification.isHousePointsUpdate && notification.house) {
                if (notification.message && notification.message.includes('points') && notification.message.includes(':')) {
                  // Extract reason from message format "X points to House: Reason"
                  const reasonPart = notification.message.split(':')[1];
                  if (reasonPart && reasonPart.trim()) {
                    fixedNotification.reason = reasonPart.trim();
                    console.log('[NOTIFICATION_DEBUG] 2️⃣ Extracted house reason:', fixedNotification.reason);
                  } 
                  else if (notification.reason && notification.reason !== 'System update') {
                    // Use the provided reason if available
                    fixedNotification.reason = notification.reason;
                    console.log('[NOTIFICATION_DEBUG] 2️⃣ Using provided house reason:', fixedNotification.reason);
                  }
                }
                // If still no reason found, use default
                if (!fixedNotification.reason || fixedNotification.reason === 'System update') {
                  const houseName = notification.house.charAt(0).toUpperCase() + notification.house.slice(1);
                  fixedNotification.reason = `${houseName} house points update`;
                  console.log('[NOTIFICATION_DEBUG] 2️⃣ Using house default reason:', fixedNotification.reason);
                }
              } 
              
              // For personal points updates
              else if (notification.isPersonalPointsUpdate) {
                fixedNotification.reason = 'Personal points update';
                console.log('[NOTIFICATION_DEBUG] 3️⃣ Using personal default reason:', fixedNotification.reason);
              }
              
              // Generic fallback for any remaining notification
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

  // Extract criteria and level with more comprehensive error handling
  let criteria = null;
  let level = null;
  
  try {
    // Safety check the notification object before extraction
    if (activeNotification && typeof activeNotification === 'object') {
      const extracted = extractCriteriaAndLevel(activeNotification);
      criteria = extracted?.criteria || null;
      level = extracted?.level || null;
      
      console.log('[NOTIFICATION] Extracted criteria/level:', { criteria, level });
    } else {
      console.warn('[NOTIFICATION] Cannot extract criteria/level from invalid notification');
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error extracting criteria/level:', error);
    // Continue with null values for criteria and level
  }

  const isPointChange = activeNotification.pointsChange !== undefined;
  const pointsValue = isPointChange ? Math.abs(activeNotification.pointsChange) : 0;
  const isPointIncrease = isPointChange && activeNotification.pointsChange > 0;
  const pointsImage = isPointIncrease ? increasePointImg : decreasePointImg;
  
  const isHousePoints = Boolean(activeNotification.isHousePointsUpdate);
  const isHouseAssessment = Boolean(activeNotification.isHouseAssessmentUpdate);
  
  // Get theme colors based on notification house or type
  // Using direct function call instead of useMemo to avoid "cannot access before initialization" errors
  const houseColors = getHouseColors(activeNotification.house);

  // Determine house class if present
  const houseClass = activeNotification.house ? `house-${activeNotification.house.toLowerCase()}` : '';

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex="toast"
      width={{ base: "90vw", sm: "400px", md: "450px" }}  // increased size for better image visibility
      maxWidth="95vw"
      className={`notification-container ${activeNotification.type || 'default'} ${houseClass}`}
    >
      <Box
        borderWidth="3px"
        borderRadius="lg"
        overflow="hidden"
        borderColor={isPointChange ? 
          `rgba(${isPointIncrease ? '255, 215, 0, 0.9' : '255, 100, 100, 0.9'})` : 
          houseColors.borderColor}
        p={isPointChange ? 5 : 4}
        className={`magical-notification ${isPointChange ? 'points-background' : ''}`}
        style={{
          background: isPointChange 
            ? `url(${pointsImage}) no-repeat center center` 
            : houseColors.bgColor,
          backgroundSize: isPointChange ? 'cover' : 'auto',
          position: 'relative',
        }}
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
          <Heading 
            size="sm" 
            color={houseColors.textColor} 
            className="notification-title"
            letterSpacing={activeNotification.house ? "0.04em" : "normal"}
            fontFamily="'Cinzel', serif"
            style={{
              textTransform: activeNotification.house ? "capitalize" : "normal"
            }}
          >
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
              className={`house-badge house-badge-${activeNotification.house.toLowerCase()}`}
              style={{
                boxShadow: activeNotification.house === 'gryffindor' ? '0 0 8px rgba(218, 165, 32, 0.5)' : 
                  activeNotification.house === 'slytherin' ? '0 0 8px rgba(192, 192, 192, 0.5)' :
                  activeNotification.house === 'ravenclaw' ? '0 0 8px rgba(176, 196, 222, 0.5)' : 
                  '0 0 8px rgba(0, 0, 0, 0.5)'
              }}
            >
              {activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)}
            </Badge>
            {(isHousePoints || isHouseAssessment) && (
              <Flex 
                alignItems="center" 
                className={isPointChange ? "points-value-display" : ""}
              >
                {isPointChange && (                <Icon 
                  as={isPointIncrease ? FaBolt : FaSkull} 
                  color={isPointIncrease ? "#4ADE80" : "#F56565"} 
                  mr="1"
                  boxSize="16px"
                  className={isPointIncrease ? "increase-icon" : "decrease-icon"}
                />
                )}
                <Text
                  fontSize={isPointChange ? "md" : "sm"} 
                  fontWeight="bold" 
                  color={isPointChange ? (isPointIncrease ? "#4ADE80" : "#F56565") : houseColors.accentColor}
                  textShadow={isPointChange ? "0 0 10px rgba(0, 0, 0, 0.9)" : "none"}
                >
                  {isPointChange ? (isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`) : ''} 
                  {isPointChange ? 'points' : ''}
                </Text>
              </Flex>
            )}
          </Flex>
        )}
        
        {/* Show reason with more robust handling */}
        {(() => {
          // Extract reason using multiple approaches for reliability
          let displayReason = null;
          
          // Debug the reason that is coming in
          console.log('[NOTIFICATION_REASON_DEBUG]', {
            fromNotif: activeNotification.reason,
            message: activeNotification.message,
            isHousePoints: isHousePoints,
            isPersonalPoints: Boolean(activeNotification.isPersonalPointsUpdate)
          });
          
          // First priority: Use valid reason from notification object
          if (activeNotification.reason && 
              activeNotification.reason !== 'System update' && 
              activeNotification.reason.trim() !== '') {
            displayReason = activeNotification.reason;
          } 
          // Second priority: Extract from message after colon for points notifications
          else if (activeNotification.message && activeNotification.message.includes(':')) {
            const parts = activeNotification.message.split(':');
            if (parts.length > 1 && parts[1].trim() !== '') {
              displayReason = parts[1].trim();
            }
          }
          // Third priority: Generate house-specific fallback
          else if (isHousePoints && activeNotification.house) {
            displayReason = `${activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)} house points update`;
          }
          // Fourth priority: For personal points updates
          else if (activeNotification.isPersonalPointsUpdate) {
            displayReason = "Personal achievement";
          }
          // Last resort fallback
          else if (!displayReason) {
            displayReason = isPointIncrease ? "Achievement reward" : "Point adjustment";
          }

          console.log('[NOTIFICATION_REASON_FINAL]', displayReason);
          
          return (
            <Text 
              fontSize="sm" // Increased size for better visibility
              fontWeight="bold" 
              color={isPointChange ? "white" : houseColors.accentColor}
              mb={2} 
              className={`notification-reason ${activeNotification.house ? `house-reason-${activeNotification.house.toLowerCase()}` : ''}`}
              style={{
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.9)",
                letterSpacing: "0.02em",
                zIndex: 3,
                position: "relative"
              }}
            >
              Reason: {displayReason}
            </Text>
          );
        })()}
        
        {isPointChange && (
          <>
            {/* Keep the original icon container for non-background version */}
            <Box className="points-animation notification-icon-container" position="absolute" right="-20px" top="-30px">
              <Image src={pointsImage} alt={isPointIncrease ? "Points increased" : "Points decreased"} width="80px" className="notification-icon" />
              <Flex 
                position="absolute" 
                top="30px" 
                right="25px" 
                alignItems="center"
              >
                <Icon 
                  as={isPointIncrease ? FaBolt : FaSkull} 
                  color={isPointIncrease ? "#4ADE80" : "#F56565"} 
                  mr="1"
                  boxSize="14px"
                  className={isPointIncrease ? "increase-icon" : "decrease-icon"}
                />
                <Text 
                  fontWeight="bold" 
                  color={isPointIncrease ? "#4ADE80" : "#F56565"}
                  fontSize="20px"
                  textShadow="0 0 5px rgba(0,0,0,0.5)"
                >
                  {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`}
                </Text>
              </Flex>
            </Box>
            
            {/* Add a large points display for the background version */}
            <Flex 
              className="points-value-display"
              fontWeight="bold" 
              fontSize="48px"
              position="absolute"
              top="50%"
              right="20px"
              transform="translateY(-50%)"
              alignItems="center"
              style={{
                animation: activeNotification.house ? 
                  `${activeNotification.house.toLowerCase()}-points-pulse 2s infinite` : 
                  'points-pulse 2s infinite',
                zIndex: 5
              }}
            >
              <Icon 
                as={isPointIncrease ? FaBolt : FaSkull} 
                color={isPointIncrease ? "#4ADE80" : "#F56565"} 
                mr="2"
                boxSize="40px"
                className={isPointIncrease ? "increase-icon" : "decrease-icon"}
              />
              <Text
                textShadow="0 0 12px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)"
                color={isPointIncrease ? "#4ADE80" : "#F56565"}
              >
                {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`}
              </Text>
            </Flex>
          </>
        )}
        
        {criteria && (
          <Flex mt={2}>
            <Badge 
              bg={activeNotification.house === 'gryffindor' ? 'rgba(157, 23, 23, 0.85)' :
                 activeNotification.house === 'slytherin' ? 'rgba(8, 98, 45, 0.85)' :
                 activeNotification.house === 'ravenclaw' ? 'rgba(14, 38, 109, 0.85)' :
                 activeNotification.house === 'hufflepuff' ? 'rgba(128, 109, 16, 0.85)' :
                 'rgba(128, 90, 213, 0.8)'} 
              color="white" 
              mr={2}
              p={1}
              boxShadow={activeNotification.house === 'gryffindor' ? '0 0 5px rgba(218, 165, 32, 0.5)' :
                 activeNotification.house === 'slytherin' ? '0 0 5px rgba(192, 192, 192, 0.5)' :
                 activeNotification.house === 'ravenclaw' ? '0 0 5px rgba(176, 196, 222, 0.5)' :
                 activeNotification.house === 'hufflepuff' ? '0 0 5px rgba(255, 217, 102, 0.5)' :
                 '0 0 5px rgba(128, 90, 213, 0.5)'}
              className={`criteria-badge ${activeNotification.house ? `house-badge-${activeNotification.house.toLowerCase()}` : ''}`}
            >
              {criteria}
            </Badge>
            {level && (
              <Badge 
                bg={activeNotification.house === 'gryffindor' ? 'rgba(157, 23, 23, 0.7)' :
                   activeNotification.house === 'slytherin' ? 'rgba(8, 98, 45, 0.7)' :
                   activeNotification.house === 'ravenclaw' ? 'rgba(14, 38, 109, 0.7)' :
                   activeNotification.house === 'hufflepuff' ? 'rgba(128, 109, 16, 0.7)' :
                   'rgba(49, 151, 149, 0.8)'}
                color="white"
                p={1}
                boxShadow={activeNotification.house === 'gryffindor' ? '0 0 5px rgba(218, 165, 32, 0.4)' :
                   activeNotification.house === 'slytherin' ? '0 0 5px rgba(192, 192, 192, 0.4)' :
                   activeNotification.house === 'ravenclaw' ? '0 0 5px rgba(176, 196, 222, 0.4)' :
                   activeNotification.house === 'hufflepuff' ? '0 0 5px rgba(255, 217, 102, 0.4)' :
                   '0 0 5px rgba(49, 151, 149, 0.5)'}
                className={`level-badge ${activeNotification.house ? `house-badge-${activeNotification.house.toLowerCase()}` : ''}`}
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