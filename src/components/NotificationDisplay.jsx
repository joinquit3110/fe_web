import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Box, 
  Text, 
  Image,
  VStack,
  CloseButton,
  Badge,
  Heading,
  Flex
} from '@chakra-ui/react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import '../styles/notification.css'; // This should import HarryPotter.css

// Import images for point change animations
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

// Helper function to standardize criteria text
const standardizeCriteria = (criteria) => {
  if (!criteria) return '';
  
  let normalized = criteria.trim();
  // Simplified common cases, can be expanded
  if (normalized.toLowerCase().includes('participation')) return 'Participation';
  if (normalized.toLowerCase().includes('english')) return 'English Usage';
  if (normalized.toLowerCase().includes('homework')) return 'Homework';
  if (normalized.toLowerCase().includes('assignment')) return 'Assignment';
  if (normalized.toLowerCase().includes('quiz')) return 'Quiz';
  if (normalized.toLowerCase().includes('test')) return 'Test';
  
  return normalized.charAt(0).toUpperCase() + normalized.slice(1); // Capitalize
};

// Notification display component
const NotificationDisplay = () => {
  const { notifications, removeNotification } = useSocket();
  const { user } = useAuth();
  const [activeNotification, setActiveNotification] = useState(null);
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const timerRef = useRef(null);

  const handleDismiss = useCallback(() => {
    if (activeNotification) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      if (activeNotification.id) {
         removeNotification(activeNotification.id);
      }
      
      setActiveNotification(null);
      processingQueue.current = false;
      
      if (notificationQueue.current.length > 0) {
        setTimeout(() => processQueue(), 300); // Delay to allow fade-out or transition
      }
    }
  }, [activeNotification, removeNotification, setActiveNotification, notificationQueue, timerRef]);

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
    
    const displayTime = next.duration || getDurationByType(next.type);
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, displayTime);
  }, [timerRef, processingQueue, setActiveNotification, notificationQueue, handleDismiss, getDurationByType]);

  const getNotificationTitle = (type) => {
    // Titles are now often set directly in SocketContext, but this can be a fallback
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
    // Default durations if not specified in notification object
    switch (type) {
      case 'error': return 12000;
      case 'warning': return 10000;
      case 'success': return 8000;
      case 'announcement': return 15000;
      default: return 7000;
    }
  };

  useEffect(() => {
    if (notifications.length > 0) {
      const newNotifications = notifications.filter(notification => {
        const inQueue = notificationQueue.current.some(n => n.id === notification.id);
        if (inQueue) return false;
        if (activeNotification && activeNotification.id === notification.id) return false;
        return true;
      });
      
      if (newNotifications.length > 0) {
        console.log('[NotificationDisplay] Queuing new notifications:', newNotifications);
        // Notification objects from SocketContext are now considered well-formed.
        notificationQueue.current = [...notificationQueue.current, ...newNotifications.map(n => ({...n}))];
        
        if (!processingQueue.current && !activeNotification) {
          processQueue();
        }
      }
    }
  }, [notifications, activeNotification, processQueue]);

  if (!activeNotification) {
    return null;
  }

  const isPointChange = activeNotification.pointsChange !== undefined && activeNotification.pointsChange !== null;
  const pointsValue = isPointChange ? Math.abs(activeNotification.pointsChange) : 0;
  const isPointIncrease = isPointChange && activeNotification.pointsChange > 0;
  const pointsImage = isPointIncrease ? increasePointImg : decreasePointImg;
  
  const isHousePoints = Boolean(activeNotification.isHousePointsUpdate);
  const isPersonalPoints = Boolean(activeNotification.isPersonalPointsUpdate);
  const isHouseAssessmentUpdate = Boolean(activeNotification.isHouseAssessmentUpdate);

  const title = activeNotification.title || getNotificationTitle(activeNotification.type);
  
  let finalMessage = activeNotification.message;
  let displaySeparateReason = activeNotification.reason;

  if (isHouseAssessmentUpdate) {
    // Reason is already integrated into activeNotification.message by SocketContext for assessments
    displaySeparateReason = null; 
  } else if (isPersonalPoints) {
    // Message from SocketContext: `${user.name || 'Your'} magic points ${data.change > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.change)}. New balance: ${data.new_magic_points}.`
    // Reason is separate. Append if specific.
    if (activeNotification.reason && activeNotification.reason !== 'Personal points update') {
        finalMessage += ` Reason: ${activeNotification.reason}`;
        displaySeparateReason = null;
    } else if (activeNotification.reason === 'Personal points update'){
        // Don't append "Reason: Personal points update" if message is already clear.
        // Keep it for separate display if desired, or nullify if too redundant.
        // For now, let it be displayed separately if it's this generic.
    }
  } else if (isHousePoints) {
    // Message from SocketContext: `House ${data.house} points ${data.points_change > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.points_change)}.`
    // Reason is separate. Append it.
    if (activeNotification.reason) {
        finalMessage += ` Reason: ${activeNotification.reason}`;
        displaySeparateReason = null;
    }
  }
  // For generic notifications, finalMessage is activeNotification.message, 
  // and displaySeparateReason is activeNotification.reason, which will be handled by the separate Text component.

  const themed = true; // Enable Harry Potter theme
  const containerClass = themed ? "notification-container-hp" : "notification-container";
  const contentClass = themed ? "notification-content-hp" : "notification-content";
  const headerClass = themed ? "notification-header-hp" : "";
  const bodyClass = themed ? "notification-body-hp" : "";
  const pointsClass = themed ? "notification-points-hp" : "";
  const reasonClass = themed ? "notification-reason-hp" : "";
  
  let houseNameClass = "";
  if (themed && activeNotification.house && (isHousePoints || isHouseAssessmentUpdate)) {
    houseNameClass = `notification-house-${activeNotification.house.toLowerCase().replace(/ /g, '-')}`;
  }

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex="toast"
      width={{ base: "90%", sm: "380px", md: "450px" }} // Adjusted width
      className={`${containerClass} ${isPointChange ? 'point-animation' : ''} ${houseNameClass}`}
      // Apply fade-in/out animations via CSS if desired, or simple transitions
      style={{
        transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
        // transform: activeNotification ? 'translateX(0)' : 'translateX(100%)', // Example for slide-in
        // opacity: activeNotification ? 1 : 0,
      }}
    >
      <Box
        borderWidth={themed ? "0" : "1px"} // HP theme has its own border
        borderRadius="lg"
        overflow="hidden"
        boxShadow="xl"
        p={0} // Padding will be handled by inner elements for HP theme
        className={contentClass}
      >
        <Flex className={headerClass} p={themed ? 0 : 3} px={themed ? 3 : undefined} py={themed ? 2 : undefined} alignItems="center" justifyContent="space-between">
          <Heading size="sm" noOfLines={1}>{title}</Heading>
          <CloseButton size="sm" onClick={handleDismiss} />
        </Flex>

        <Box p={3} className={bodyClass}>
          <VStack align="start" spacing={2}>
            {isPointChange && (
              <Flex align="center">
                <Image src={pointsImage} alt={isPointIncrease ? "Increase" : "Decrease"} boxSize="30px" mr={3} />
                <Text fontWeight="bold" fontSize="lg" className={pointsClass}>
                  {isPointIncrease ? '+' : '-'}{pointsValue} 
                  {(isHousePoints || (isHouseAssessmentUpdate && activeNotification.house)) 
                      ? ` ${activeNotification.house} Points` 
                      : ' Points'}
                </Text>
              </Flex>
            )}
            
            <Text fontSize="md">{finalMessage}</Text>

            {displaySeparateReason && (
              <Text fontSize="sm" className={reasonClass} fontStyle="italic">
                Reason: {displaySeparateReason}
              </Text>
            )}

            {activeNotification.criteria && (isHouseAssessmentUpdate || (!isHousePoints && !isPersonalPoints)) && (
              <Badge colorScheme="purple" variant="subtle">Criteria: {standardizeCriteria(activeNotification.criteria)}</Badge>
            )}
            {activeNotification.level && (isHouseAssessmentUpdate || (!isHousePoints && !isPersonalPoints)) && (
              <Badge 
                colorScheme={
                  activeNotification.level.toLowerCase() === 'excellent' || activeNotification.level.toLowerCase() === 'good' ? 'green' :
                  activeNotification.level.toLowerCase() === 'satisfactory' ? 'yellow' : 'orange'
                } 
                variant="subtle"
              >
                Level: {activeNotification.level.charAt(0).toUpperCase() + activeNotification.level.slice(1)}
              </Badge>
            )}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(NotificationDisplay);