import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import NotificationList from './NotificationList';
import NotificationToast from './NotificationToast';
import './Notifications.css';

/**
 * Component quản lý thông báo từ socket và hiển thị thông báo
 */
const NotificationManager = ({ children }) => {
  const { socket } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [activeToast, setActiveToast] = useState(null);
  
  // Xử lý thông báo từ socket
  useEffect(() => {
    if (!socket) return;
    
    const handleNotification = (notification) => {
      console.log('Received notification:', notification);
      
      // Thêm ID nếu không có
      if (!notification.id) {
        notification.id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Kiểm tra thông báo dành cho nhà của user
      if (notification.housesAffected && notification.housesAffected.length > 0) {
        if (!user.house || !notification.housesAffected.includes(user.house)) {
          console.log('Notification not for this user house, ignoring');
          return; // Bỏ qua thông báo không dành cho nhà của user
        }
      }
      
      // Thêm thông báo mới vào danh sách
      setNotifications(prev => [notification, ...prev].slice(0, 20)); // Giới hạn 20 thông báo
      
      // Show the notification as a toast
      setActiveToast(notification);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setActiveToast(toast => toast?.id === notification.id ? null : toast);
      }, 5000);
    };
    
    // Lắng nghe các sự kiện thông báo
    socket.on('notification', handleNotification);
    socket.on('house_points_update', handleNotification); // Xử lý cả loại thông báo cũ
    socket.on('admin_notification', handleNotification); // Xử lý cả loại thông báo cũ
    
    return () => {
      // Dọn dẹp khi unmount
      socket.off('notification', handleNotification);
      socket.off('house_points_update', handleNotification);
      socket.off('admin_notification', handleNotification);
    };
  }, [socket, user]);
  
  // Hiển thị trung tâm thông báo
  const toggleNotificationCenter = () => {
    setShowNotificationCenter(prev => !prev);
    // Hide any active toast when showing notification center
    if (!showNotificationCenter) {
      setActiveToast(null);
    }
  };
  
  // Xóa tất cả thông báo
  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotificationCenter(false);
    setActiveToast(null);
  };
  
  // Only render the notification system if the user is authenticated
  if (!isAuthenticated || !user || !user.id) {
    // If not authenticated, just render children without the notification UI
    return children || null;
  }
  
  return (
    <div className="notification-manager">
      {/* Children components passed to NotificationManager */}
      {children}
      
      {/* Trung tâm thông báo (hiển thị khi click vào biểu tượng) */}
      {showNotificationCenter && (
        <div className="notification-center-overlay">
          <NotificationList 
            notifications={notifications} 
            onClose={() => setShowNotificationCenter(false)}
          />
        </div>
      )}
      
      {/* Toast thông báo mới nhất */}
      {activeToast && !showNotificationCenter && (
        <div className="notification-toast-container">
          <NotificationToast
            notification={activeToast}
            onClose={() => setActiveToast(null)}
          />
        </div>
      )}
      
      {/* Biểu tượng thông báo */}
      <div className="notification-icon-container" onClick={toggleNotificationCenter}>
        <i className={`notification-bell-icon ${notifications.length > 0 ? 'has-notifications' : ''}`}>
          🔔
        </i>
        {notifications.length > 0 && (
          <span className="notification-count">{Math.min(notifications.length, 9)}</span>
        )}
      </div>
    </div>
  );
};

export default NotificationManager; 