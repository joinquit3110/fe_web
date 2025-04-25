import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// Backend URL for socket connection
const SOCKET_URL = "https://be-web-6c4k.onrender.com";

// Create context
const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('good'); // 'good', 'poor', 'disconnected'
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const { user, isAuthenticated, setUser } = useAuth();
  
  // Track recent notification keys to prevent duplicates
  const recentNotifications = useRef(new Set());
  
  // Buffer để lưu trữ thông báo khi offline
  const offlineBuffer = useRef([]);
  
  // Sử dụng useRef để lưu trữ giá trị không gây re-render
  const connectionAttempts = useRef(0);
  const reconnectionTimer = useRef(null);
  const lastActivity = useRef(Date.now());

  // Add admin checking functionality
  const isAdminUser = useRef(false);

  // Check if current user is admin when user changes
  useEffect(() => {
    if (user) {
      // Admin can be determined by house, role or username
      const ADMIN_USERS = ['hungpro', 'vipro'];
      isAdminUser.current = 
        user.house === 'admin' || 
        user.role === 'admin' || 
        user.isAdmin === true ||
        ADMIN_USERS.includes(user.username);
      
      console.log(`[SOCKET] User ${user.username} is${isAdminUser.current ? '' : ' not'} an admin`);
    } else {
      isAdminUser.current = false;
    }
  }, [user]);

  // Cleanup old notification keys periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      recentNotifications.current = new Set();
    }, 30000); // Giảm thời gian từ 60000ms xuống 30000ms để dọn dẹp nhanh hơn
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // Thêm listener cho kết nối internet
  useEffect(() => {
    const handleOnlineStatus = () => {
      if (navigator.onLine) {
        console.log('[SOCKET] Browser is online');
        // Thử kết nối lại socket nếu không còn kết nối
        if (socket && !isConnected) {
          socket.connect();
        }
        // Xử lý buffer khi có kết nối trở lại
        processOfflineBuffer();
      } else {
        console.log('[SOCKET] Browser is offline');
        setConnectionQuality('disconnected');
      }
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [socket, isConnected]);
  
  // Hàm xử lý buffer offline
  const processOfflineBuffer = useCallback(() => {
    if (offlineBuffer.current.length > 0 && socket && isConnected) {
      console.log(`[SOCKET] Processing offline buffer: ${offlineBuffer.current.length} items`);
      
      // Xử lý từng item trong buffer
      offlineBuffer.current.forEach(item => {
        if (item.type === 'emit') {
          socket.emit(item.event, item.data);
        }
      });
      
      // Xóa buffer
      offlineBuffer.current = [];
    }
  }, [socket, isConnected]);

  // Initialize socket on authentication state change with improved connection settings
  useEffect(() => {
    // Only initialize socket if user is authenticated
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setConnectionQuality('disconnected');
      }
      return;
    }
    
    console.log('[SOCKET] Initializing socket connection');
    
    // Create new socket instance with optimized connection settings
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Ưu tiên websocket trước
      reconnection: true,
      reconnectionAttempts: 15,             // Tăng số lần thử lại
      reconnectionDelay: 300,               // Giảm delay ban đầu
      reconnectionDelayMax: 2000,           // Giảm delay tối đa
      timeout: 3000,                        // Giảm timeout
      forceNew: true,                       // Force kết nối mới
      autoConnect: true,                    // Tự động kết nối
      upgrade: true,                        // Cho phép upgrade kết nối
      withCredentials: true                 // Hỗ trợ xác thực khi cần
    });
    
    // Set up event handlers
    socketInstance.on('connect', () => {
      console.log('[SOCKET] Connected to server');
      setIsConnected(true);
      setConnectionQuality('good');
      connectionAttempts.current = 0;
      
      // Authenticate with user ID and house
      if (user) {
        socketInstance.emit('authenticate', {
          userId: user.id || user._id,
          username: user.username,
          house: user.house,
          timestamp: Date.now() // Thêm timestamp để tránh cache
        });
        console.log(`[SOCKET] Authenticated as ${user.username}, house: ${user.house || 'unassigned'}`);
      }
      
      // Xử lý buffer khi kết nối thành công
      processOfflineBuffer();
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error);
      setIsConnected(false);
      setConnectionQuality('poor');
      
      // Tăng thời gian thử kết nối lại theo cấp số nhân
      connectionAttempts.current += 1;
      const delay = Math.min(1000 * Math.pow(1.5, connectionAttempts.current - 1), 10000);
      
      // Xóa timer cũ nếu có
      if (reconnectionTimer.current) {
        clearTimeout(reconnectionTimer.current);
      }
      
      // Đặt timer mới
      reconnectionTimer.current = setTimeout(() => {
        if (navigator.onLine && !socketInstance.connected) {
          console.log(`[SOCKET] Attempting reconnection #${connectionAttempts.current}`);
          socketInstance.connect();
        }
      }, delay);
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      setIsConnected(false);
      
      // Chỉ đặt quality là disconnected nếu là client disconnect
      if (reason === 'io client disconnect') {
        setConnectionQuality('disconnected');
      } else {
        setConnectionQuality('poor');
        
        // Thử kết nối lại nhanh nếu là lỗi mạng
        if (reason === 'transport close' || reason === 'transport error') {
          setTimeout(() => {
            if (navigator.onLine) {
              console.log('[SOCKET] Quick reconnect attempt after transport issue');
              socketInstance.connect();
            }
          }, 500);
        }
      }
    });
    
    socketInstance.on('reconnect', (attempt) => {
      console.log(`[SOCKET] Reconnected after ${attempt} attempts`);
      setIsConnected(true);
      setConnectionQuality('good');
      connectionAttempts.current = 0;
      
      // Re-authenticate on reconnect
      if (user) {
        socketInstance.emit('authenticate', {
          userId: user.id || user._id,
          username: user.username,
          house: user.house,
          timestamp: Date.now() // Thêm timestamp để tránh cache
        });
      }
      
      // Request a sync after reconnection - sử dụng setTimeout để đảm bảo server xử lý authenticate trước
      setTimeout(() => {
        if (socketInstance.connected) {
          console.log('[SOCKET] Requesting sync after reconnection');
          socketInstance.emit('request_sync', { fullSync: true });
        }
      }, 300);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('[SOCKET] Reconnection error:', error);
      setConnectionQuality('poor');
    });

    socketInstance.on('reconnect_failed', () => {
      console.log('[SOCKET] Failed to reconnect');
      setIsConnected(false);
      setConnectionQuality('disconnected');
      
      // Sử dụng polling nếu websocket không thành công
      console.log('[SOCKET] Falling back to polling transport');
      socketInstance.io.opts.transports = ['polling', 'websocket'];
    });
    
    // Handle connection status updates
    socketInstance.on('connection_status', (data) => {
      console.log('[SOCKET] Connection status update:', data);
      if (data.connected) {
        setIsConnected(true);
        setConnectionQuality(data.quality || 'good');
      }
    });
    
    // Thêm xử lý ping-pong để đo delay
    socketInstance.on('pong', (latency) => {
      // latency là thời gian trễ tính bằng ms
      const connectionQual = latency < 100 ? 'excellent' : 
                            latency < 300 ? 'good' : 
                            latency < 600 ? 'fair' : 'poor';
      setConnectionQuality(connectionQual);
      console.log(`[SOCKET] Latency: ${latency}ms, quality: ${connectionQual}`);
    });

    // Set the socket instance
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('[SOCKET] Cleaning up socket connection');
      if (reconnectionTimer.current) {
        clearTimeout(reconnectionTimer.current);
      }
      if (socketInstance) {
        socketInstance.disconnect();
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, user, processOfflineBuffer]);
  
  // Implement heartbeat mechanism with latency check
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Gửi heartbeat và kiểm tra độ trễ
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        // Ghi nhận thời gian gửi
        const start = Date.now();
        
        // Gửi heartbeat và nhận pong từ server
        socket.emit('heartbeat', {}, () => {
          // Callback này được gọi khi server phản hồi
          const latency = Date.now() - start;
          const connectionQual = latency < 100 ? 'excellent' : 
                                latency < 300 ? 'good' : 
                                latency < 600 ? 'fair' : 'poor';
          setConnectionQuality(connectionQual);
          setLastHeartbeat(new Date());
          lastActivity.current = Date.now();
        });
      }
    }, 20000); // Giảm từ 30000ms xuống 20000ms (20s)
    
    // Thêm ping định kỳ để đo độ trễ
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('ping_server', {}, () => {
          const latency = Date.now() - start;
          const connectionQual = latency < 100 ? 'excellent' : 
                                latency < 300 ? 'good' : 
                                latency < 600 ? 'fair' : 'poor';
          setConnectionQuality(connectionQual);
          lastActivity.current = Date.now();
        });
      }
    }, 8000); // Thực hiện ping mỗi 8s
    
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(pingInterval);
    };
  }, [socket, isConnected]);
  
  // Request sync when user's house changes
  useEffect(() => {
    if (socket && isConnected && user?.house) {
      // When house changes, update socket room
      socket.emit('change_house', {
        userId: user.id || user._id,
        oldHouse: user.previousHouse !== user.house ? user.previousHouse : null,
        newHouse: user.house,
        timestamp: Date.now() // Thêm timestamp để đảm bảo thực hiện ngay
      });
    }
  }, [socket, isConnected, user?.house]);

  // Enhanced real-time notification processor with priority handling
  useEffect(() => {
    if (!socket) return;

    // Process notifications more efficiently with immediate delivery
    socket.on('sync_update', (data) => {
      console.log('[SOCKET] Received sync update:', data);
      setLastMessage({ type: 'sync_update', data, timestamp: new Date() });
      lastActivity.current = Date.now();
      
      // Các thông báo quan trọng được xử lý ưu tiên
      const isPriorityUpdate = data.type === 'user_update' || 
                              data.type === 'force_sync' || 
                              data.priority === 'high';
      
      // Enhanced user update handling with immediate effect
      if (data.type === 'user_update' && data.data?.updatedFields) {
        const updatedFields = data.data.updatedFields;
        
        // If house was updated, update the user object immediately
        if (updatedFields.house && user && setUser) {
          console.log(`[SOCKET] House updated from server: ${updatedFields.house}`);
          
          try {
            // Cập nhật user ngay lập tức, không cần đợi re-render
            const prevHouse = user.house;
            const updatedUser = {
              ...user,
              previousHouse: prevHouse,
              house: updatedFields.house
            };
            
            // Lưu vào localStorage trước để đảm bảo dữ liệu được lưu khi refresh
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // Sau đó cập nhật state để UI cập nhật
            setUser(updatedUser);
            
            // Phát sự kiện để các component khác cũng cập nhật
            window.dispatchEvent(new CustomEvent('userHouseChanged', {
              detail: { 
                house: updatedFields.house, 
                previous: prevHouse,
                immediate: true,
                timestamp: Date.now()
              }
            }));
          } catch (error) {
            console.error('[SOCKET] Error updating user house:', error);
          }
          
          // Add notification about house change - dùng requestAnimationFrame để đồng bộ với render cycle
          requestAnimationFrame(() => {
            setNotifications(prev => [
              {
                id: Date.now(),
                type: 'info',
                message: `Your house has been updated to ${updatedFields.house}`,
                timestamp: new Date(),
                priority: 'high' // Đánh dấu ưu tiên cao
              },
              ...prev.slice(0, 9)
            ]);
          });
        }
        
        // If magic points were updated, handle with high priority
        if (updatedFields.magicPoints !== undefined) {
          const newPoints = parseInt(updatedFields.magicPoints, 10);
          const prevPoints = user?.magicPoints || parseInt(localStorage.getItem('magicPoints') || '100', 10);
          const diff = newPoints - prevPoints;
          const isReset = updatedFields.lastUpdateReason === 'Points reset by admin';
          const changeDirection = diff > 0 ? 'increased by' : 'decreased by';
          
          if (!isNaN(newPoints)) {
            console.log(`[SOCKET] Magic points updated from server: ${newPoints} (change: ${diff}, isReset: ${isReset})`);
            
            // Lưu vào localStorage trước
            localStorage.setItem('magicPoints', newPoints.toString());
            
            // Update user object với magicPoints mới
            if (user && setUser) {
              const updatedUser = {
                ...user,
                magicPoints: newPoints
              };
              
              localStorage.setItem('user', JSON.stringify(updatedUser));
              setUser(updatedUser);
            }
            
            // Kích hoạt sự kiện ngay lập tức
            window.dispatchEvent(new CustomEvent('magicPointsUpdated', {
              detail: { 
                points: newPoints,
                previousPoints: prevPoints,
                source: 'serverSync',
                immediate: true,
                isReset: isReset,
                timestamp: Date.now()
              }
            }));
            
            // Add notification - dùng requestAnimationFrame để cải thiện performance
            requestAnimationFrame(() => {
              setNotifications(prev => [
                {
                  id: Date.now(),
                  type: isReset ? 'warning' : (diff >= 0 ? 'success' : 'warning'),
                  message: isReset 
                    ? `Your magic points have been RESET to 100 by admin!`
                    : (diff !== 0 
                    ? `Your magic points have been ${changeDirection} ${Math.abs(diff)}`
                      : `Your magic points have been updated to ${newPoints}`),
                  timestamp: new Date(),
                  pointsChange: diff,
                  priority: 'high'
                },
                ...prev.slice(0, 9)
              ]);
            });
          }
        }
      }
      
      // Handle force_sync with priority
      if (data.type === 'force_sync') {
        // Kích hoạt sự kiện sync ngay lập tức
        window.dispatchEvent(new CustomEvent('forceSyncRequested', {
          detail: {
            source: 'server',
            reason: data.message || 'Admin requested sync',
            timestamp: Date.now()
          }
        }));
      }
    });
    
    // Optimize house_points_update handling with immediate update
    socket.on('house_points_update', (data) => {
      console.log('[SOCKET] Received house points update:', data);
      setLastMessage({ type: 'house_points_update', data, timestamp: new Date() });
      lastActivity.current = Date.now();
      
      // Skip cho các user không liên quan
      if (isAdminUser.current || user?.house === 'muggle' || !user?.house) {
        return;
      }
      
      // Add house points notification cho user phù hợp
      if (data.house === user?.house) {
        const pointsChange = data.points;
        const isPositive = pointsChange > 0;
        const uniqueId = `house_points_${data.house}_${pointsChange}_${data.timestamp || Date.now()}`;
        const dedupeKey = `${data.house}:${pointsChange}:${data.criteria || ''}:${data.level || ''}`;
        
        // Lấy dữ liệu kèm theo
        const criteria = data.criteria || null;
        const level = data.level || null;
        const reason = data.reason || 'Admin action';
        
        // Skip duplicate notifications
        if (recentNotifications.current.has(dedupeKey)) {
          return;
        }
        
        // Mark as seen
        recentNotifications.current.add(dedupeKey);
        
        // Format message
        let fullMessage = `House ${data.house} has ${isPositive ? 'gained' : 'lost'} ${Math.abs(pointsChange)} points! New total: ${data.newTotal}`;
        if (criteria) fullMessage += `. Criteria: ${criteria}`;
        if (level) fullMessage += `. Level: ${level}`;
        if (reason && reason !== 'Admin action') fullMessage += `. Reason: ${reason}`;
        
        // Kích hoạt sự kiện ngay, trước cả khi update UI
        window.dispatchEvent(new CustomEvent('housePointsUpdated', {
          detail: {
            house: data.house,
            points: pointsChange,
            newTotal: data.newTotal,
            reason,
            criteria,
            level,
            timestamp: data.timestamp || new Date().toISOString(),
            uniqueKey: dedupeKey,
            immediate: true
          }
        }));
        
        // Add notification - dùng requestAnimationFrame để tối ưu hóa render
        requestAnimationFrame(() => {
          setNotifications(prev => {
            // Skip nếu đã có thông báo tương tự
            const similarExists = prev.some(n => 
              n.source === 'house_points_update' &&
              n.pointsChange === pointsChange &&
              n.criteria === criteria &&
              n.level === level &&
              (Date.now() - new Date(n.timestamp).getTime()) < 10000 // Giảm xuống 10 giây
            );
            
            if (similarExists) return prev;
            
            return [
              {
                id: uniqueId,
                type: isPositive ? 'success' : 'warning',
                title: isPositive ? 'POINTS AWARDED!' : 'POINTS DEDUCTED!',
                message: fullMessage,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                pointsChange,
                reason,
                criteria,
                level,
                source: 'house_points_update',
                house: data.house,
                priority: 'high' // Đánh dấu ưu tiên cao
              },
              ...prev.slice(0, 9)
            ];
          });
        });
      }
    });
    
    // Optimize admin_notification handling
    socket.on('admin_notification', (data) => {
      console.log('[SOCKET] Received admin notification:', data);
      setLastMessage({ type: 'admin_notification', data, timestamp: new Date() });
      lastActivity.current = Date.now();
      
      // Skip if this notification should skip admins and the current user is an admin
      if ((data.skipAdmin === true || data.skipAdmin === "true") && isAdminUser.current) {
        return;
      }
      
      // Kích hoạt event ngay lập tức
      window.dispatchEvent(new CustomEvent('adminNotification', {
        detail: {
          ...data,
          received: Date.now()
        }
      }));
      
      // Add notification sử dụng requestAnimationFrame
      requestAnimationFrame(() => {
        setNotifications(prev => [
          {
            id: Date.now(),
            type: data.notificationType || 'info',
            message: data.message,
            timestamp: new Date(),
            priority: data.priority || 'medium'
          },
          ...prev.slice(0, 9)
        ]);
      });
    });
    
    // Handle global announcements
    socket.on('global_announcement', (data) => {
      console.log('[SOCKET] Received global announcement:', data);
      setLastMessage({ type: 'global_announcement', data, timestamp: new Date() });
      lastActivity.current = Date.now();
      
      // Kích hoạt event
      window.dispatchEvent(new CustomEvent('globalAnnouncement', {
        detail: data
      }));
      
      // Add announcement - dùng requestAnimationFrame
      requestAnimationFrame(() => {
        setNotifications(prev => [
          {
            id: Date.now(), 
            type: 'announcement',
            message: `ANNOUNCEMENT: ${data.message}`,
            timestamp: new Date(),
            priority: 'high'
          },
          ...prev.slice(0, 9)
        ]);
      });
    });

    return () => {
      // Clean up all listeners
      socket.off('sync_update');
      socket.off('house_points_update');
      socket.off('admin_notification');
      socket.off('global_announcement');
      socket.off('pong');
    };
  }, [socket, user, setUser]);

  // Method to send a message to the server with offline support
  const sendMessage = useCallback((eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
      lastActivity.current = Date.now();
      return true;
    } else {
      // Store in offline buffer when not connected
      console.log(`[SOCKET] Not connected, storing in offline buffer: ${eventName}`);
      offlineBuffer.current.push({
        type: 'emit',
        event: eventName,
        data: data,
        timestamp: Date.now()
      });
      return false;
    }
  }, [socket, isConnected]);

  // Method to request an immediate sync from server with priority
  const requestSync = useCallback(() => {
    if (socket && isConnected) {
      console.log('[SOCKET] Manually requesting data sync');
      socket.emit('request_sync', {
        timestamp: Date.now(),
        priority: 'high'
      });
      lastActivity.current = Date.now();
      return true;
    }
    
    console.log('[SOCKET] Cannot request sync - not connected');
    // Store in offline buffer
    offlineBuffer.current.push({
      type: 'emit',
      event: 'request_sync',
      data: { timestamp: Date.now(), priority: 'high' },
      timestamp: Date.now()
    });
    return false;
  }, [socket, isConnected]);

  // Method to clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Method to remove a specific notification with animation
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionQuality,
        lastMessage,
        notifications,
        lastHeartbeat,
        sendMessage,
        requestSync,
        clearNotifications,
        removeNotification
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};