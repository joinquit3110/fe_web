import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Badge, CloseButton, Fade, Stack, Image, Flex } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
// Import the image assets
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';

const API_URL = 'https://be-web-6c4k.onrender.com/api';

const NotificationDisplay = () => {
  const [serverNotifications, setServerNotifications] = useState([]);
  const [activeNotifications, setActiveNotifications] = useState([]);
  const { user, isAuthenticated } = useAuth();
  
  // Add a try-catch to safely use the socket context
  let socketNotifications = [];
  let removeNotification = () => {};
  
  try {
    // Try to get socket context - this might not be available if SocketProvider is not in the tree
    const socketContext = useSocket();
    socketNotifications = socketContext?.notifications || [];
    removeNotification = socketContext?.removeNotification || (() => {});
  } catch (error) {
    console.warn('Socket context not available:', error.message);
  }
  
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const activeTimeouts = useRef([]); // Track all active timeouts
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all notification timeouts on unmount
      activeTimeouts.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, []);
  
  // Merge server and socket notifications
  useEffect(() => {
    if (socketNotifications.length > 0) {
      // Add new socket notifications to the queue
      socketNotifications.forEach(notification => {
        // Process message to extract point change amount if it's a points notification
        let pointsChange = null;
        let reason = null;
        let criteria = null;
        let level = null;
        
        // Check for direct properties first (these would come from AdminContext)
        if (notification.pointsChange !== undefined) {
          pointsChange = notification.pointsChange;
        }
        
        if (notification.reason) {
          reason = notification.reason;
        }
        
        if (notification.criteria) {
          criteria = notification.criteria;
        }
        
        if (notification.level) {
          level = notification.level;
        }
        
        // If direct properties aren't available, try to extract from message
        if (notification.message) {
          // Remove "by admin" from message if present
          let message = notification.message.replace(/ by admin/g, '');
          
          // Extract points change information if not already set
          if (pointsChange === null) {
            if (message.includes('increased by') || message.includes('decreased by')) {
              const match = message.match(/(increased|decreased) by (\d+)/);
              if (match) {
                const changeType = match[1];
                const amount = parseInt(match[2], 10);
                pointsChange = changeType === 'increased' ? amount : -amount;
              }
            }
            
            // Alternative formats: "+10 points" or "-10 points"
            if (pointsChange === null) {
              const plusMatch = message.match(/\+(\d+) points/);
              const minusMatch = message.match(/\-(\d+) points/);
              if (plusMatch) {
                pointsChange = parseInt(plusMatch[1], 10);
              } else if (minusMatch) {
                pointsChange = -parseInt(minusMatch[1], 10);
              }
            }
            
            // Another pattern: "awarded to" or "deducted from"
            if (pointsChange === null) {
              const awardedMatch = message.match(/(\d+) points awarded to/);
              const deductedMatch = message.match(/(\d+) points deducted from/);
              if (awardedMatch) {
                pointsChange = parseInt(awardedMatch[1], 10);
              } else if (deductedMatch) {
                pointsChange = -parseInt(deductedMatch[1], 10);
              }
            }
          }
          
          // Check for reasons in message if not already set
          if (!reason) {
            const reasonMatch = message.match(/[Rr]eason:?\s*(.+?)(?=\.|$|\s*Criteria:|\s*Level:)/);
            if (reasonMatch) {
              reason = reasonMatch[1].trim();
            }
          }
          
          // Try to extract criteria and level from message if not already set
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
          
          // Update message without "by admin"
          notification.message = message;
        }
        
        console.log('Socket notification processed:', {
          id: notification.id,
          message: notification.message,
          pointsChange,
          reason,
          criteria,
          level
        });
        
        const notificationItem = {
          id: notification.id,
          type: notification.type,
          title: getNotificationTitle(notification.type),
          message: notification.message,
          timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
          source: 'socket',
          duration: getDurationByType(notification.type),
          pointsChange,
          reason,
          criteria,
          level
        };
        
        // Create a composite key for this notification to help with deduplication
        const notifKey = pointsChange ? 
          `point-change:${pointsChange}:${Date.now()}` : 
          `${notification.type}:${notification.message?.substring(0, 30)}:${Date.now()}`;
          
        notificationItem.compositeKey = notifKey;
        
        // Add to queue if not already present
        if (!notificationQueue.current.some(item => item.id === notification.id)) {
          notificationQueue.current.push(notificationItem);
        }
      });
      
      // Delay processing to allow potential follow-up notifications with more details
      if (!processingQueue.current) {
        // Use a small delay (250ms) to allow closely-timed notifications to be grouped together
        const delayTimeoutId = setTimeout(() => {
          processNotificationQueue();
          // Clean up timeout
          activeTimeouts.current = activeTimeouts.current.filter(id => id !== delayTimeoutId);
        }, 250);
        
        // Track timeout for cleanup
        activeTimeouts.current.push(delayTimeoutId);
      }
    }
  }, [socketNotifications]);
  
  // Poll for server notifications
  useEffect(() => {
    let interval = null;
    
    const fetchNotifications = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get(`${API_URL}/notifications`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data && response.data.length > 0) {
          // Update server notifications
          setServerNotifications(response.data);
          
          // Add new server notifications to the queue
          response.data.forEach(notification => {
            // Check if this notification is already in the queue
            const existingNotification = notificationQueue.current.find(
              item => item.source === 'server' && item.id === notification._id
            );
            
            if (!existingNotification) {
              // Process message to extract point change amount if it's a points notification
              let pointsChange = null;
              let reason = notification.reason || null;
              let criteria = null;
              let level = null;
              
              // Check for direct properties first
              if (notification.pointsChange !== undefined) {
                pointsChange = notification.pointsChange;
              }
              
              if (notification.criteria) {
                criteria = notification.criteria;
              }
              
              if (notification.level) {
                level = notification.level;
              }
              
              // If direct properties aren't available, try to extract from message
              if (notification.message) {
                // Remove "by admin" from message if present
                let message = notification.message.replace(/ by admin/g, '');
                
                // Extract points change information if not already set
                if (pointsChange === null) {
                  if (message.includes('increased by') || message.includes('decreased by')) {
                    const match = message.match(/(increased|decreased) by (\d+)/);
                    if (match) {
                      const changeType = match[1];
                      const amount = parseInt(match[2], 10);
                      pointsChange = changeType === 'increased' ? amount : -amount;
                    }
                  }
                  
                  // Alternative formats: "+10 points" or "-10 points"
                  if (pointsChange === null) {
                    const plusMatch = message.match(/\+(\d+) points/);
                    const minusMatch = message.match(/\-(\d+) points/);
                    if (plusMatch) {
                      pointsChange = parseInt(plusMatch[1], 10);
                    } else if (minusMatch) {
                      pointsChange = -parseInt(minusMatch[1], 10);
                    }
                  }
                  
                  // Another pattern: "awarded to" or "deducted from"
                  if (pointsChange === null) {
                    const awardedMatch = message.match(/(\d+) points awarded to/);
                    const deductedMatch = message.match(/(\d+) points deducted from/);
                    if (awardedMatch) {
                      pointsChange = parseInt(awardedMatch[1], 10);
                    } else if (deductedMatch) {
                      pointsChange = -parseInt(deductedMatch[1], 10);
                    }
                  }
                }
                
                // Check for reasons if not already set
                if (!reason) {
                  const reasonMatch = message.match(/[Rr]eason:?\s*(.+?)(?=\.|$|\s*Criteria:|\s*Level:)/);
                  if (reasonMatch) {
                    reason = reasonMatch[1].trim();
                  }
                }
                
                // Try to extract criteria and level if not already set
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
                
                // Update message without "by admin"
                notification.message = message;
              }
              
              console.log('Server notification processed:', {
                id: notification._id,
                message: notification.message,
                pointsChange,
                reason,
                criteria, 
                level
              });
              
              const notificationItem = {
                id: notification._id,
                type: notification.type || 'info',
                title: notification.title || getNotificationTitle(notification.type || 'info'),
                message: notification.message,
                timestamp: new Date(notification.createdAt),
                source: 'server',
                duration: getDurationByType(notification.type || 'info'),
                pointsChange,
                reason,
                criteria,
                level
              };
              notificationQueue.current.push(notificationItem);
            }
          });
          
          // Process the queue if not already processing
          if (!processingQueue.current) {
            processNotificationQueue();
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    // Initial fetch
    fetchNotifications();
    
    // Set up polling interval (every 15 seconds)
    if (isAuthenticated) {
      interval = setInterval(fetchNotifications, 15000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, user]);
  
  // Check for locally stored notifications from localStorage fallback
  useEffect(() => {
    const checkLocalFallbackNotifications = () => {
      try {
        const pendingNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
        
        if (pendingNotifications.length > 0) {
          console.log('Found local fallback notifications:', pendingNotifications);
          
          // Process each notification and add it to the queue
          pendingNotifications.forEach(notification => {
            // Check if this notification is already in the queue
            const existingNotification = notificationQueue.current.find(
              item => item.id === notification.id
            );
            
            if (!existingNotification) {
              console.log('Adding local fallback notification to queue:', notification);
              
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
          
          // Clear the processed notifications
          localStorage.setItem('pendingNotifications', '[]');
          
          // Process the queue if not already processing
          if (!processingQueue.current) {
            processNotificationQueue();
          }
        }
      } catch (error) {
        console.error('Error processing local fallback notifications:', error);
      }
    };
    
    // Initial check
    checkLocalFallbackNotifications();
    
    // Set up interval to check for new local fallback notifications
    const interval = setInterval(checkLocalFallbackNotifications, 3000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Helper function to get appropriate title
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
      case 'error': return 10000; // 10 seconds
      case 'warning': return 8000; // 8 seconds
      case 'success': return 6000; // 6 seconds
      case 'announcement': return 15000; // 15 seconds
      default: return 7000; // 7 seconds
    }
  };
  
  // Helper to create a random ID
  const createId = () => Math.random().toString(36).substring(2, 15);
  
  // Process notification queue with deduplication logic
  const processNotificationQueue = () => {
    if (notificationQueue.current.length === 0 || processingQueue.current) {
      return;
    }
    
    processingQueue.current = true;
    
    // Log how many notifications are being processed before deduplication
    console.log(`[NOTIFICATION] Processing ${notificationQueue.current.length} notifications`);

    // Enhanced deduplication for point changes and other notifications
    const deduplicatedQueue = [];
    const messageMap = new Map();
    // Special map just for point changes to handle them differently
    const pointChangeMap = new Map();
    // Special map for criteria/level notices to avoid duplicates
    const criteriaLevelMap = new Map();
    // Track processed notifications by their composite keys
    const processedKeys = new Set();
    
    // First, prioritize notifications with more complete information
    // Sort to process notifications with the most complete information first
    const sortedQueue = [...notificationQueue.current].sort((a, b) => {
      // Calculate completeness score (presence of fields)
      const scoreA = (a.reason ? 1 : 0) + (a.criteria ? 1 : 0) + (a.level ? 1 : 0);
      const scoreB = (b.reason ? 1 : 0) + (b.criteria ? 1 : 0) + (b.level ? 1 : 0);
      
      // If scores are equal, prioritize newer notifications
      if (scoreB === scoreA) {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
        return timeB - timeA; // Newer first
      }
      
      return scoreB - scoreA; // Higher score first
    });
    
    // Clear the queue first to avoid processing duplicates
    notificationQueue.current = [];
    
    sortedQueue.forEach(notification => {
      // Generate a unique composite key for each notification for better deduplication
      const pointChangeKey = notification.pointsChange ? `:${notification.pointsChange}` : '';
      const criteriaKey = notification.criteria ? `:${notification.criteria}` : '';
      const levelKey = notification.level ? `:${notification.level}` : '';
      const compositeKey = `${notification.type}${pointChangeKey}${criteriaKey}${levelKey}`;
      
      // Skip if we've already processed a notification with this composite key
      if (processedKeys.has(compositeKey)) {
        console.log(`[NOTIFICATION] Skipping duplicate with composite key: ${compositeKey}`);
        return;
      }
      
      // Mark this composite key as processed
      processedKeys.add(compositeKey);
      
      // Special handling for point change notifications
      if (notification.pointsChange) {
        // Create a key based on the point change value and direction
        const pointKey = `points:${notification.pointsChange}`;
        
        // Check for duplicates based on more strict criteria
        // Include criteria and level in the key if they exist
        const fullKey = `${pointKey}${criteriaKey}${levelKey}`;

        if (pointChangeMap.has(fullKey)) {
          const existingNotif = pointChangeMap.get(fullKey);
          const currentTime = new Date().getTime();
          // Make sure we can handle both string timestamps and Date objects
          const existingTime = existingNotif.timestamp ? 
            (existingNotif.timestamp instanceof Date ? 
              existingNotif.timestamp.getTime() : 
              new Date(existingNotif.timestamp).getTime()) : 
            0;
          
          // Only consolidate if notifications are within 60 seconds of each other
          if (Math.abs(currentTime - existingTime) < 60000) {
            // Always prefer "POINTS AWARDED!" or "POINTS DEDUCTED!" titles over generic ones
            if (notification.title && notification.title.includes('POINTS')) {
              existingNotif.title = notification.title;
            }
            
            // Update the existing notification with data from this one
            if (!existingNotif.reason && notification.reason) {
              existingNotif.reason = notification.reason;
            }
            if (!existingNotif.criteria && notification.criteria) {
              existingNotif.criteria = notification.criteria;
            }
            if (!existingNotif.level && notification.level) {
              existingNotif.level = notification.level;
            }
            
            // Always keep the timestamp if it exists and ensure it's a valid Date
            if (!existingNotif.timestamp && notification.timestamp) {
              existingNotif.timestamp = new Date(notification.timestamp);
            }
            
            // If we have all details, update the message to be more comprehensive
            if (existingNotif.criteria && existingNotif.level) {
              const direction = notification.pointsChange > 0 ? 'awarded to' : 'deducted from';
              const house = user?.house || 'your house';
              existingNotif.message = `${Math.abs(notification.pointsChange)} points ${direction} ${house}. Criteria: ${existingNotif.criteria}. Level: ${existingNotif.level}`;
              
              // Add reason to message if available
              if (existingNotif.reason) {
                existingNotif.message += `. Reason: ${existingNotif.reason}`;
              }
            }
            
            // Log the updated notification
            console.log('[NOTIFICATION] Updated existing notification with more info:', existingNotif);
          } else {
            // If they're far apart in time, treat as separate notifications
            const uniqueKey = `${fullKey}-${Date.now()}`;
            pointChangeMap.set(uniqueKey, notification);
            deduplicatedQueue.push(notification);
          }
        } else {
          // First time seeing this point change
          pointChangeMap.set(fullKey, notification);
          deduplicatedQueue.push(notification);
        }
        
        // Special case: We also need to check for duplicate criteria/level combinations
        if (notification.criteria && notification.level) {
          const criteriaLevelKey = `${notification.criteria}:${notification.level}`;
          criteriaLevelMap.set(criteriaLevelKey, true);
        }
      } else {
        // Non-point change notifications use the regular deduplication logic
        const messageKey = `${notification.type}:${notification.message?.substring(0, 30) || ''}`;
        
        if (messageMap.has(messageKey)) {
          const existingNotif = messageMap.get(messageKey);
          
          // Update with better data if available
          if (!existingNotif.reason && notification.reason) {
            existingNotif.reason = notification.reason;
          }
          if (!existingNotif.criteria && notification.criteria) {
            existingNotif.criteria = notification.criteria;
          }
          if (!existingNotif.level && notification.level) {
            existingNotif.level = notification.level;
          }
          
          // Use the most recent timestamp
          if (notification.timestamp) {
            try {
              const notifTime = new Date(notification.timestamp);
              if (!existingNotif.timestamp || notifTime > new Date(existingNotif.timestamp)) {
                existingNotif.timestamp = notifTime;
              }
            } catch (e) {
              console.warn('Invalid timestamp format:', e);
              // Keep existing timestamp if the new one is invalid
            }
          }
        } else {
          // Skip if this is a criteria/level only notification that we already have with a point change
          if (notification.criteria && notification.level) {
            const criteriaLevelKey = `${notification.criteria}:${notification.level}`;
            if (criteriaLevelMap.has(criteriaLevelKey)) {
              console.log('[NOTIFICATION] Skipping duplicate criteria/level notification:', notification);
              return; // Skip this notification
            }
          }
          
          // First time seeing this message
          messageMap.set(messageKey, notification);
          deduplicatedQueue.push(notification);
        }
      }
    });
    
    // Get all values from pointChangeMap to ensure we use the updated versions
    const pointChangeNotifications = Array.from(pointChangeMap.values());
    
    // Create the final queue from deduplicatedQueue but use updated point change notifications
    const finalQueue = deduplicatedQueue.filter(n => !n.pointsChange)
      .concat(pointChangeNotifications);
    
    // Log the result of deduplication
    console.log(`[NOTIFICATION] After deduplication: ${finalQueue.length} notifications remain`);
    
    // Replace queue with deduplicated version
    notificationQueue.current = finalQueue;

    // Continue with normal processing
    const notification = notificationQueue.current.shift();
    
    // Add to active notifications
    if (notification) {
      // Ensure point changes have appropriate titles
      if (notification.pointsChange) {
        if (notification.pointsChange > 0 && (!notification.title || !notification.title.includes('POINTS'))) {
          notification.title = 'POINTS AWARDED!';
        } else if (notification.pointsChange < 0 && (!notification.title || !notification.title.includes('POINTS'))) {
          notification.title = 'POINTS DEDUCTED!';
        }
      }
      
      // Make sure we have a valid timestamp
      if (!notification.timestamp) {
        notification.timestamp = new Date();
      } else if (!(notification.timestamp instanceof Date)) {
        try {
          // Ensure the timestamp is a valid Date object
          notification.timestamp = new Date(notification.timestamp);
          // Check if it's a valid date
          if (isNaN(notification.timestamp.getTime())) {
            throw new Error('Invalid date');
          }
        } catch (e) {
          console.warn('Invalid timestamp format, creating new timestamp');
          notification.timestamp = new Date();
        }
      }
      
      // Generate a consistent ID for this notification if it doesn't have one
      const notifId = notification.id || createId();
      
      setActiveNotifications(prev => {
        // Create unique ID if not present
        const notifWithId = {
          ...notification,
          id: notifId
        };
        
        // Check if we already have similar notifications (avoid duplicates)
        const similarExists = prev.some(n => {
          // For point changes, look for matching point amount
          if (notification.pointsChange && n.pointsChange === notification.pointsChange) {
            const timeDiff = Math.abs(
              (n.timestamp instanceof Date ? n.timestamp.getTime() : new Date(n.timestamp || 0).getTime()) - 
              (notification.timestamp instanceof Date ? notification.timestamp.getTime() : new Date(notification.timestamp || 0).getTime())
            );
            return timeDiff < 30000; // Within 30 seconds
          }
          
          // For other notifications, check similar message
          if (n.message && notification.message && 
              n.message.substring(0, 30) === notification.message.substring(0, 30)) {
            return true;
          }
          
          return false;
        });
        
        if (similarExists) {
          console.log('Skipping similar active notification');
          return prev;
        }
        
        // If there's a similar active notification about the same points, remove it first
        const filteredPrev = notification.pointsChange 
          ? prev.filter(n => !(n.pointsChange && n.pointsChange === notification.pointsChange)) 
          : prev.filter(n => n.id !== notifWithId.id);
        
        return [notifWithId, ...filteredPrev].slice(0, 5); // Keep max 5 active notifications
      });
      
      // Remove from original source to prevent reprocessing
      if (notification.source === 'socket') {
        try {
          removeNotification(notification.id);
        } catch (error) {
          console.warn('Error removing notification:', error.message);
        }
      }
      
      // Auto-dismiss after notification duration
      const duration = notification.duration || getDurationByType(notification.type) || 7000;
      console.log(`Setting auto-dismiss for notification ${notifId} to disappear after ${duration}ms`);
      
      const timeoutId = setTimeout(() => {
        console.log(`Auto-dismissing notification ${notifId}`);
        setActiveNotifications(prev => {
          return prev.filter(item => item.id !== notifId);
        });
        // Remove this timeout ID from the tracking array
        activeTimeouts.current = activeTimeouts.current.filter(id => id !== timeoutId);
      }, duration);
      
      // Store timeout ID for cleanup
      activeTimeouts.current.push(timeoutId);
      
      // Process next notification after delay
      const nextProcessTimeoutId = setTimeout(() => {
        processingQueue.current = false;
        processNotificationQueue();
        // Remove this timeout ID from the tracking array
        activeTimeouts.current = activeTimeouts.current.filter(id => id !== nextProcessTimeoutId);
      }, 500); // Small delay between notifications
      
      // Store timeout ID for cleanup
      activeTimeouts.current.push(nextProcessTimeoutId);
    } else {
      processingQueue.current = false;
    }
  };
  
  // Add a self-test function to create test notifications with all fields
  // This is for debugging only
  useEffect(() => {
    // Check for a special flag in localStorage (can be set in browser console for testing)
    const shouldRunTest = localStorage.getItem('testNotifications') === 'true';
    if (shouldRunTest) {
      console.log('Creating test notifications...');
      
      // Helper to create a random ID
      const createId = () => Math.random().toString(36).substring(2, 15);
      
      // Create a positive points test notification
      const positiveNotification = {
        id: createId(),
        type: 'success',
        title: 'Points Awarded!',
        message: '15 points awarded to Gryffindor for excellent participation',
        timestamp: new Date(),
        source: 'test',
        duration: 10000,
        pointsChange: 15,
        reason: 'Active participation in Potions class',
        criteria: 'Level of participation of group members',
        level: 'Excellent'
      };
      
      // Create a negative points test notification
      const negativeNotification = {
        id: createId(),
        type: 'warning',
        title: 'Points Deducted!',
        message: '10 points deducted from Slytherin for poor spell casting',
        timestamp: new Date(),
        source: 'test',
        duration: 10000,
        pointsChange: -10,
        reason: 'Failed to complete assigned tasks on time',
        criteria: 'Time taken by the group to complete tasks',
        level: 'Poor'
      };
      
      // Add to queue
      notificationQueue.current.push(positiveNotification);
      
      // Add the negative notification after a delay
      setTimeout(() => {
        notificationQueue.current.push(negativeNotification);
      }, 1000);
      
      // Process queue
      if (!processingQueue.current) {
        processNotificationQueue();
      }
      
      // Clear the flag
      localStorage.removeItem('testNotifications');
    }
  }, []);
  
  // Clear a specific notification
  const handleClose = (id) => {
    setActiveNotifications(prev => prev.filter(item => item.id !== id));
  };
  
  if (activeNotifications.length === 0) return null;
  
  return (
    <Stack spacing={5} position="fixed" top="100px" right="20px" zIndex={1000} maxWidth="480px" maxHeight="calc(100vh - 150px)" overflowY="auto">
      {activeNotifications.map(notification => (
        <Fade key={notification.id} in={true}>
          <Box
            padding="0"
            borderRadius="12px"
            color="white"
            className="wizard-panel notification-panel"
            boxShadow="0 10px 30px rgba(0,0,0,0.5)"
            minHeight="auto" 
            width="100%"
            height="auto"
            position="relative"
            overflow="hidden"
            border="1px solid rgba(255, 255, 255, 0.2)"
            background={`linear-gradient(135deg, 
              ${notification.type === 'success' ? 'rgba(46, 204, 113, 0.95)' : 
                notification.type === 'warning' || notification.type === 'error' ? 'rgba(231, 76, 60, 0.95)' :
                notification.type === 'announcement' ? 'rgba(142, 68, 173, 0.95)' : 
                'rgba(52, 152, 219, 0.95)'} 0%,
              ${notification.type === 'success' ? 'rgba(39, 174, 96, 0.98)' : 
                notification.type === 'warning' || notification.type === 'error' ? 'rgba(192, 57, 43, 0.98)' :
                notification.type === 'announcement' ? 'rgba(113, 54, 138, 0.98)' : 
                'rgba(41, 128, 185, 0.98)'} 100%)`
            }
            transform="perspective(1000px)"
            _before={{
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `url(${notification.pointsChange > 0 ? increasePointImg : decreasePointImg}) no-repeat center`,
              backgroundSize: '250px',
              opacity: notification.pointsChange ? 0.07 : 0,
              zIndex: 0,
              filter: 'blur(2px)'
            }}
          >
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
                onClick={() => handleClose(notification.id)} 
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
              {/* Point change visualization - more compact and magical */}
              {notification.pointsChange && (
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
                      src={notification.pointsChange > 0 ? increasePointImg : decreasePointImg}
                      alt={notification.pointsChange > 0 ? 'Points increased' : 'Points decreased'}
                      className={notification.pointsChange > 0 ? 'increase-animation' : 'decrease-animation'}
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
                        color={notification.pointsChange > 0 ? "#2ecc71" : "#e74c3c"}
                        className="points-text-animation"
                        textShadow="0 0 10px rgba(0,0,0,0.6)"
                        fontFamily="'Cinzel', serif"
                      >
                        {notification.pointsChange > 0 ? `+${notification.pointsChange}` : notification.pointsChange}
                      </Text>
                    </Box>
                    
                    {/* Point change glowing effect */}
                    <Box
                      position="absolute"
                      top="0"
                      left="0"
                      right="0"
                      bottom="0"
                      borderRadius="50%"
                      className={notification.pointsChange > 0 ? "point-glow-positive" : "point-glow-negative"}
                      zIndex={1}
                      pointerEvents="none"
                    />
                  </Box>
                </Box>
              )}
              
              {/* Message with parchment-like styling */}
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
                  {notification.message}
                </Text>
              </Box>
              
              {/* House points details section */}
              {(notification.reason || notification.criteria || notification.level) && (
                <Box 
                  borderRadius="md"
                  overflow="hidden"
                  className="details-scroll"
                  border="1px solid rgba(255,255,255,0.3)"
                  boxShadow="0 5px 15px rgba(0,0,0,0.2)"
                  mb={3}
                >
                  {/* Reason section with icon */}
                  {notification.reason && (
                    <Box 
                      p={4}
                      borderBottom={notification.criteria || notification.level ? "1px solid rgba(255,255,255,0.2)" : "none"}
                      bg="rgba(0,0,0,0.2)"
                      position="relative"
                      _hover={{bg: "rgba(0,0,0,0.25)"}}
                      transition="all 0.2s"
                    >
                      <Flex alignItems="flex-start">
                        <Box 
                          width="32px" 
                          height="32px" 
                          borderRadius="50%" 
                          bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
                          border="2px solid rgba(255,255,255,0.4)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                          mt="2px"
                          boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                        >
                          <Text fontSize="sm" fontWeight="bold">R</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Reason</Text>
                          <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{notification.reason}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Criteria section with icon */}
                  {notification.criteria && (
                    <Box 
                      p={4}
                      borderBottom={notification.level ? "1px solid rgba(255,255,255,0.2)" : "none"}
                      bg="rgba(0,0,0,0.15)"
                      position="relative"
                      _hover={{bg: "rgba(0,0,0,0.2)"}}
                      transition="all 0.2s"
                    >
                      <Flex alignItems="flex-start">
                        <Box 
                          width="32px" 
                          height="32px" 
                          borderRadius="50%" 
                          bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
                          border="2px solid rgba(255,255,255,0.4)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                          mt="2px"
                          boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                        >
                          <Text fontSize="sm" fontWeight="bold">C</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Criteria</Text>
                          <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{notification.criteria}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Level section with icon */}
                  {notification.level && (
                    <Box 
                      p={4}
                      bg="rgba(0,0,0,0.2)"
                      position="relative"
                      _hover={{bg: "rgba(0,0,0,0.25)"}}
                      transition="all 0.2s"
                    >
                      <Flex alignItems="flex-start">
                        <Box 
                          width="32px" 
                          height="32px" 
                          borderRadius="50%" 
                          bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
                          border="2px solid rgba(255,255,255,0.4)"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mr={3}
                          mt="2px"
                          boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                        >
                          <Text fontSize="sm" fontWeight="bold">L</Text>
                        </Box>
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Level</Text>
                          <Text 
                            fontSize="md" 
                            fontWeight="medium" 
                            lineHeight="1.4"
                            p={2}
                            bg={
                              notification.level.toLowerCase().includes('excellent') ? 'rgba(46, 204, 113, 0.2)' :
                              notification.level.toLowerCase().includes('good') ? 'rgba(52, 152, 219, 0.2)' :
                              notification.level.toLowerCase().includes('satisfactory') ? 'rgba(241, 196, 15, 0.2)' :
                              notification.level.toLowerCase().includes('poor') ? 'rgba(231, 76, 60, 0.2)' :
                              'rgba(0,0,0,0.1)'
                            }
                            borderRadius="md"
                            display="inline-block"
                          >
                            {notification.level}
                          </Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Timestamp footer */}
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
          </Box>
        </Fade>
      ))}
      
      {/* Custom CSS for animations - simplified to reduce lag */}
      <style jsx global>{`
        @keyframes pop-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .notification-panel {
          animation: pop-in 0.3s ease-out;
          transform-origin: center center;
        }
        
        .notification-panel::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255,255,255,0.7);
          z-index: 10;
          animation: wipe-through 3s linear forwards;
        }
        
        @keyframes wipe-through {
          0% { left: 0; right: 100%; }
          100% { left: 0; right: 0; }
        }
        
        .points-text-animation {
          /* Removed animation for better performance */
          position: relative;
          z-index: 3;
        }
        
        .point-glow-positive {
          box-shadow: 0 0 15px rgba(46, 204, 113, 0.7);
        }
        
        .point-glow-negative {
          box-shadow: 0 0 15px rgba(231, 76, 60, 0.7);
        }
        
        .message-parchment {
          position: relative;
        }
        
        .details-scroll {
          position: relative;
          transform: translateZ(0);
          transition: transform 0.2s;
        }
        
        .details-scroll:hover {
          transform: translateY(-2px);
        }
        
        .point-change-container {
          animation: appear-fade 0.5s ease-out forwards;
        }
        
        .image-container {
          position: relative;
          transform-origin: center center;
        }
        
        .increase-animation {
          filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7));
        }
        
        .decrease-animation {
          filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7));
        }
        
        @keyframes appear-fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </Stack>
  );
};

export default NotificationDisplay;