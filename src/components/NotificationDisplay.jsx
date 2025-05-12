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
  Icon,
  Button
} from '@chakra-ui/react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { FaBolt, FaSkull, FaMagic, FaStar, FaGem } from 'react-icons/fa';
import '../styles/notification.css';
import '../styles/HarryPotter.css';
import '../styles/notification_animations.css';
import '../styles/notification_override.css'; // Import the override styles
import '../styles/icon_animations.css'; // Import icon animations
import '../styles/notification_animations_enhanced.css'; // Import enhanced animations

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

// Check if debug mode is enabled
const DEBUG_MODE = localStorage.getItem('NOTIF_DEBUG') === 'true';

// Enhanced house colors with more vibrant and magical palettes
const getHouseColors = (house) => {
  switch(house?.toLowerCase()) {
    case 'gryffindor':
      return {
        bgColor: 'linear-gradient(135deg, rgba(174, 0, 1, 0.92), rgba(122, 10, 10, 0.92) 40%, rgba(90, 5, 5, 0.95))',
        borderColor: 'rgba(255, 215, 0, 0.8)',
        textColor: '#F8F8F8',
        accentColor: 'rgba(255, 215, 0, 0.9)',  // Brighter gold
        glowColor: 'rgba(255, 215, 0, 0.7)',    // Gold glow
        secondaryColor: 'rgba(255, 215, 0, 0.6)'
      };
    case 'slytherin':
      return {
        bgColor: 'linear-gradient(135deg, rgba(26, 135, 65, 0.92), rgba(5, 77, 35, 0.92) 40%, rgba(3, 50, 23, 0.95))',
        borderColor: 'rgba(222, 222, 222, 0.8)',
        textColor: '#F8F8F8',
        accentColor: 'rgba(222, 222, 222, 0.9)',  // Brighter silver
        glowColor: 'rgba(222, 222, 222, 0.7)',    // Silver glow
        secondaryColor: 'rgba(222, 222, 222, 0.6)'
      };
    case 'ravenclaw':
      return {
        bgColor: 'linear-gradient(135deg, rgba(29, 66, 138, 0.92), rgba(10, 30, 90, 0.92) 40%, rgba(5, 15, 50, 0.95))',
        borderColor: 'rgba(203, 166, 126, 0.8)',
        textColor: '#F8F8F8',
        accentColor: 'rgba(203, 166, 126, 0.9)',  // Brighter bronze
        glowColor: 'rgba(173, 136, 96, 0.7)',     // Bronze glow
        secondaryColor: 'rgba(173, 136, 96, 0.6)'
      };
    case 'hufflepuff':
      return {
        bgColor: 'linear-gradient(135deg, rgba(236, 185, 27, 0.92), rgba(136, 106, 22, 0.92) 40%, rgba(70, 60, 5, 0.95))',
        borderColor: 'rgba(40, 40, 40, 0.8)',
        textColor: '#F8F8F8',
        accentColor: 'rgba(40, 40, 40, 0.9)',    // Black
        glowColor: 'rgba(255, 217, 102, 0.7)',   // Yellow glow
        secondaryColor: 'rgba(40, 40, 40, 0.6)'
      };
    default:
      return {
        bgColor: 'linear-gradient(135deg, rgba(80, 80, 160, 0.92), rgba(40, 40, 90, 0.92) 40%, rgba(30, 30, 70, 0.95))',
        borderColor: 'rgba(211, 166, 37, 0.8)',
        textColor: '#F8F8F8',
        accentColor: 'rgba(211, 166, 37, 0.9)',  // Default gold accent
        glowColor: 'rgba(211, 166, 37, 0.7)',    // Gold glow
        secondaryColor: 'rgba(211, 166, 37, 0.6)'
      };
  }
};

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
  
  // Debug state
  const [showDebugPanel, setShowDebugPanel] = useState(DEBUG_MODE);
  const [debugStats, setDebugStats] = useState({
    queueLength: 0,
    processedCount: 0,
    activeNotificationId: null,
    isProcessing: false,
    lastUpdate: null
  });

  // Update debug stats periodically
  useEffect(() => {
    if (showDebugPanel) {
      const updateInterval = setInterval(() => {
        setDebugStats({
          queueLength: notificationQueue.current.length,
          processedCount: processedIds.current.size,
          activeNotificationId: activeNotification?.id || null,
          isProcessing: processingQueue.current,
          lastUpdate: new Date().toISOString()
        });
      }, 1000);
      
      return () => clearInterval(updateInterval);
    }
  }, [showDebugPanel, activeNotification]);

  // Toggle debug mode
  const toggleDebugMode = () => {
    const newState = !showDebugPanel;
    setShowDebugPanel(newState);
    localStorage.setItem('NOTIF_DEBUG', newState ? 'true' : 'false');
  };

  // Debug keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        toggleDebugMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        // Log incoming notifications for troubleshooting
        console.log(`[NOTIFICATION] Processing ${newNotifications.length} new notifications`);
        newNotifications.forEach((notification, index) => {
          console.log(`[NOTIFICATION] New notification ${index}:`, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            house: notification.house,
            pointsChange: notification.pointsChange,
            isHousePointsUpdate: notification.isHousePointsUpdate,
            reason: notification.reason,
            criteria: notification.criteria,
            level: notification.level
          });
        });
        
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
          
          // Double check house point notifications have required fields
          if (notification.isHousePointsUpdate) {
            console.log(`[NOTIFICATION] Processing house points notification:`, {
              id: fixedNotification.id,
              house: fixedNotification.house,
              pointsChange: fixedNotification.pointsChange,
              reason: fixedNotification.reason,
              criteria: fixedNotification.criteria,
              level: fixedNotification.level
            });
          }
              
          return fixedNotification;
        });
        
        // Log the queue status before and after adding new notifications
        console.log(`[NOTIFICATION] Current queue before update: ${notificationQueue.current.length} items`);
        notificationQueue.current = [...notificationQueue.current, ...validatedNotifications];
        console.log(`[NOTIFICATION] Updated queue: ${notificationQueue.current.length} items`);
        
        if (!processingQueue.current && !activeNotification) {
          console.log('[NOTIFICATION] Starting queue processing');
          processQueue();
        } else {
          console.log('[NOTIFICATION] Queue processing already in progress or notification active');
          console.log(`[NOTIFICATION] Queue status: processingQueue=${processingQueue.current}, activeNotification=${activeNotification ? 'present' : 'null'}`);
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
      isIncrease: isPointIncrease,
      house: activeNotification.house,
      isHousePoints: Boolean(activeNotification.isHousePointsUpdate),
      isPersonalPointsUpdate: Boolean(activeNotification.isPersonalPointsUpdate),
      reason: activeNotification.reason,
      criteria: activeNotification.criteria,
      level: activeNotification.level,
      message: activeNotification.message
    });
  }
  
  const isHousePoints = Boolean(activeNotification.isHousePointsUpdate);
  const isHouseAssessment = Boolean(activeNotification.isHouseAssessmentUpdate);
  
  // Get theme colors based on notification house or type
  // Using direct function call instead of useMemo to avoid "cannot access before initialization" errors
  const houseColors = getHouseColors(activeNotification?.house);

  // Determine house class if present
  const houseClass = activeNotification?.house ? `house-${activeNotification.house.toLowerCase()}` : '';

  return (
    <>
      {/* Debug Panel */}
      {showDebugPanel && (
        <Box
          position="fixed"
          bottom="20px"
          left="20px"
          zIndex={9999}
          bg="rgba(0,0,0,0.85)"
          color="white"
          p={3}
          borderRadius="md"
          maxW="300px"
          fontSize="sm"
          boxShadow="0 0 20px rgba(0,0,0,0.5)"
          border="1px solid rgba(255,255,255,0.1)"
        >
          <Heading size="xs" mb={2}>Notification Debug</Heading>
          <VStack align="start" spacing={1}>
            <Text>Queue Length: {debugStats.queueLength}</Text>
            <Text>Processed: {debugStats.processedCount}</Text>
            <Text>Active: {debugStats.activeNotificationId || 'none'}</Text>
            <Text>Processing: {debugStats.isProcessing ? 'Yes' : 'No'}</Text>
            <Text fontSize="xs">Last Update: {debugStats.lastUpdate}</Text>
          </VStack>
          <Flex mt={2}>
            <Button 
              size="xs" 
              colorScheme="blue" 
              onClick={() => {
                notificationQueue.current = [];
                processedIds.current.clear();
                setActiveNotification(null);
                processingQueue.current = false;
                if (timerRef.current) clearTimeout(timerRef.current);
                console.log('[NOTIFICATION] Debug reset of notification system');
              }}
            >
              Reset Queue
            </Button>
          </Flex>
        </Box>
      )}
      
      {activeNotification ? (
        <Box
          position="fixed"
          top="20px"
          right="20px"
          zIndex="toast" /* Using toast z-index to ensure visibility */
          width={{ base: "94vw", sm: "500px", md: "550px" }}  /* Increased width for larger image */
          maxWidth="96vw"
          className={`notification-container ${activeNotification.type || 'default'} ${houseClass}`}
          style={{ pointerEvents: "all" }} /* Ensure clickable */
          transform="perspective(1000px)"
          _before={{
            content: '""',
            position: 'absolute',
            top: '-10px',
            left: '-10px',
            right: '-10px',
            bottom: '-10px',
            background: `radial-gradient(circle at center, ${houseColors.glowColor} 0%, transparent 70%)`,
            opacity: '0.4',
            filter: 'blur(15px)',
            zIndex: '-1',
            animation: 'pulse-glow 3s infinite ease-in-out'
          }}
        >
          <Box
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
              boxShadow: isPointChange ? 
                '0 0 30px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.3)' : 
                'inset 0 0 40px rgba(0,0,0,0.4)', /* Enhanced shadow for depth */
              transform: 'translateZ(0)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              animation: 'notification-appear 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            _after={{
              content: '""',
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              background: `radial-gradient(circle at top right, ${houseColors.glowColor}20, transparent 70%)`,
              pointerEvents: 'none'
            }}
          >
            {/* Add magical glow bar */}
            <div className="notification-glow-bar" style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '4px',
              height: '100%',
              background: `linear-gradient(to bottom, transparent, ${houseColors.accentColor}, transparent)`,
              boxShadow: `0 0 15px ${houseColors.accentColor}`,
              animation: 'glow-pulse 2s infinite alternate'
            }}></div>

            {/* Add magical sparkles */}
            <div className="magical-sparkle sparkle-1" style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: houseColors.accentColor,
              boxShadow: `0 0 10px ${houseColors.accentColor}`,
              animation: 'float 4s infinite ease-in-out',
              top: '15%',
              left: '10%',
              opacity: '0.8'
            }}></div>
            <div className="magical-sparkle sparkle-2" style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: houseColors.secondaryColor,
              boxShadow: `0 0 15px ${houseColors.secondaryColor}`,
              animation: 'float 5s infinite ease-in-out',
              top: '35%',
              right: '15%',
              opacity: '0.7'
            }}></div>
            <div className="magical-sparkle sparkle-3" style={{
              position: 'absolute',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: houseColors.accentColor,
              boxShadow: `0 0 8px ${houseColors.accentColor}`,
              animation: 'float 3s infinite ease-in-out',
              bottom: '20%',
              right: '30%',
              opacity: '0.9'
            }}></div>
            
            <Flex justifyContent="space-between" alignItems="center" mb={3} className="notification-header">
              <Heading 
                size="sm" 
                color={houseColors.textColor} 
                className="notification-title"
                letterSpacing={activeNotification.house ? "0.06em" : "0.04em"}
                fontFamily="'Cinzel', serif"
                textTransform="uppercase"
                fontWeight="bold"
                style={{
                  textShadow: `0 2px 4px rgba(0,0,0,0.8), 0 0 8px ${houseColors.glowColor}`,
                  background: `linear-gradient(90deg, ${houseColors.textColor}, ${houseColors.accentColor} 50%, ${houseColors.textColor})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'shimmer 3s infinite linear'
                }}
              >
                {activeNotification.title || getNotificationTitle(activeNotification.type)}
              </Heading>
              <CloseButton 
                size="sm" 
                color={houseColors.accentColor} 
                onClick={handleDismiss} 
                _hover={{
                  background: `rgba(255,255,255,0.2)`,
                  boxShadow: `0 0 10px ${houseColors.accentColor}`
                }}
              />
            </Flex>
            
            {!isPointChange && (
              <Text 
                fontSize="sm" 
                mb={2} 
                color={houseColors.textColor}
                style={{
                  textShadow: '0 2px 4px rgba(0,0,0,0.7)',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${houseColors.accentColor}`,
                  lineHeight: '1.5'
                }}
              >
                {activeNotification.message}
              </Text>
            )}
            
            {activeNotification.house && (
              <Flex align="center" mb={3} mt={2} className="notification-house-info" zIndex="10">
                <Badge 
                  bg={
                    activeNotification.house === 'gryffindor' ? 'linear-gradient(135deg, #740001, #ae0001)' : 
                    activeNotification.house === 'slytherin' ? 'linear-gradient(135deg, #1A472A, #2a623d)' :
                    activeNotification.house === 'ravenclaw' ? 'linear-gradient(135deg, #0E1A40, #222f5b)' : 
                    'linear-gradient(135deg, #ecb91b, #FFB81C)'
                  }
                  color={activeNotification.house === 'hufflepuff' ? '#000000' : '#FFFFFF'}
                  mr={2}
                  p={2}
                  fontSize="1rem" /* Larger badge text */
                  borderRadius="md"
                  className={`house-badge house-badge-${activeNotification.house.toLowerCase()}`}
                  style={{
                    boxShadow: 
                      activeNotification.house === 'gryffindor' ? '0 0 15px rgba(218, 165, 32, 0.8), inset 0 0 10px rgba(255,255,255,0.3)' : 
                      activeNotification.house === 'slytherin' ? '0 0 15px rgba(192, 192, 192, 0.8), inset 0 0 10px rgba(255,255,255,0.3)' :
                      activeNotification.house === 'ravenclaw' ? '0 0 15px rgba(176, 196, 222, 0.8), inset 0 0 10px rgba(255,255,255,0.3)' : 
                      '0 0 15px rgba(255, 217, 102, 0.8), inset 0 0 10px rgba(255,255,255,0.3)', /* Enhanced glow with inner highlight */
                    letterSpacing: "0.05em",
                    fontWeight: "bold",
                    border: 
                      activeNotification.house === 'gryffindor' ? '1px solid rgba(255, 215, 0, 0.6)' : 
                      activeNotification.house === 'slytherin' ? '1px solid rgba(192, 192, 192, 0.6)' :
                      activeNotification.house === 'ravenclaw' ? '1px solid rgba(176, 196, 222, 0.6)' : 
                      '1px solid rgba(255, 217, 102, 0.6)', /* Add subtle matching border */
                    animation: `badge-pulse 1.5s infinite alternate` /* Add gentle pulsing animation */
                  }}
                >
                  <Flex align="center">
                    <Icon
                      as={
                        activeNotification.house === 'gryffindor' ? FaGem :
                        activeNotification.house === 'slytherin' ? FaGem :
                        activeNotification.house === 'ravenclaw' ? FaGem :
                        FaGem
                      }
                      mr={2}
                      boxSize="14px"
                      color={
                        activeNotification.house === 'gryffindor' ? 'gold' :
                        activeNotification.house === 'slytherin' ? 'silver' :
                        activeNotification.house === 'ravenclaw' ? '#CBA67E' :
                        'black'
                      }
                    />
                    {activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)}
                  </Flex>
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
                  mb={3} 
                  className={`notification-reason ${activeNotification.house ? `house-reason-${activeNotification.house.toLowerCase()}` : ''}`}
                  style={{
                    textShadow: `0 2px 4px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.8), 0 0 20px ${isPointChange ? (isPointIncrease ? 'rgba(74, 222, 128, 0.5)' : 'rgba(245, 101, 101, 0.5)') : houseColors.glowColor}`,
                    letterSpacing: "0.05em", /* Slightly increased letter spacing */
                    zIndex: 3,
                    position: "relative",
                    padding: isPointChange ? "8px 16px" : "8px 12px", /* More padding */
                    background: isPointChange ? 
                      `linear-gradient(to right, rgba(0,0,0,0.1), rgba(0,0,0,0.3), rgba(0,0,0,0.1))` : 
                      `linear-gradient(to right, rgba(0,0,0,0.1), rgba(0,0,0,0.3), rgba(0,0,0,0.1))`,
                    borderRadius: "10px", /* More rounded corners */
                    display: "inline-block",
                    border: isPointChange ? 
                      `1px solid rgba(255,255,255,0.25)` : 
                      `1px solid ${houseColors.borderColor}`,
                    fontSize: isPointChange ? "1.1em" : "inherit", /* Slightly larger text for point changes */
                    animation: "reason-glow 3s infinite alternate",
                    backdropFilter: "blur(3px)"
                  }}
                >
                  <Icon
                    as={isPointChange ? 
                      (isPointIncrease ? FaMagic : FaSkull) : 
                      FaStar
                    }
                    mr={2}
                    color={isPointIncrease ? 
                      "rgba(74, 222, 128, 1)" : 
                      isPointChange ? "rgba(245, 101, 101, 1)" : 
                      houseColors.accentColor
                    }
                  />
                  {isPointChange ? displayReason : `Reason: ${displayReason}`}
                </Text>
              );
            })()}
            
            {isPointChange && (
              <>
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
                    style={{
                      filter: `drop-shadow(0 0 30px ${isPointIncrease ? 'rgba(74, 222, 128, 0.8)' : 'rgba(245, 101, 101, 0.8)'})`,
                      animation: isPointIncrease ? 'float-up 3s infinite alternate' : 'float-down 3s infinite alternate'
                    }}
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
                      background: `linear-gradient(to bottom, 
                        ${isPointIncrease ? '#4ADE80' : '#F56565'}, 
                        ${isPointIncrease ? '#22c55e' : '#ef4444'})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      animation: isPointIncrease ? 'pulse-grow 2s infinite alternate' : 'pulse-shrink 2s infinite alternate'
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
                  background={isPointIncrease ? 
                    "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.7), rgba(0,0,0,0))" : 
                    "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.7), rgba(0,0,0,0))"}
                  padding="20px"
                  borderTop={isPointIncrease ? 
                    `4px solid rgba(74, 222, 128, 0.9)` : 
                    `4px solid rgba(245, 101, 101, 0.9)`}
                  textAlign="center"
                  className="points-content-area" /* Added class for specific styling */
                >
                  <Text 
                    fontSize="24px" /* Larger text */
                    fontWeight="bold"
                    color="#FFFFFF" 
                    textShadow={`0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8), 0 0 30px ${isPointIncrease ? 'rgba(74, 222, 128, 0.7)' : 'rgba(245, 101, 101, 0.7)'}`}
                    mb="2" /* Add margin below */
                    letterSpacing="0.05em"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      animation: isPointIncrease ? 'title-glow-green 3s infinite alternate' : 'title-glow-red 3s infinite alternate'
                    }}
                  >
                    {isHousePoints ? 
                      `House Points ${isPointIncrease ? 'Awarded' : 'Deducted'}` : 
                      `Points ${isPointIncrease ? 'Awarded' : 'Deducted'}`}
                  </Text>
                  <Text 
                    fontSize="18px" /* Larger reason text */
                    color="#FFFFFF" 
                    fontWeight="medium"
                    opacity="0.9"
                    mt="2"
                    className={`house-reason-${activeNotification.house?.toLowerCase() || 'general'}`}
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                      padding: '4px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '20px',
                      display: 'inline-block',
                      backdropFilter: 'blur(2px)',
                      border: `1px solid ${isPointIncrease ? 'rgba(74, 222, 128, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`
                    }}
                  >
                    {activeNotification.reason || `For ${activeNotification.house || ''} house`}
                  </Text>
                  
                  {/* Add criteria and level display for house points */}
                  {isHousePoints && (activeNotification.criteria || activeNotification.level) && (
                    <Flex mt={3} justifyContent="center" gap={3}>
                      {activeNotification.criteria && (
                        <Badge 
                          bg={`rgba(255, 255, 255, 0.15)`}
                          color="white" 
                          px={3}
                          py={1.5}
                          borderRadius="full"
                          boxShadow={`0 0 10px ${isPointIncrease ? 'rgba(74, 222, 128, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`}
                          fontSize="0.9rem"
                          style={{
                            backdropFilter: 'blur(3px)',
                            border: `1px solid ${isPointIncrease ? 'rgba(74, 222, 128, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`
                          }}
                        >
                          <Flex align="center">
                            <Icon as={FaStar} mr={2} color={isPointIncrease ? '#4ADE80' : '#F56565'} />
                            Criteria: {activeNotification.criteria}
                          </Flex>
                        </Badge>
                      )}
                      
                      {activeNotification.level && (
                        <Badge 
                          bg={`rgba(255, 255, 255, 0.15)`}
                          color="white" 
                          px={3}
                          py={1.5}
                          borderRadius="full"
                          boxShadow={`0 0 10px ${isPointIncrease ? 'rgba(74, 222, 128, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`}
                          fontSize="0.9rem"
                          style={{
                            backdropFilter: 'blur(3px)',
                            border: `1px solid ${isPointIncrease ? 'rgba(74, 222, 128, 0.3)' : 'rgba(245, 101, 101, 0.3)'}`
                          }}
                        >
                          <Flex align="center">
                            <Icon as={FaMagic} mr={2} color={isPointIncrease ? '#4ADE80' : '#F56565'} />
                            Level: {activeNotification.level}
                          </Flex>
                        </Badge>
                      )}
                    </Flex>
                  )}
                </Box>
              </>
            )}
            
            {criteria && !isPointChange && (
              <Flex mt={3} flexWrap="wrap" justifyContent="center" gap={2}>
                {criteria && (
                  <Badge 
                    bg={activeNotification.house === 'gryffindor' ? 'rgba(157, 23, 23, 0.7)' :
                       activeNotification.house === 'slytherin' ? 'rgba(8, 98, 45, 0.7)' :
                       activeNotification.house === 'ravenclaw' ? 'rgba(14, 38, 109, 0.7)' :
                       activeNotification.house === 'hufflepuff' ? 'rgba(128, 109, 16, 0.7)' :
                       'rgba(128, 90, 213, 0.7)'} 
                    color="white" 
                    mr={2}
                    p={2}
                    boxShadow={activeNotification.house === 'gryffindor' ? '0 0 10px rgba(218, 165, 32, 0.6)' :
                       activeNotification.house === 'slytherin' ? '0 0 10px rgba(192, 192, 192, 0.6)' :
                       activeNotification.house === 'ravenclaw' ? '0 0 10px rgba(176, 196, 222, 0.6)' :
                       activeNotification.house === 'hufflepuff' ? '0 0 10px rgba(255, 217, 102, 0.6)' :
                       '0 0 10px rgba(128, 90, 213, 0.6)'}
                    className={`criteria-badge ${activeNotification.house ? `house-badge-${activeNotification.house.toLowerCase()}` : ''}`}
                    borderRadius="full"
                    fontSize="0.9rem"
                    style={{
                      backdropFilter: 'blur(2px)',
                      border: `1px solid ${houseColors.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Icon as={FaStar} />
                    {criteria}
                  </Badge>
                )}
                {level && (
                  <Badge 
                    bg={activeNotification.house === 'gryffindor' ? 'rgba(157, 23, 23, 0.6)' :
                       activeNotification.house === 'slytherin' ? 'rgba(8, 98, 45, 0.6)' :
                       activeNotification.house === 'ravenclaw' ? 'rgba(14, 38, 109, 0.6)' :
                       activeNotification.house === 'hufflepuff' ? 'rgba(128, 109, 16, 0.6)' :
                       'rgba(49, 151, 149, 0.6)'}
                    color="white"
                    p={2}
                    boxShadow={activeNotification.house === 'gryffindor' ? '0 0 10px rgba(218, 165, 32, 0.5)' :
                       activeNotification.house === 'slytherin' ? '0 0 10px rgba(192, 192, 192, 0.5)' :
                       activeNotification.house === 'ravenclaw' ? '0 0 10px rgba(176, 196, 222, 0.5)' :
                       activeNotification.house === 'hufflepuff' ? '0 0 10px rgba(255, 217, 102, 0.5)' :
                       '0 0 10px rgba(49, 151, 149, 0.5)'}
                    className={`level-badge ${activeNotification.house ? `house-badge-${activeNotification.house.toLowerCase()}` : ''}`}
                    borderRadius="full"
                    fontSize="0.9rem"
                    style={{
                      backdropFilter: 'blur(2px)',
                      border: `1px solid ${houseColors.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Icon as={FaMagic} />
                    {level}
                  </Badge>
                )}
              </Flex>
            )}
          </Box>
        </Box>
      ) : null}
    </>
  );
};

export default memo(NotificationDisplay);