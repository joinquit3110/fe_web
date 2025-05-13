import React, { useState, useEffect } from 'react';
import NotificationItem from './NotificationItem';
import './Notifications.css';

/**
 * Component hiển thị thông báo dạng toast ngắn gọn
 */
const NotificationToast = ({ notification, onClose, autoCloseTime = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Hiệu ứng hiển thị và tự động đóng
  useEffect(() => {
    if (!notification) return;
    
    // Hiệu ứng hiển thị
    setIsVisible(true);
    
    // Đặt timer tự động đóng
    const timer = setTimeout(() => {
      setIsVisible(false);
      
      // Gọi callback sau khi animation kết thúc
      setTimeout(() => {
        if (onClose) onClose();
      }, 300); // Thời gian của animation fade-out
    }, autoCloseTime);
    
    return () => clearTimeout(timer);
  }, [notification, onClose, autoCloseTime]);
  
  if (!notification) return null;
  
  return (
    <div className={`notification-toast ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="notification-toast-content">
        <NotificationItem notification={notification} />
        <button className="notification-close" onClick={() => setIsVisible(false)}>
          &times;
        </button>
      </div>
    </div>
  );
};

export default NotificationToast; 