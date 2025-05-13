import React, { useState, useEffect } from 'react';
import NotificationItem from './NotificationItem';
import './Notifications.css';

/**
 * Component hiển thị một danh sách các thông báo
 */
const NotificationList = ({ notifications = [], onClose }) => {
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  
  // Xử lý thêm thông báo mới vào danh sách
  useEffect(() => {
    if (notifications.length === 0) return;
    
    // Thêm các thông báo mới vào đầu danh sách
    setVisibleNotifications(prev => {
      // Tạo map các ID thông báo hiện tại
      const existingIds = new Set(prev.map(n => n.id));
      
      // Lọc các thông báo mới
      const newNotifications = notifications.filter(n => !existingIds.has(n.id));
      
      // Thêm vào đầu danh sách
      return [...newNotifications, ...prev].slice(0, 10); // Giới hạn 10 thông báo
    });
  }, [notifications]);
  
  // Đóng một thông báo cụ thể
  const handleCloseNotification = (id) => {
    setVisibleNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // Đóng tất cả thông báo
  const handleCloseAll = () => {
    setVisibleNotifications([]);
    if (onClose) onClose();
  };
  
  if (visibleNotifications.length === 0) {
    return null;
  }
  
  return (
    <div className="notification-list-container">
      <div className="notification-list-header">
        <h2>Notifications</h2>
        <button 
          className="notification-close-all"
          onClick={handleCloseAll}
        >
          Clear All
        </button>
      </div>
      
      <div className="notification-list">
        {visibleNotifications.map(notification => (
          <div key={notification.id} className="notification-item-wrapper">
            <NotificationItem notification={notification} />
            <button 
              className="notification-close" 
              onClick={() => handleCloseNotification(notification.id)}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationList; 