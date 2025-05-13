import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import './Notifications.css';

/**
 * Enhanced NotificationManager that shows fullscreen magical notifications
 */
const NotificationManager = ({ children }) => {
  const { socket } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeNotification, setActiveNotification] = useState(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const increasePointImageRef = useRef(null);
  const decreasePointImageRef = useRef(null);
  
  // Preload images for faster display
  useEffect(() => {
    // Create image elements for preloading
    increasePointImageRef.current = new Image();
    decreasePointImageRef.current = new Image();
    
    // Set sources to start preloading
    increasePointImageRef.current.src = "/assets/images/IncreasePoint.png";
    decreasePointImageRef.current.src = "/assets/images/DecreasePoint.png";
    
    console.log("Preloading notification images...");
  }, []);
  
  // Vibration helper function for mobile devices
  const vibrateDevice = useCallback((pattern = [200, 100, 200]) => {
    // Check if vibration API is supported
    if (navigator && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(pattern);
        console.log("Device vibration activated");
      } catch (error) {
        console.log("Vibration failed:", error);
      }
    } else {
      console.log("Vibration API not supported on this device");
    }
  }, []);
  
  // Process the notification queue
  useEffect(() => {
    if (notifications.length > 0 && !activeNotification) {
      // Take the first notification from the queue
      const nextNotification = notifications[0];
      setActiveNotification(nextNotification);
      setIsNotificationVisible(true);
      
      // Vibrate the device for mobile users
      vibrateDevice();
      
      // Auto-dismiss after the specified time
      const dismissalTime = getDismissalTime(nextNotification.type);
      const timer = setTimeout(() => {
        setIsNotificationVisible(false);
        
        // Wait for animation to complete before removing from queue
        setTimeout(() => {
          setActiveNotification(null);
          setNotifications(prev => prev.slice(1));
        }, 500); // Match the transition duration in CSS
      }, dismissalTime);
      
      return () => clearTimeout(timer);
    }
  }, [notifications, activeNotification, vibrateDevice]);
  
  // Get the appropriate dismissal time based on notification type
  const getDismissalTime = (type) => {
    switch (type) {
      case 'success': return 5000;
      case 'warning': return 6000;
      case 'error': return 7000;
      case 'announcement': return 8000;
      default: return 5000;
    }
  };
  
  // Handle incoming notifications from socket
  useEffect(() => {
    if (!socket) return;
    
    const handleNotification = (notification) => {
      console.log('Received notification:', notification);
      
      // Ensure notification has an ID
      if (!notification.id) {
        notification.id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Check if notification is for user's house
      if (notification.housesAffected && notification.housesAffected.length > 0) {
        if (!user?.house || !notification.housesAffected.includes(user.house)) {
          console.log('Notification not for this user house, ignoring');
          return;
        }
      }
      
      // Add notification to queue
      setNotifications(prev => [...prev, notification]);
      
      // Vibrate the device on new notification
      vibrateDevice();
    };
    
    // Listen for various notification events
    socket.on('notification', handleNotification);
    socket.on('house_points_update', handleNotification);
    socket.on('admin_notification', handleNotification);
    
    return () => {
      // Cleanup on unmount
      socket.off('notification', handleNotification);
      socket.off('house_points_update', handleNotification);
      socket.off('admin_notification', handleNotification);
    };
  }, [socket, user, vibrateDevice]);
  
  // Force dismiss the current notification
  const dismissNotification = useCallback(() => {
    setIsNotificationVisible(false);
    
    setTimeout(() => {
      setActiveNotification(null);
      setNotifications(prev => prev.slice(1));
    }, 500);
  }, []);
  
  // Get notification background class based on type
  const getBackgroundClass = (type) => {
    switch (type) {
      case 'success': return 'success-notification';
      case 'warning': return 'warning-notification';
      case 'error': return 'error-notification';
      case 'announcement': return 'announcement-notification';
      default: return 'info-notification';
    }
  };
  
  // Render appropriate icon based on notification type
  const renderIcon = (notification) => {
    // If it's a house points notification, use appropriate image
    if (notification.isHousePointsUpdate || notification.type === 'house_points') {
      // Check if points are awarded (positive value)
      const pointsValue = notification.points || notification.pointsChange || 0;
      const isPointsAwarded = pointsValue > 0;
      
      console.log('Point notification details:', { 
        points: notification.points,
        pointsChange: notification.pointsChange,
        isPointsAwarded: isPointsAwarded
      });
      
      // IMPORTANT: We found that only DecreasePoint.png exists in the assets folder
      // Using the same image for both cases as a temporary solution until IncreasePoint.png is added
      const imageUrl = "/assets/images/DecreasePoint.png";
        
      return (
        <div className="magical-notification-banner">
          <img 
            src={imageUrl}
            alt={isPointsAwarded ? "Points awarded" : "Points deducted"}
            className={`magical-banner-image ${isPointsAwarded ? 'increase-points' : 'decrease-points'}`}
            onError={(e) => {
              console.error(`Failed to load image: ${e.target.src}`);
              // Fallback icon if image doesn't load
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'block';
            }}
          />
          <div className="fallback-icon" style={{ display: 'none' }}>
            {isPointsAwarded ? '⬆️' : '⬇️'}
          </div>
        </div>
      );
    }
    
    // Default icons for other notification types
    switch (notification.type) {
      case 'success': return <div className="magical-notification-icon">✨</div>;
      case 'warning': return <div className="magical-notification-icon">⚠️</div>;
      case 'error': return <div className="magical-notification-icon">💫</div>;
      case 'announcement': return <div className="magical-notification-icon">📣</div>;
      default: return <div className="magical-notification-icon">📜</div>;
    }
  };
  
  // Only render the notification system if the user is authenticated
  if (!isAuthenticated || !user || !user.id) {
    // If not authenticated, just render children without the notification UI
    return children || null;
  }
  
  return (
    <div className="hogwarts-notification-manager">
      {/* Children components */}
      {children}
      
      {/* Hidden preload elements */}
      <div style={{ display: 'none' }}>
        <img src="/assets/images/IncreasePoint.png" alt="Preload increase points" />
        <img src="/assets/images/DecreasePoint.png" alt="Preload decrease points" />
      </div>
      
      {/* Magical fullscreen notification */}
      {activeNotification && (
        <div 
          className={`magical-notification ${getBackgroundClass(activeNotification.type)} ${isNotificationVisible ? 'visible' : 'hidden'}`}
          onClick={dismissNotification}
        >
          <div className="magical-notification-content">
            {renderIcon(activeNotification)}
            
            <div className="magical-notification-text">
              <h3 className="magical-notification-title">
                {activeNotification.title || 
                  (activeNotification.type === 'success' ? 'Spell Successful!' : 
                   activeNotification.type === 'warning' ? 'Caution, Wizard!' : 
                   activeNotification.type === 'error' ? 'Magical Mishap!' : 
                   'Magical Notice')}
              </h3>
              <p className="magical-notification-message">{activeNotification.message}</p>
              
              {/* Display house info if applicable */}
              {activeNotification.house && (
                <div className="magical-notification-house">
                  <span className={`house-badge ${activeNotification.house.toLowerCase()}`}>
                    {activeNotification.house}
                  </span>
                </div>
              )}
              
              {/* Display interactive metadata cards */}
              <div className="magical-notification-metadata-container">
                {/* Points card */}
                {(activeNotification.points || activeNotification.pointsChange) && (
                  <div className="magical-metadata-card points-card">
                    <div className="metadata-card-header">
                      <div className="metadata-card-icon">⚡</div>
                      <span className="metadata-card-title">Points</span>
                    </div>
                    <div className="metadata-card-value">
                      {(activeNotification.points || activeNotification.pointsChange) > 0 ? '+' : ''}
                      {activeNotification.points || activeNotification.pointsChange}
                    </div>
                  </div>
                )}
                
                {/* Reason card */}
                {activeNotification.reason && (
                  <div className="magical-metadata-card reason-card">
                    <div className="metadata-card-header">
                      <div className="metadata-card-icon">📜</div>
                      <span className="metadata-card-title">Reason</span>
                    </div>
                    <div className="metadata-card-value">
                      {activeNotification.reason}
                    </div>
                  </div>
                )}
                
                {/* Criteria card */}
                {activeNotification.criteria && (
                  <div className="magical-metadata-card criteria-card">
                    <div className="metadata-card-header">
                      <div className="metadata-card-icon">🔍</div>
                      <span className="metadata-card-title">Criteria</span>
                    </div>
                    <div className="metadata-card-value">
                      {activeNotification.criteria}
                    </div>
                  </div>
                )}
                
                {/* Level card */}
                {activeNotification.level && (
                  <div className="magical-metadata-card level-card">
                    <div className="metadata-card-header">
                      <div className="metadata-card-icon">🪄</div>
                      <span className="metadata-card-title">Level</span>
                    </div>
                    <div className="metadata-card-value">
                      {activeNotification.level}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Magical particles overlay */}
          <div className="magical-particles">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="magical-particle" style={{
                animationDelay: `${Math.random() * 2}s`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }} />
            ))}
          </div>

          {/* Close button */}
          <div className="magical-notification-close" onClick={(e) => {
            e.stopPropagation();
            dismissNotification();
          }}>
            ×
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager; 