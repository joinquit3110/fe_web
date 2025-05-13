import React from 'react';
import './Notifications.css';

/**
 * Component hiển thị thông báo House Points
 */
const HousePointsNotification = ({ notification }) => {
  const { data, display } = notification;
  const { house, isPositive, points, reason, criteria, level } = data || {};
  
  // Fallback nếu không có data (với thông báo cũ)
  const isLegacy = !data;
  const legacyIsPositive = isLegacy ? notification.points > 0 : isPositive;
  const legacyPoints = isLegacy ? Math.abs(notification.points) : points;
  const legacyHouse = isLegacy ? notification.house || house : house;
  const legacyReason = isLegacy ? notification.reason : reason;
  const legacyCriteria = isLegacy ? notification.criteria : criteria;
  const legacyLevel = isLegacy ? notification.level : level;
  
  // Dữ liệu hiển thị
  const displayColor = display?.color || (legacyIsPositive ? "#4CAF50" : "#FF5252");
  const displayBgColor = display?.bgColor || (legacyIsPositive ? "rgba(76, 175, 80, 0.1)" : "rgba(255, 82, 82, 0.1)");
  const displayImage = display?.image || (legacyIsPositive ? "IncreasePoint.png" : "DecreasePoint.png");
  const displayAnimation = display?.animation || (legacyIsPositive ? "fadeInUp" : "shakeX");
  
  // Tên nhà có viết hoa chữ cái đầu
  const houseName = legacyHouse?.charAt(0).toUpperCase() + legacyHouse?.slice(1);
  
  return (
    <div 
      className={`notification house-points-notification ${legacyIsPositive ? 'positive' : 'negative'}`}
      style={{ 
        borderLeftColor: displayColor,
        backgroundColor: displayBgColor,
        animation: `${displayAnimation} 0.5s ease-out`
      }}
    >
      <div className="notification-header" style={{ backgroundColor: displayColor }}>
        <i className={`notification-icon ${legacyIsPositive ? 'fas fa-bolt' : 'fas fa-skull'}`}></i>
        <h3 className="notification-title">{notification.title}</h3>
      </div>
      
      <div className="notification-content">
        <div className="notification-image-container">
          <img 
            src={`/assets/images/${displayImage}`} 
            alt={`${legacyPoints} points`} 
            className="notification-image"
            onError={(e) => {
              // Fallback nếu không tìm thấy hình ảnh
              e.target.style.display = 'none';
            }}
          />
          <span className="points-badge" style={{ backgroundColor: displayColor }}>
            {legacyIsPositive ? '+' : '-'}{legacyPoints}
          </span>
        </div>
        
        <div className="notification-details">
          <p className="notification-message" style={{ color: displayColor }}>
            House {houseName} has {legacyIsPositive ? 'gained' : 'lost'} {legacyPoints} points!
          </p>
          
          {legacyReason && (
            <p className="notification-reason">Reason: {legacyReason}</p>
          )}
          
          <div className="notification-extra">
            {legacyCriteria && (
              <span className="notification-criteria">Criteria: {legacyCriteria}</span>
            )}
            {legacyLevel && (
              <span className="notification-level">Level: {legacyLevel}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Component thông báo mặc định cho các loại thông báo khác
 */
const DefaultNotification = ({ notification }) => {
  // Xác định loại thông báo để hiển thị biểu tượng tương ứng
  const getIconForType = (type) => {
    switch (type) {
      case 'success': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      case 'announcement': return 'fas fa-bullhorn';
      default: return 'fas fa-bell';
    }
  };
  
  // Xác định màu cho loại thông báo
  const getColorForType = (type) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FFC107';
      case 'error': return '#F44336';
      case 'announcement': return '#2196F3';
      default: return '#9C27B0';
    }
  };
  
  const icon = getIconForType(notification.type);
  const color = getColorForType(notification.type);
  
  return (
    <div className="notification default-notification" style={{ borderLeftColor: color }}>
      <div className="notification-header" style={{ backgroundColor: color }}>
        <i className={`notification-icon ${icon}`}></i>
        <h3 className="notification-title">{notification.title || 'Notification'}</h3>
      </div>
      
      <div className="notification-content">
        <p className="notification-message">{notification.message}</p>
        <small className="notification-time">
          {new Date(notification.timestamp).toLocaleTimeString()}
        </small>
      </div>
    </div>
  );
};

/**
 * Component chính xử lý tất cả các loại thông báo
 */
const NotificationItem = ({ notification }) => {
  // Phân loại theo notification.type
  switch (notification.type) {
    case 'house_points':
      return <HousePointsNotification notification={notification} />;
    
    default:
      // Dùng thông báo mặc định cho các loại khác
      return <DefaultNotification notification={notification} />;
  }
};

export default NotificationItem; 