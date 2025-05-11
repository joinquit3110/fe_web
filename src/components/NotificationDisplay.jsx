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
import '../styles/notification_animations.css';
import '../styles/notification_override.css'; // Import the override styles
import '../styles/icon_animations.css'; // Import icon animations
import '../styles/notification_animations_enhanced.css'; // Import enhanced animations

// Import images for point change animations
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

// Don't preload images here - this causes issues with SSR or bundling
// We'll let React handle the image loading when it's actually used in the component

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
    };
    
    // Validate required fields
    if (!next.id) {
      console.error('[NOTIFICATION] Notification missing ID:', next);
      processingQueue.current = false;
      return;
    }
    
    // Ensure we have a message
    if (!next.message) {
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
    };
    
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
          return false;
        }
        
        // Skip if this notification ID has been processed before
        if (processedIds.current.has(notification.id)) {
          return false;
        }
        
        // Skip if this is already in the queue
        const inQueue = notificationQueue.current.some(n => n.id === notification.id);
        if (inQueue) {
          return false;
        }
        
        // Skip if this is the active notification
        if (activeNotification && activeNotification.id === notification.id) {
          return false;
        }
        
        // This is a new notification - track it
        processedIds.current.add(notification.id);
        return true;
      });
      
      if (newNotifications.length > 0) {
        // Limit how many notifications we process at once to prevent spamming
        const toProcess = newNotifications.slice(0, 3);
        
        const validatedNotifications = toProcess.map(notification => {
          const fixedNotification = {...notification};
          
          let notificationType = "standard";
          if (notification.isHousePointsUpdate) notificationType = "house points";
          if (notification.isPersonalPointsUpdate) notificationType = "personal points";
          
          if (notification.pointsChange !== undefined) {
            
            // Enhanced reason extraction for all notification types
            if (fixedNotification.reason === 'System update' || !fixedNotification.reason) {
              // First check if the message contains an explicit reason after a colon
              if (notification.message && notification.message.includes(':')) {
                const parts = notification.message.split(':');
                if (parts.length > 1) {
                  fixedNotification.reason = parts[1].trim();
                }
              }
              
              // Special handling for house points updates - ensure the reason is always included
              if (notification.isHousePointsUpdate && notification.house) {
                if (notification.message && notification.message.includes('points') && notification.message.includes(':')) {
                  // Extract reason from message format "X points to House: Reason"
                  const reasonPart = notification.message.split(':')[1];
                  if (reasonPart && reasonPart.trim()) {
                    fixedNotification.reason = reasonPart.trim();
                  } 
                  else if (notification.reason && notification.reason !== 'System update') {
                    // Use the provided reason if available
                    fixedNotification.reason = notification.reason;
                  }
                }
                // If still no reason found, use default
                if (!fixedNotification.reason || fixedNotification.reason === 'System update') {
                  const houseName = notification.house.charAt(0).toUpperCase() + notification.house.slice(1);
                  fixedNotification.reason = `${houseName} house points update`;
                }
              } 
              
              // For personal points updates
              else if (notification.isPersonalPointsUpdate) {
                fixedNotification.reason = 'Point change';
              }
              
              // Generic fallback for any remaining notification
              else if (!fixedNotification.reason || fixedNotification.reason === 'System update') {
                fixedNotification.reason = notification.pointsChange > 0 ? 'Achievement reward' : 'Point adjustment';
              }
            }
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
    } else {
      // Continue with null values for criteria and level
    }
  } catch (error) {
    // Continue with null values for criteria and level
  }

  const isPointChange = activeNotification.pointsChange !== undefined;
  // Make sure we're using the points delta (change), not the total points
  const pointsValue = isPointChange ? Math.abs(activeNotification.pointsChange) : 0;
  const isPointIncrease = isPointChange && activeNotification.pointsChange > 0;
  const pointsImage = isPointIncrease ? increasePointImg : decreasePointImg;
  
  // Debug log to verify we're using the correct value
  if (isPointChange) {
    console.log('[NOTIFICATION] Displaying points change:', {
      pointsChange: activeNotification.pointsChange,
      displayValue: pointsValue,
      isIncrease: isPointIncrease
    });
  }
  
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
      zIndex="toast" /* Using toast z-index to ensure visibility */
      width={{ base: "94vw", sm: "500px", md: "550px" }}  /* Increased width for larger image */
      maxWidth="96vw"
      className={`notification-container ${activeNotification.type || 'default'} ${houseClass}`}
      style={{ pointerEvents: "all" }} /* Ensure clickable */
    >    <Box
      borderWidth="5px" /* Increased border width for better visibility */
      borderRadius="lg" 
      overflow="hidden"
      borderColor={isPointChange ? 
        `rgba(${isPointIncrease ? '255, 215, 0, 0.9' : '255, 100, 100, 0.9'})` : 
        houseColors.borderColor}
      p={isPointChange ? 0 : 4} /* Removed padding for point change to maximize image size */
      className={`magical-notification ${isPointChange ? 'points-background' : ''}`}
      style={{
        background: isPointChange 
          ? `url(${pointsImage}) no-repeat center center` /* Changed to center center for balanced positioning */
          : houseColors.bgColor,
        backgroundSize: isPointChange ? 'cover' : 'cover', /* Use cover for full image */
        backgroundPosition: isPointChange ? 'center center' : 'center center',
        position: 'relative',
        zIndex: 1,
        imageRendering: 'high-quality', /* Best image quality */
        backgroundOrigin: 'padding-box', /* Better for full coverage */
        minHeight: isPointChange ? '500px' : 'auto', /* Increased height for better image display */
        boxShadow: isPointChange ? '0 0 30px rgba(0,0,0,0.7)' : 'none' /* Add shadow for depth */
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
        
        {/* Removing particles for simplicity and better performance */}
        
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
        
        {!isPointChange && (
          <Text fontSize="sm" mb={2} color={houseColors.textColor}>{activeNotification.message}</Text>
        )}
        
        {activeNotification.house && (
          <Flex align="center" mb={2} className="notification-house-info" zIndex="10">
            <Badge 
              bg={activeNotification.house === 'gryffindor' ? '#740001' : 
                activeNotification.house === 'slytherin' ? '#1A472A' :
                activeNotification.house === 'ravenclaw' ? '#0E1A40' : '#FFB81C'} 
              color={activeNotification.house === 'hufflepuff' ? '#000000' : '#FFFFFF'}
              mr={2}
              p={1}
              fontSize="0.9rem" /* Slightly larger badge text */
              borderRadius="md"
              className={`house-badge house-badge-${activeNotification.house.toLowerCase()}`}
              style={{
                boxShadow: activeNotification.house === 'gryffindor' ? '0 0 15px rgba(218, 165, 32, 0.8)' : 
                  activeNotification.house === 'slytherin' ? '0 0 15px rgba(192, 192, 192, 0.8)' :
                  activeNotification.house === 'ravenclaw' ? '0 0 15px rgba(176, 196, 222, 0.8)' : 
                  '0 0 15px rgba(255, 217, 102, 0.8)', /* Increased glow */
                letterSpacing: "0.05em",
                fontWeight: "bold",
                border: activeNotification.house === 'gryffindor' ? '1px solid rgba(255, 215, 0, 0.6)' : 
                  activeNotification.house === 'slytherin' ? '1px solid rgba(192, 192, 192, 0.6)' :
                  activeNotification.house === 'ravenclaw' ? '1px solid rgba(176, 196, 222, 0.6)' : 
                  '1px solid rgba(255, 217, 102, 0.6)', /* Add subtle matching border */
                animation: `badge-pulse 1.5s infinite alternate` /* Add gentle pulsing animation */
              }}
            >
              {activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)}
            </Badge>
          </Flex>
        )}
        
        {/* Show reason with more robust handling */}
        {(() => {
          // Extract reason using multiple approaches for reliability
          let displayReason = null;
          
          // Extract reason from notification
          
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
          // Fourth priority: For personal points updates - changed to generic point messages
          else if (activeNotification.isPersonalPointsUpdate) {
            displayReason = isPointIncrease ? "Points Achievement" : "Points Deduction";
          }
          // Last resort fallback
          else if (!displayReason) {
            displayReason = isPointIncrease ? "Points awarded" : "Points deducted";
          }

          // Use the final display reason
          
          return (
            <Text 
              fontSize="md" // Increased size for better visibility
              fontWeight="bold" 
              color={isPointChange ? "white" : houseColors.accentColor}
              mb={2} 
              className={`notification-reason ${activeNotification.house ? `house-reason-${activeNotification.house.toLowerCase()}` : ''}`}
              style={{
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.8)", /* Enhanced text shadow for better readability */
                letterSpacing: "0.04em", /* Slightly increased letter spacing */
                zIndex: 3,
                position: "relative",
                padding: isPointChange ? "6px 12px" : "0", /* More padding */
                background: isPointChange ? "rgba(0,0,0,0.2)" : "transparent", /* Reduced background opacity */
                borderRadius: "10px", /* More rounded corners */
                display: "inline-block",
                border: isPointChange ? "1px solid rgba(255,255,255,0.15)" : "none", /* Subtle border */
                fontSize: isPointChange ? "1.1em" : "inherit" /* Slightly larger text for point changes */
              }}
            >
              {isPointChange ? displayReason : `Reason: ${displayReason}`}
            </Text>
          );
        })()}
        
        {isPointChange && (
          <>
            {/* Remove the smaller icon container since we're using full background image */}
            
            {/* Enhanced points display for the background version */}
            {/* Points Display - Larger with icon positioned behind the text */}
            <Flex 
              className="points-value-display"
              fontWeight="bold" 
              position="absolute"
              top="40%" /* Positioned in the middle upper area */
              left="50%"
              transform="translate(-50%, -50%)" 
              alignItems="center"
              justifyContent="center"
              width="100%" /* Full width */
              height="70%" /* Takes up most of the upper portion */
              style={{
                zIndex: 10,
                position: "relative",
                textAlign: "center",
              }}
            >
              {/* ICON BEHIND: Large icon positioned behind the text */}
              <Icon 
                as={isPointIncrease ? FaBolt : FaSkull}
                color={isPointIncrease ? "rgba(74, 222, 128, 0.4)" : "rgba(245, 101, 101, 0.4)"}
                position="absolute" 
                zIndex="1" /* Behind the text */
                boxSize="220px" /* Much larger icon */
                opacity="0.8"
                className={isPointIncrease ? "increase-icon-bg" : "decrease-icon-bg"}
              />
              
              {/* Points text overlay that appears on top of the icon */}
              <Text
                position="relative"
                zIndex="2" /* In front of the icon */
                textShadow={isPointIncrease ? 
                  "0 0 15px rgba(0,0,0,0.9), 0 0 25px rgba(74, 222, 128, 0.7), 0 0 40px rgba(0,0,0,0.8)" : 
                  "0 0 15px rgba(0,0,0,0.9), 0 0 25px rgba(245, 101, 101, 0.7), 0 0 40px rgba(0,0,0,0.8)"}
                color={isPointIncrease ? "#4ADE80" : "#F56565"}
                letterSpacing="0.05em"
                fontWeight="900" /* Extra bold */
                data-testid="points-change-display" 
                title={`Points ${isPointIncrease ? 'awarded' : 'deducted'}`}
                textAlign="center"
                fontSize="140px" /* Extra large text */
                style={{
                  filter: "drop-shadow(0 0 8px rgba(0,0,0,0.9))",
                }}
              >
                {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`}
              </Text>
            </Flex>
            
            {/* Content area at the bottom of the notification */}
            <Box
              position="absolute"
              bottom="0"
              left="0"
              right="0"
              background="rgba(0,0,0,0.75)" /* Darker background for better text visibility */
              padding="16px"
              borderTop={isPointIncrease ? 
                "4px solid rgba(74, 222, 128, 0.9)" : 
                "4px solid rgba(245, 101, 101, 0.9)"}
              textAlign="center"
              className="points-content-area" /* Added class for specific styling */
            >
              <Text 
                fontSize="22px" /* Larger text */
                fontWeight="bold"
                color="#FFFFFF" 
                textShadow="0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)"
                mb="1" /* Add margin below */
              >
                Points {isPointIncrease ? 'Awarded' : 'Deducted'}
              </Text>
              <Text 
                fontSize="16px" /* Larger reason text */
                color="#FFFFFF" 
                fontWeight="medium"
                opacity="0.9"
                mt="1"
                className={`house-reason-${activeNotification.house?.toLowerCase() || 'general'}`}
              >
                {activeNotification.reason || `For ${activeNotification.house} house`}
              </Text>
            </Box>
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