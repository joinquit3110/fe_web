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
  if (!criteria) return ''; // Return empty string if input is falsy

  const normalized = String(criteria).trim(); // Ensure it's a string and trim

  if (normalized.toLowerCase().includes('participation')) {
    return 'Participation';
  } else if (normalized.toLowerCase().includes('english')) {
    return 'English Usage'; // Or a more specific standardized term
  }
  // Add more 'else if' blocks here for other specific criteria you want to standardize
  // e.g., else if (normalized.toLowerCase().includes('teamwork')) { return 'Teamwork'; }

  return normalized; // Return the trimmed original if no specific rules matched
};

// Helper function to extract criteria and level from a notification
function extractCriteriaAndLevel(notification) {
  let criteria = null;
  let level = null;

  // Get criteria from notification object and standardize it
  if (notification.criteria) {
    criteria = standardizeCriteria(notification.criteria);
  }

  // Get level directly from notification object
  if (notification.level) {
    level = String(notification.level).trim(); // Ensure it's a string and trim
    if (level === '') level = null; // Treat empty string as null
  }

  return { criteria, level };
}

// Notification display component
const NotificationDisplay = () => {
  const { notifications, removeNotification } = useSocket();
  const { user } = useAuth();
  const [activeNotification, setActiveNotification] = useState(null);
  const timerRef = useRef(null);

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
      
      const notificationElement = document.querySelector('.notification-container');
      if (notificationElement) {
        notificationElement.classList.add('dismissing');
        
        setTimeout(() => {
          removeNotification(activeNotification.id);
        }, 300); // Animation duration
      } else {
        removeNotification(activeNotification.id);
      }
    }
  }, [activeNotification, removeNotification, timerRef]);

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const currentNotification = notifications[0];
      if (!activeNotification || activeNotification.id !== currentNotification.id) {
        setActiveNotification(currentNotification);

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        let displayTime = currentNotification.duration;
        if (!displayTime) {
          displayTime = getDurationByType(currentNotification.type || 'info');
          if (currentNotification.isHousePointsUpdate || currentNotification.isHouseAssessmentUpdate) {
            displayTime = Math.max(displayTime, 10000);
          }
        }
        
        console.log(`[NOTIFICATION] Displaying: ${currentNotification.id}, duration: ${displayTime}ms`, currentNotification);

        timerRef.current = setTimeout(() => {
          const notificationElement = document.querySelector('.notification-container');
          if (notificationElement) {
            notificationElement.classList.add('dismissing');
            setTimeout(() => {
              removeNotification(currentNotification.id);
            }, 300); 
          } else {
            removeNotification(currentNotification.id);
          }
        }, displayTime);
      }
    } else if (activeNotification) {
      // If notifications array is empty but there's an active one, clear it
      setActiveNotification(null);
    }

    // Cleanup timer on unmount or when activeNotification changes
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [notifications, activeNotification, removeNotification, getDurationByType]);

  if (!activeNotification) {
    return null;
  }

  let criteria = null;
  let level = null;
  
  try {
    if (activeNotification) {
      const extracted = extractCriteriaAndLevel(activeNotification);
      criteria = extracted.criteria && extracted.criteria !== '' ? extracted.criteria : null;
      level = extracted.level && extracted.level !== '' ? extracted.level : null;
    }
  } catch (error) {
    console.error("Error extracting criteria/level:", error, activeNotification);
  }

  const isPointChange = activeNotification.pointsChange !== undefined;
  const pointsValue = isPointChange ? Math.abs(activeNotification.pointsChange) : 0;
  const isPointIncrease = isPointChange && activeNotification.pointsChange > 0;
  const pointsImage = isPointIncrease ? increasePointImg : decreasePointImg;

  const isHousePoints = Boolean(activeNotification.isHousePointsUpdate);
  const isHouseAssessment = Boolean(activeNotification.isHouseAssessmentUpdate);

  const houseColors = getHouseColors(activeNotification.house);
  const houseClass = activeNotification.house ? `house-${activeNotification.house.toLowerCase()}` : '';

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex="toast"
      width={{ base: "94vw", sm: "500px", md: "550px" }}
      maxWidth="96vw"
      className={`notification-container ${activeNotification.type || 'default'} ${houseClass}`}
      style={{ pointerEvents: "all" }}
    >
      <Box
        borderWidth="5px"
        borderRadius="lg" 
        overflow="hidden"
        borderColor={isPointChange ? 
          `rgba(${isPointIncrease ? '255, 215, 0, 0.9' : '255, 100, 100, 0.9'})` : 
          houseColors.borderColor}
        p={isPointChange ? 0 : 4}
        className={`magical-notification ${isPointChange ? 'points-background' : ''}`}
        style={{
          background: isPointChange 
            ? `url(${pointsImage}) no-repeat center center`
            : houseColors.bgColor,
          backgroundSize: isPointChange ? 'cover' : 'cover',
          backgroundPosition: isPointChange ? 'center center' : 'center center',
          position: 'relative',
          zIndex: 1,
          imageRendering: 'high-quality',
          backgroundOrigin: 'padding-box',
          minHeight: isPointChange ? '500px' : 'auto',
          boxShadow: isPointChange ? '0 0 30px rgba(0,0,0,0.7)' : 'none'
        }}
      >
        <div className="notification-glow-bar" style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '4px',
          height: '100%',
          background: houseColors.accentColor,
          boxShadow: `0 0 10px ${houseColors.accentColor}`
        }}></div>
        
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
              fontSize="0.9rem"
              borderRadius="md"
              className={`house-badge house-badge-${activeNotification.house.toLowerCase()}`}
              style={{
                boxShadow: activeNotification.house === 'gryffindor' ? '0 0 15px rgba(218, 165, 32, 0.8)' : 
                  activeNotification.house === 'slytherin' ? '0 0 15px rgba(192, 192, 192, 0.8)' :
                  activeNotification.house === 'ravenclaw' ? '0 0 15px rgba(176, 196, 222, 0.8)' : 
                  '0 0 15px rgba(255, 217, 102, 0.8)',
                letterSpacing: "0.05em",
                fontWeight: "bold",
                border: activeNotification.house === 'gryffindor' ? '1px solid rgba(255, 215, 0, 0.6)' : 
                  activeNotification.house === 'slytherin' ? '1px solid rgba(192, 192, 192, 0.6)' :
                  activeNotification.house === 'ravenclaw' ? '1px solid rgba(176, 196, 222, 0.6)' : 
                  '1px solid rgba(255, 217, 102, 0.6)',
                animation: `badge-pulse 1.5s infinite alternate`
              }}
            >
              {activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)}
            </Badge>
          </Flex>
        )}
        
        {(() => {
          let displayReason = null;
          
          if (activeNotification.reason && 
              activeNotification.reason !== 'System update' && 
              activeNotification.reason.trim() !== '') {
            displayReason = activeNotification.reason;
          } else if (activeNotification.message && activeNotification.message.includes(':')) {
            const parts = activeNotification.message.split(':');
            if (parts.length > 1 && parts[1].trim() !== '') {
              displayReason = parts[1].trim();
            }
          } else if (isHousePoints && activeNotification.house) {
            displayReason = `${activeNotification.house.charAt(0).toUpperCase() + activeNotification.house.slice(1)} house points update`;
          } else if (activeNotification.isPersonalPointsUpdate) {
            displayReason = isPointIncrease ? "Points Achievement" : "Points Deduction";
          } else if (!displayReason) {
            displayReason = isPointIncrease ? "Points awarded" : "Points deducted";
          }

          return (
            <Text 
              fontSize="md"
              fontWeight="bold" 
              color={isPointChange ? "white" : houseColors.accentColor}
              mb={2} 
              className={`notification-reason ${activeNotification.house ? `house-reason-${activeNotification.house.toLowerCase()}` : ''}`}
              style={{
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.8)",
                letterSpacing: "0.04em",
                zIndex: 3,
                position: "relative",
                padding: isPointChange ? "6px 12px" : "0",
                background: isPointChange ? "rgba(0,0,0,0.2)" : "transparent",
                borderRadius: "10px",
                display: "inline-block",
                border: isPointChange ? "1px solid rgba(255,255,255,0.15)" : "none",
                fontSize: isPointChange ? "1.1em" : "inherit"
              }}
            >
              {isPointChange ? displayReason : `Reason: ${displayReason}`}
            </Text>
          );
        })()}
        
        {isPointChange && (
          <>
            <Flex 
              className="points-value-display"
              fontWeight="bold" 
              position="absolute"
              top="40%"
              left="50%"
              transform="translate(-50%, -50%)" 
              alignItems="center"
              justifyContent="center"
              width="100%"
              height="70%"
              style={{
                zIndex: 10,
                position: "relative",
                textAlign: "center",
              }}
            >
              <Icon 
                as={isPointIncrease ? FaBolt : FaSkull}
                color={isPointIncrease ? "rgba(74, 222, 128, 0.4)" : "rgba(245, 101, 101, 0.4)"}
                position="absolute" 
                zIndex="1"
                boxSize="220px"
                opacity="0.8"
                className={isPointIncrease ? "increase-icon-bg" : "decrease-icon-bg"}
              />
              
              <Text
                position="relative"
                zIndex="2"
                textShadow={isPointIncrease ? 
                  "0 0 15px rgba(0,0,0,0.9), 0 0 25px rgba(74, 222, 128, 0.7), 0 0 40px rgba(0,0,0,0.8)" : 
                  "0 0 15px rgba(0,0,0,0.9), 0 0 25px rgba(245, 101, 101, 0.7), 0 0 40px rgba(0,0,0,0.8)"}
                color={isPointIncrease ? "#4ADE80" : "#F56565"}
                letterSpacing="0.05em"
                fontWeight="900"
                data-testid="points-change-display" 
                title={`Points ${isPointIncrease ? 'awarded' : 'deducted'}`}
                textAlign="center"
                fontSize="140px"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(0,0,0,0.9))",
                }}
              >
                {isPointIncrease ? `+${pointsValue}` : `-${pointsValue}`}
              </Text>
            </Flex>
            
            <Box
              position="absolute"
              bottom="0"
              left="0"
              right="0"
              background="rgba(0,0,0,0.75)"
              padding="16px"
              borderTop={isPointIncrease ? 
                "4px solid rgba(74, 222, 128, 0.9)" : 
                "4px solid rgba(245, 101, 101, 0.9)"}
              textAlign="center"
              className="points-content-area"
            >
              <Text 
                fontSize="22px"
                fontWeight="bold"
                color="#FFFFFF" 
                textShadow="0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)"
                mb="1"
              >
                Points {isPointIncrease ? 'Awarded' : 'Deducted'}
              </Text>
              <Text 
                fontSize="16px"
                color="#FFFFFF" 
                fontWeight="medium"
                opacity="0.9"
                mt="1"
                className={`house-reason-${activeNotification.house?.toLowerCase() || 'general'}`}
              >
                {(activeNotification.reason && String(activeNotification.reason).trim() !== '') ? String(activeNotification.reason).trim() : `For ${activeNotification.house || 'your house'}`}
              </Text>
            </Box>
          </>
        )}
        
        {criteria && (
          <Flex mt={2} className="criteria-level-badges-container">
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