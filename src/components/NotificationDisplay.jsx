import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../context/SocketContext';
// Import the image assets
import increasePointImg from '../asset/IncreasePoint.png';
import decreasePointImg from '../asset/DecreasePoint.png';
// Thay đổi cách import Chakra UI để tránh lỗi constructor
import * as Chakra from '@chakra-ui/react';

const NotificationDisplay = () => {
  const [activeNotifications, setActiveNotifications] = useState([]);
  const { user } = useAuth();
  
  // Get socket notifications directly from the SocketContext
  let socketNotifications = [];
  let removeNotification = () => {};
  
  try {
    const socketContext = useSocket();
    socketNotifications = socketContext?.notifications || [];
    removeNotification = socketContext?.removeNotification || (() => {});
  } catch (error) {
    console.warn('Socket context not available:', error.message);
  }
  
  // Sử dụng useRef để lưu trữ dữ liệu không gây re-render
  const notificationQueue = useRef([]);
  const processingQueue = useRef(false);
  const activeTimeouts = useRef([]);
  const globalDedupeRegistry = useRef(new Map());
  const lastNotificationTime = useRef(Date.now());
  
  // Thêm đếm số lượng thông báo
  const pendingCount = useRef(0);
  
  // Thêm preload images để tránh giật khi hiển thị
  useEffect(() => {
    // Preload images
    const preloadImages = () => {
      const img1 = new Image();
      const img2 = new Image();
      img1.src = increasePointImg;
      img2.src = decreasePointImg;
    };
    preloadImages();
  }, []);
  
  // Helper function to create a notification hash for deduplication
  const getNotificationHash = useCallback((notification) => {
    const type = notification.type || 'info';
    const pointsChange = notification.pointsChange ? `pc:${notification.pointsChange}` : '';
    const criteria = notification.criteria ? `cr:${notification.criteria}` : '';
    const level = notification.level ? `lv:${notification.level}` : '';
    const msgStart = notification.message ? notification.message.substring(0, 30) : '';
    
    return `${type}|${pointsChange}|${criteria}|${level}|${msgStart}`;
  }, []);
  
  // Helper function to standardize criteria text
  const standardizeCriteria = useCallback((criteriaText) => {
    if (!criteriaText) return '';
    
    const lowerCriteria = criteriaText.toLowerCase();
    
    if (lowerCriteria.includes('participation') || lowerCriteria.includes('member')) {
      return 'Level of participation of group members';
    }
    
    if (lowerCriteria.includes('english') || lowerCriteria.includes('language')) {
      return 'Level of English usage in the group';
    }
    
    if (lowerCriteria.includes('time') || lowerCriteria.includes('complete') || lowerCriteria.includes('task')) {
      return 'Time taken by the group to complete tasks';
    }
    
    return criteriaText;
  }, []);
  
  // Helper function to standardize performance level text
  const standardizeLevel = useCallback((levelText) => {
    if (!levelText) return '';
    
    const lowerLevel = levelText.toLowerCase();
    
    if (lowerLevel.includes('excellent')) return 'Excellent';
    if (lowerLevel.includes('good')) return 'Good';
    if (lowerLevel.includes('satisfactory')) return 'Satisfactory';
    if (lowerLevel.includes('poor') && lowerLevel.includes('very')) return 'Very Poor';
    if (lowerLevel.includes('poor')) return 'Poor';
    
    return levelText;
  }, []);
  
  // Extract criteria and level - tối ưu hóa với useCallback
  const extractCriteriaAndLevel = useCallback((notification) => {
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
  }, [standardizeCriteria, standardizeLevel]);
  
  // Cleanup stale dedupe entries at interval ngắn hơn
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      globalDedupeRegistry.current.forEach((timestamp, key) => {
        if (now - timestamp > 30000) { // Giảm xuống 30 giây
          globalDedupeRegistry.current.delete(key);
        }
      });
    }, 20000); // Giảm xuống 20 giây
    
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
  
  // Process fallback notifications from localStorage ngay khi component mount
  useEffect(() => {
    const checkLocalFallbackNotifications = () => {
      try {
        const pendingNotifications = JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
        
        if (pendingNotifications.length > 0) {
          console.log('[NOTIFICATION] Processing local fallback notifications:', pendingNotifications.length);
          
          // Xử lý theo batch để không block thread chính
          const processNotifications = (index = 0) => {
            if (index >= pendingNotifications.length) {
              localStorage.setItem('pendingNotifications', '[]');
              
              // Chỉ cần xử lý queue khi tất cả đã được thêm vào
              if (!processingQueue.current) {
                requestAnimationFrame(() => processNotificationQueue());
              }
              return;
            }
            
            const notification = pendingNotifications[index];
            if (!notificationQueue.current.some(item => item.id === notification.id)) {
              const notificationItem = {
                id: notification.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                type: notification.type || 'info',
                title: notification.title || getNotificationTitle(notification.type || 'info'),
                message: notification.message,
                timestamp: new Date(notification.timestamp || Date.now()),
                source: 'local-fallback',
                duration: getDurationByType(notification.type || 'info'),
                pointsChange: notification.pointsChange,
                reason: notification.reason,
                criteria: notification.criteria || notification.typeDetails?.criteria,
                level: notification.level || notification.typeDetails?.level,
                priority: notification.priority || 'medium'
              };
              notificationQueue.current.push(notificationItem);
              pendingCount.current++;
            }
            
            // Sử dụng requestAnimationFrame để xử lý batch tiếp theo
            requestAnimationFrame(() => processNotifications(index + 1));
          };
          
          processNotifications();
        }
      } catch (error) {
        console.error('Error processing local fallback notifications:', error);
      }
    };
    
    // Kiểm tra ngay lập tức khi component mount
    checkLocalFallbackNotifications();
    
    // Thiết lập interval nhưng với tần suất cao hơn
    const interval = setInterval(checkLocalFallbackNotifications, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Thêm event listener để theo dõi các sự kiện thông báo trực tiếp
  useEffect(() => {
    const handleDirectNotification = (event) => {
      const { type, message, title, pointsChange, reason, criteria, level } = event.detail || {};
      
      if (!message) return;
      
      // Tạo một thông báo trực tiếp
      const directNotification = {
        id: `direct_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        type: type || 'info',
        title: title || getNotificationTitle(type || 'info'),
        message: message,
        timestamp: new Date(),
        source: 'direct-event',
        duration: getDurationByType(type || 'info'),
        pointsChange, reason, criteria, level,
        priority: 'high',
        isFresh: true
      };
      
      // Thêm thông báo này vào queue với ưu tiên cao
      notificationQueue.current.unshift(directNotification);
      pendingCount.current++;
      
      // Xử lý queue ngay
      if (!processingQueue.current) {
        requestAnimationFrame(() => processNotificationQueue());
      }
    };
    
    // Lắng nghe các sự kiện từ window
    window.addEventListener('showNotification', handleDirectNotification);
    window.addEventListener('housePointsUpdated', handleDirectNotification);
    
    return () => {
      window.removeEventListener('showNotification', handleDirectNotification);
      window.removeEventListener('housePointsUpdated', handleDirectNotification);
    };
  }, []);
  
  // Helper functions cho hiển thị thông báo - dùng useMemo để tối ưu hóa
  const getNotificationTitle = useMemo(() => (type) => {
    switch (type) {
      case 'success': return 'Success!';
      case 'warning': return 'Warning!';
      case 'error': return 'Error!';
      case 'announcement': return 'Announcement';
      default: return 'Notification';
    }
  }, []);
  
  const getDurationByType = useMemo(() => (type) => {
    switch (type) {
      case 'error': return 12000; // 12 seconds
      case 'warning': return 10000; // 10 seconds
      case 'success': return 8000; // 8 seconds
      case 'announcement': return 15000; // 15 seconds
      default: return 8000; // 8 seconds
    }
  }, []);
  
  // Create random ID helper
  const createId = useCallback(() => 
    `notification_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, 
  []);
  
  // Process socket notifications when they change - tối ưu hóa hiệu năng
  useEffect(() => {
    if (socketNotifications.length === 0) return;
    
    // Lấy những thông báo mới từ socketNotifications
    const newNotifications = socketNotifications.filter(notification => 
      !notificationQueue.current.some(item => item.id === notification.id)
    );
    
    if (newNotifications.length === 0) return;
    
    // Xử lý theo batch để tránh block thread
    const processNextBatch = (notifications, startIndex = 0, batchSize = 3) => {
      const endIndex = Math.min(startIndex + batchSize, notifications.length);
      const currentBatch = notifications.slice(startIndex, endIndex);
      
      currentBatch.forEach(notification => {
        // Extract data from notification
        let pointsChange = notification.pointsChange !== undefined ? notification.pointsChange : null;
        let reason = notification.reason || null;
        let criteria = notification.criteria || null;
        let level = notification.level || null;
        
        // Xử lý message nếu có
        if (notification.message) {
          let message = notification.message.replace(/ by admin/g, '');
          
          // Trích xuất thông tin từ message nếu cần
          if (pointsChange === null) {
            if (message.includes('increased by') || message.includes('decreased by')) {
              const match = message.match(/(increased|decreased) by (\d+)/);
              if (match) {
                const changeType = match[1];
                const amount = parseInt(match[2], 10);
                pointsChange = changeType === 'increased' ? amount : -amount;
              }
            }
            
            // Dùng các biểu thức khác
            if (pointsChange === null) {
              const plusMatch = message.match(/\+(\d+) points/);
              const minusMatch = message.match(/\-(\d+) points/);
              const awardedMatch = message.match(/(\d+) points awarded to/);
              const deductedMatch = message.match(/(\d+) points deducted from/);
              
              if (plusMatch) pointsChange = parseInt(plusMatch[1], 10);
              else if (minusMatch) pointsChange = -parseInt(minusMatch[1], 10);
              else if (awardedMatch) pointsChange = parseInt(awardedMatch[1], 10);
              else if (deductedMatch) pointsChange = -parseInt(deductedMatch[1], 10);
            }
          }
          
          // Trích xuất reason, criteria và level nếu cần
          if (!reason) {
            const reasonMatch = message.match(/[Rr]eason:?\s*(.+?)(?=\.|$|\s*Criteria:|\s*Level:)/);
            if (reasonMatch) reason = reasonMatch[1].trim();
          }
          
          if (!criteria || !level) {
            const extracted = extractCriteriaAndLevel({ message, criteria, level });
            criteria = extracted.criteria;
            level = extracted.level;
          }
          
          notification.message = message;
        }
        
        // Tạo notification item với đủ data
        const notificationItem = {
          id: notification.id,
          type: notification.type,
          title: notification.title || getNotificationTitle(notification.type),
          message: notification.message,
          timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
          source: 'socket',
          duration: getDurationByType(notification.type),
          pointsChange,
          reason,
          criteria,
          level,
          priority: notification.priority || 'medium',
          isFresh: (Date.now() - new Date(notification.timestamp || Date.now()).getTime()) < 5000
        };
        
        // Thêm vào queue
        notificationQueue.current.push(notificationItem);
        pendingCount.current++;
      });
      
      // Nếu còn batch tiếp theo, xử lý tiếp
      if (endIndex < notifications.length) {
        setTimeout(() => {
          processNextBatch(notifications, endIndex, batchSize);
        }, 0);
      } else {
        // Đã xử lý tất cả, bắt đầu hiển thị
        if (!processingQueue.current && notificationQueue.current.length > 0) {
          requestAnimationFrame(() => processNotificationQueue());
        }
      }
    };
    
    // Bắt đầu xử lý batch đầu tiên
    processNextBatch(newNotifications);
    
  }, [socketNotifications, extractCriteriaAndLevel, getNotificationTitle, getDurationByType]);
  
  // Process notification queue with improved efficiency and priority
  const processNotificationQueue = useCallback(() => {
    if (notificationQueue.current.length === 0 || processingQueue.current) {
      return;
    }
    
    processingQueue.current = true;
    pendingCount.current = notificationQueue.current.length;
    
    // Filter irrelevant notifications for user
    notificationQueue.current = notificationQueue.current.filter(notification => {
      // Skip point notifications cho các loại user không liên quan
      if (user?.house === 'admin' || user?.house === 'muggle' || !user?.house) {
        if (notification.pointsChange || 
            (notification.message && (
              notification.message.toLowerCase().includes('points') || 
              notification.message.toLowerCase().includes('house')
            ))) {
          return false;
        }
      }
      
      // Lọc các thông báo "points updated to"
      if (notification.message && (
          notification.message.includes('magic points have been updated to') ||
          notification.message.includes('magic points have been increased by') || 
          notification.message.includes('magic points have been decreased by')
      )) {
        return false;
      }
      
      return true;
    });

    // Chuẩn hóa dữ liệu và đánh dấu thông báo mới
    notificationQueue.current.forEach(notification => {
      if (notification.criteria || notification.level) {
        const extracted = extractCriteriaAndLevel(notification);
        notification.criteria = extracted.criteria;
        notification.level = extracted.level;
      }
      
      const timestamp = notification.timestamp instanceof Date ? 
        notification.timestamp.getTime() : 
        notification.timestamp ? new Date(notification.timestamp).getTime() : Date.now();
      
      notification.isFresh = Date.now() - timestamp < 5000; // Giảm còn 5 giây
    });
    
    // Sắp xếp theo độ ưu tiên và thời gian - ưu tiên thông báo quan trọng hơn
    notificationQueue.current.sort((a, b) => {
      // So sánh priority trước
      const priorityOrder = {
        'high': 3,
        'medium': 2,
        'low': 1
      };
      
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // So sánh "fresh" tiếp theo
      if (a.isFresh !== b.isFresh) {
        return a.isFresh ? -1 : 1;
      }
      
      // Cuối cùng là theo timestamp
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : Date.now();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : Date.now();
      return timeB - timeA;
    });
    
    // Loại bỏ thông báo trùng lặp
    const dedupeGroups = new Map();
    
    notificationQueue.current.forEach(notification => {
      const hash = getNotificationHash(notification);
      
      if (!notification.isFresh && globalDedupeRegistry.current.has(hash)) {
        return; // Bỏ qua thông báo đã thấy gần đây
      }
      
      // Tạo key cho nhóm loại bỏ trùng lặp
      const key = notification.isFresh ? 
        `${notification.type}:${notification.pointsChange || ''}:${Date.now()}` : 
        `${notification.type}:${notification.pointsChange || ''}:${notification.criteria || ''}`;
      
      if (!dedupeGroups.has(key)) {
        dedupeGroups.set(key, []);
      }
      
      dedupeGroups.get(key).push(notification);
    });
    
    // Lấy thông báo mới nhất từ mỗi nhóm
    const uniqueNotifications = [];
    dedupeGroups.forEach((group) => {
      uniqueNotifications.push(group[0]);
    });
    
    notificationQueue.current = uniqueNotifications;
    
    // Xử lý một thông báo
    const notification = notificationQueue.current.shift();
    pendingCount.current = notificationQueue.current.length;
    
    if (notification) {
      // Thêm vào registry để tránh trùng lặp trong tương lai
      const hash = getNotificationHash(notification);
      if (!notification.isFresh) {
        globalDedupeRegistry.current.set(hash, Date.now());
      }
      
      // Đặt tiêu đề phù hợp nếu cần
      if (notification.pointsChange) {
        if (notification.pointsChange > 0 && (!notification.title || !notification.title.includes('POINTS'))) {
          notification.title = 'POINTS AWARDED!';
        } else if (notification.pointsChange < 0 && (!notification.title || !notification.title.includes('POINTS'))) {
          notification.title = 'POINTS DEDUCTED!';
        }
      }
      
      // Đảm bảo timestamp hợp lệ
      if (!notification.timestamp) {
        notification.timestamp = new Date();
      } else if (!(notification.timestamp instanceof Date)) {
        try {
          notification.timestamp = new Date(notification.timestamp);
          if (isNaN(notification.timestamp.getTime())) {
            notification.timestamp = new Date();
          }
        } catch {
          notification.timestamp = new Date();
        }
      }
      
      // Tạo ID nếu chưa có
      const notifId = notification.id || createId();
      
      // Dùng requestAnimationFrame để thêm thông báo mà không block thread
      requestAnimationFrame(() => {
        setActiveNotifications(prev => {
          const notifWithId = { ...notification, id: notifId };
          
          // Bỏ qua các thông báo trùng lặp chính xác
          if (prev.some(n => n.id === notifId)) {
            return prev;
          }
          
          // Lưu thời gian thông báo gần nhất
          lastNotificationTime.current = Date.now();
          
          // Giới hạn số lượng thông báo hiển thị cùng lúc
          return [notifWithId, ...prev].slice(0, 3);
        });
      });
      
      // Xóa khỏi SocketContext để tránh xử lý lại
      if (notification.source === 'socket') {
        try {
          removeNotification(notification.id);
        } catch (error) {
          console.warn('Error removing notification:', error.message);
        }
      }
      
      // Thiết lập timeout tự động đóng thông báo
      let duration = notification.duration || getDurationByType(notification.type) || 7000;
      
      // Giảm thời gian nếu có nhiều thông báo đang chờ
      if (pendingCount.current > 2) duration = Math.min(duration, 5000);
      if (pendingCount.current > 4) duration = Math.min(duration, 3000);
      
      const timeoutId = setTimeout(() => {
        setActiveNotifications(prev => prev.filter(item => item.id !== notifId));
        activeTimeouts.current = activeTimeouts.current.filter(id => id !== timeoutId);
      }, duration);
      
      activeTimeouts.current.push(timeoutId);
      
      // Xử lý thông báo tiếp theo với delay ngắn hơn
      const nextProcessTimeoutId = setTimeout(() => {
        processingQueue.current = false;
        processNotificationQueue();
        activeTimeouts.current = activeTimeouts.current.filter(id => id !== nextProcessTimeoutId);
      }, 50); // Giảm xuống 50ms
      
      activeTimeouts.current.push(nextProcessTimeoutId);
    } else {
      processingQueue.current = false;
    }
  }, [user?.house, extractCriteriaAndLevel, getNotificationHash, createId, getDurationByType]);

  // Handle manual close
  const handleClose = useCallback((id) => {
    setActiveNotifications(prev => prev.filter(item => item.id !== id));
  }, []);
  
  // Responsive check
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  if (activeNotifications.length === 0) return null;
  
  // Sử dụng Chakra từ namespace thay vì import trực tiếp
  const { Stack, Fade, Box, Text, Badge, CloseButton, Image, Flex } = Chakra;
  
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
      {activeNotifications.map(notification => (
        <Fade key={notification.id} in={true} unmountOnExit>
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
                className={notification.priority === 'high' ? 'high-priority-badge' : ''}
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
              {/* Point change visualization */}
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
                    
                    {/* Point change glow effect */}
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
              
              {/* Message with styling */}
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
                      <Text as="span">
                        {Math.abs(notification.pointsChange)} points {notification.pointsChange > 0 ? 'awarded to' : 'deducted from'} {notification.house || 'unknown'}
                      </Text>
                      
                      {notification.reason && (
                        <Text 
                          as="span" 
                          color={notification.pointsChange > 0 ? "yellow.300" : "orange.300"}
                          fontWeight="bold"
                        >
                          : {notification.reason}
                        </Text>
                      )}
                    </>
                  )}
                  
                  {!notification.pointsChange && notification.message}
                </Text>
              </Box>
              
              {/* Details section */}
              {(notification.reason || notification.criteria || notification.level) && (
                <Box 
                  borderRadius="md"
                  overflow="hidden"
                  className="details-scroll"
                  border="1px solid rgba(255,255,255,0.3)"
                  boxShadow="0 5px 15px rgba(0,0,0,0.2)"
                  mb={3}
                >
                  {/* Reason section */}
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
                  
                  {/* Criteria section */}
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
                          <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{standardizeCriteria(notification.criteria)}</Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                  
                  {/* Level section */}
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
                            {standardizeLevel(notification.level)}
                          </Text>
                        </Box>
                      </Flex>
                    </Box>
                  )}
                </Box>
              )}
              
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
          </Box>
        </Fade>
      ))}
      
      {/* CSS for animations with optimized performance */}
      <style jsx global>{`
        @keyframes pop-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .notification-panel {
          animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-origin: center center;
          will-change: transform, opacity;
        }
        
        @keyframes points-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); text-shadow: 0 0 15px rgba(0,0,0,0.8); }
        }
        
        .points-text-animation {
          animation: points-pulse 1.5s ease-in-out infinite;
          will-change: transform;
        }
        
        .point-glow-positive {
          box-shadow: 0 0 15px rgba(46, 204, 113, 0.7);
          animation: glow-positive 2s ease-in-out infinite;
          will-change: box-shadow;
        }
        
        @keyframes glow-positive {
          0%, 100% { box-shadow: 0 0 15px rgba(46, 204, 113, 0.7); }
          50% { box-shadow: 0 0 25px rgba(46, 204, 113, 1); }
        }
        
        .point-glow-negative {
          box-shadow: 0 0 15px rgba(231, 76, 60, 0.7);
          animation: glow-negative 2s ease-in-out infinite;
          will-change: box-shadow;
        }
        
        @keyframes glow-negative {
          0%, 100% { box-shadow: 0 0 15px rgba(231, 76, 60, 0.7); }
          50% { box-shadow: 0 0 25px rgba(231, 76, 60, 1); }
        }
        
        .image-container {
          position: relative;
          transform-origin: center center;
          animation: container-float 3s ease-in-out infinite;
          will-change: transform;
        }
        
        @keyframes container-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .increase-animation {
          filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7));
          animation: increase-image-animation 3s ease-in-out infinite;
          will-change: filter, transform;
        }
        
        @keyframes increase-image-animation {
          0% { filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7)); transform: rotate(-2deg) scale(1); }
          50% { filter: drop-shadow(0 0 25px rgba(46, 204, 113, 1)); transform: rotate(2deg) scale(1.1); }
          100% { filter: drop-shadow(0 0 10px rgba(46, 204, 113, 0.7)); transform: rotate(-2deg) scale(1); }
        }
        
        .decrease-animation {
          filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7));
          animation: decrease-image-animation 3s ease-in-out infinite;
          will-change: filter, transform;
        }
        
        @keyframes decrease-image-animation {
          0% { filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7)); transform: rotate(2deg) scale(1); }
          50% { filter: drop-shadow(0 0 25px rgba(231, 76, 60, 1)); transform: rotate(-2deg) scale(1.1); }
          100% { filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.7)); transform: rotate(2deg) scale(1); }
        }
        
        .high-priority-badge {
          animation: pulse-badge 2s infinite;
        }
        
        @keyframes pulse-badge {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
          50% { box-shadow: 0 0 0 5px rgba(255, 255, 255, 0); }
        }
      `}</style>
    </Stack>
  );
};

export default React.memo(NotificationDisplay);