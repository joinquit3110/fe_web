import React, { useState, useRef, useEffect, useCallback } from "react";
import { Flex, Heading, Box, Text, Button, Icon, Image, useToast } from "@chakra-ui/react";
// Add KaTeX for LaTeX rendering
import 'katex/dist/katex.min.css';
import katex from 'katex';
// Import Magic Points components
import { MagicPointsProvider } from '../context/MagicPointsContext';

// Add the CSS animations
const animationsCSS = `
@keyframes shimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes floatBook {
  0%, 100% { transform: translateY(0) rotate(3deg); }
  50% { transform: translateY(-8px) rotate(-3deg); }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
}

@keyframes pop-in {
  0% { transform: scale(0); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes float-text {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes item-appear {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes correct-pulse {
  0% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(46, 125, 50, 0); }
  100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
}

@keyframes incorrect-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

@keyframes notification-slide {
  0% { transform: translateY(-20px); opacity: 0; }
  10% { transform: translateY(0); opacity: 1; }
  90% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-20px); opacity: 0; }
}

@keyframes button-glow {
  0% { box-shadow: 0 0 5px rgba(211, 166, 37, 0.5); }
  50% { box-shadow: 0 0 20px rgba(211, 166, 37, 0.8), 0 0 30px rgba(211, 166, 37, 0.6); }
  100% { box-shadow: 0 0 5px rgba(211, 166, 37, 0.5); }
}

@keyframes reveal-shine {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes word-bank-glow {
  0%, 100% { box-shadow: 0 0 15px rgba(211, 166, 37, 0.3), inset 0 0 20px rgba(211, 166, 37, 0.1); }
  50% { box-shadow: 0 0 25px rgba(211, 166, 37, 0.5), inset 0 0 30px rgba(211, 166, 37, 0.2); }
}

@keyframes floating-stars {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  25% { transform: translateY(-3px) translateX(2px); }
  50% { transform: translateY(0px) translateX(4px); }
  75% { transform: translateY(3px) translateX(2px); }
}

@keyframes word-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes parchment-shine {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}
`;

// Blank component with touch support
const Blank = ({ solution, id, onDrop, value, isCorrect }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    if (onDrop) {
      const data = e.dataTransfer.getData('text/plain');
      onDrop(id, data, e);
    }
  };
  
  const handleDragStart = (e) => {
    if (value) {
      e.dataTransfer.setData('text/plain', value);
      // Add blank ID as metadata
      e.dataTransfer.setData('origin-blank-id', id);
    }
  };
  
  const handleTouchEnter = (e) => {
    e.preventDefault();
    // Add very subtle highlight instead of strong effect
    const target = e.target;
    if (target) {
      target.style.backgroundColor = 'rgba(211, 166, 37, 0.15)';
    }
  };
  
  const handleTouchLeave = (e) => {
    e.preventDefault();
    const target = e.target;
    if (target) {
      target.style.backgroundColor = value ? 'rgba(255, 255, 255, 0.05)' : 'transparent';
    }
  };
  
  const getValidationColor = () => {
    if (isCorrect === null) return 'var(--secondary-color)';
    return isCorrect ? '#2ecc71' : '#e74c3c';
  };
  
  const getValidationBorderColor = () => {
    if (isCorrect === null) return 'rgba(211, 166, 37, 0.7)';
    return isCorrect ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)';
  };
  
  const getValidationIcon = () => {
    if (isCorrect === null) return null;
    return isCorrect ? 
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M9,16.17L4.83,12l-1.42,1.41L9,19 21,7l-1.41-1.41L9,16.17z' fill='%232ecc71'/></svg>" : 
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41z' fill='%23e74c3c'/></svg>";
  };
  
  const getAnimationClass = () => {
    // Remove animations for smoother performance
    return '';
  };
  
  return (
    <span
      data-blank-id={id}
      className={`droppable-blank ${getAnimationClass()}`}
      style={{
        display: 'inline-block',
        minWidth: '100px',
        height: '36px',
        padding: '5px 10px',
        margin: '0 4px',
        background: value ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
        border: `2px solid ${getValidationBorderColor()}`,
        borderRadius: '8px',
        color: getValidationColor(),
        fontWeight: 'bold',
        position: 'relative',
        cursor: value ? 'grab' : 'default',
        textAlign: 'center',
        verticalAlign: 'middle',
        lineHeight: '26px',
        boxShadow: value ? '0 2px 4px rgba(0,0,0,0.25)' : 'none',
        transition: 'all 0.15s ease',
        fontSize: '16px',
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      draggable={!!value}
      onDragStart={handleDragStart}
      onTouchStart={handleTouchEnter}
      onTouchEnd={handleTouchLeave}
    >
      {value || '____'}
      {isCorrect !== null && (
        <span
          style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            width: '20px',
            height: '20px',
            backgroundImage: `url("${getValidationIcon()}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        ></span>
      )}
    </span>
  );
};

// Enhanced separator component
const Separator = () => {
  return (
    <div className="magical-separator" style={{ 
      width: "100%", 
      margin: "20px 0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative"
    }}>
      <div style={{
        height: "2px", 
        background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
        width: "80%",
        position: "relative"
      }}>
        <div style={{
          position: "absolute",
          top: "-8px",
          left: "calc(50% - 10px)",
          width: "20px",
          height: "20px",
          backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M12,2L9.91,4.09L12,6.18L14.09,4.09L12,2M4.09,9.91L2,12L4.09,14.09L6.18,12L4.09,9.91M19.91,9.91L17.82,12L19.91,14.09L22,12L19.91,9.91M12,17.82L9.91,19.91L12,22L14.09,19.91L12,17.82M14.09,9.91L12,7.82L9.91,9.91L12,12L14.09,9.91Z\" fill=\"%23D3A625\"/></svg>')",
          backgroundSize: "contain",
          animation: "spin 6s linear infinite"
        }}></div>
      </div>
    </div>
  );
};

// Dnd component with real drag and drop functionality + mobile support
const Dnd = ({ taskId, title, wrongAnswers, children, onSubmission }) => {
  // For touch events tracking on mobile
  const [draggedItem, setDraggedItem] = useState(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false); // Track active dragging state
  const dragItemRef = useRef(null);
  const notificationContainerRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const [autoScrollDirection, setAutoScrollDirection] = useState(null); // 'up', 'down', or null
  
  // Add state to track first attempt
  const [isFirstAttempt, setIsFirstAttempt] = useState(true);
  
  // State for submission and validation
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [resetMessage, setResetMessage] = useState(false);
  const [fillBlanksMessage, setFillBlanksMessage] = useState(false);
  
  // Functions to handle auto-scrolling
  const startAutoScroll = useCallback((direction) => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }
    
    setAutoScrollDirection(direction);
    
    autoScrollIntervalRef.current = setInterval(() => {
      if (direction === 'up') {
        window.scrollBy(0, -10); // Scroll up by 10px
      } else if (direction === 'down') {
        window.scrollBy(0, 10); // Scroll down by 10px
      }
    }, 16); // ~60fps
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    setAutoScrollDirection(null);
  }, []);

  // Functions to disable/enable scrolling
  const disableScroll = useCallback(() => {
    // Store current body scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Add styles to prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollTop}px`;
    document.body.style.left = '0';
    document.body.style.width = '100%';
    
    // Save scroll position to restore later
    document.body.setAttribute('data-scroll-top', String(scrollTop));
  }, []);
  
  const enableScroll = useCallback(() => {
    // Get saved scroll position
    const scrollTop = parseInt(document.body.getAttribute('data-scroll-top') || '0');
    
    // Remove styles that prevented scrolling
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.width = '';
    
    // Restore scroll position
    window.scrollTo(0, scrollTop);
  }, []);
  
  // Clean up interval and scroll lock on component unmount
  useEffect(() => {
    return () => {
      if (isDragging) {
        enableScroll();
      }
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, [isDragging, enableScroll]);

  // Add drag over handler for body to support auto-scrolling
  useEffect(() => {
    const handleBodyDragOver = (e) => {
      if (!e.dataTransfer.types.includes('text/plain')) {
        return; // Not our drag operation
      }
      
      const scrollThreshold = 60; // pixels from top or bottom of viewport
      const viewportHeight = window.innerHeight;
      
      if (e.clientY < scrollThreshold) {
        // Near the top - scroll up
        if (autoScrollDirection !== 'up') {
          startAutoScroll('up');
        }
      } else if (e.clientY > viewportHeight - scrollThreshold) {
        // Near the bottom - scroll down
        if (autoScrollDirection !== 'down') {
          startAutoScroll('down');
        }
      } else {
        // Not near edges - stop auto-scrolling
        if (autoScrollDirection !== null) {
          stopAutoScroll();
        }
      }
    };
    
    const handleBodyDragEnd = () => {
      stopAutoScroll();
    };
    
    document.body.addEventListener('dragover', handleBodyDragOver);
    document.body.addEventListener('dragend', handleBodyDragEnd);
    document.body.addEventListener('drop', handleBodyDragEnd);
    
    return () => {
      document.body.removeEventListener('dragover', handleBodyDragOver);
      document.body.removeEventListener('dragend', handleBodyDragEnd);
      document.body.removeEventListener('drop', handleBodyDragEnd);
    };
  }, [autoScrollDirection, startAutoScroll, stopAutoScroll]);
  
  // Extract solutions from children
  const blanks = [];
  const extractedChildren = React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return child;
    }
    if (child.type === Blank) {
      const id = `blank-${blanks.length}`;
      blanks.push({ 
        id, 
        solution: child.props.solution,
        value: ""
      });
      return React.cloneElement(child, { id });
    }
    return child;
  });

  // State to track what's in each blank
  const [blankValues, setBlankValues] = useState(
    blanks.reduce((acc, blank) => ({ ...acc, [blank.id]: "" }), {})
  );
  
  // State to track correctness of each blank
  const [blankCorrectness, setBlankCorrectness] = useState(
    blanks.reduce((acc, blank) => ({ ...acc, [blank.id]: null }), {})
  );
  
  // Create word bank items from solutions and wrong answers
  const solutions = blanks.map(blank => 
    Array.isArray(blank.solution) ? blank.solution : [blank.solution]
  ).flat();
  
  const [wordBankItems, setWordBankItems] = useState([
    ...solutions,
    ...wrongAnswers
  ].sort(() => Math.random() - 0.5)); // Randomize the order
  
  // Add notification function
  const showNotification = (message, type = "info") => {
    // Create notification element
    const notification = document.createElement("div");
    let bgColor = "rgba(52, 152, 219, 0.95)"; // info blue
    
    if (type === "success") bgColor = "rgba(46, 204, 113, 0.95)"; // success green
    if (type === "error") bgColor = "rgba(231, 76, 60, 0.95)"; // error red
    if (type === "warning") bgColor = "rgba(241, 196, 15, 0.95)"; // warning yellow
    
    notification.style.backgroundColor = bgColor;
    notification.style.color = "white";
    notification.style.padding = "12px 24px";
    notification.style.borderRadius = "8px";
    notification.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    notification.style.margin = "0 10px";
    notification.style.fontFamily = "'Cinzel', serif";
    notification.style.position = "relative";
    notification.style.animation = "notification-slide 3s forwards";
    notification.style.maxWidth = "80%";
    notification.style.textAlign = "center";
    notification.style.fontWeight = "500";
    notification.style.letterSpacing = "0.5px";
    notification.textContent = message;
    
    // Find container and add notification
    const container = document.getElementById("notification-container");
    if (container) {
      container.appendChild(notification);
      
      // Remove after animation completes
      setTimeout(() => {
        if (container.contains(notification)) {
          container.removeChild(notification);
        }
      }, 3000);
    }
  }
  
  // Handle dropping an item into a blank
  const handleDrop = (blankId, item, e) => {
    // Stop auto-scrolling when dropping
    stopAutoScroll();
    
    // Get the target blank element
    const blankElement = document.querySelector(`[data-blank-id="${blankId}"]`);
    
    // Check if this is coming from another blank
    const sourceBlankId = e?.dataTransfer?.getData("source-blank");
    
    if (sourceBlankId) {
      // Get the item from the source blank
      const draggedItem = blankValues[sourceBlankId];
      
      // Get the source blank element
      const sourceBlankElement = document.querySelector(`[data-blank-id="${sourceBlankId}"]`);
      
      // Clear the source blank
      setBlankValues(prev => ({
        ...prev,
        [sourceBlankId]: ""
      }));
      
      // Reset source blank styling
      if (sourceBlankElement) {
        sourceBlankElement.style.background = "transparent";
        sourceBlankElement.style.border = "2px solid rgba(211, 166, 37, 0.5)";
        
        // Remove any check/x mark
        const mark = sourceBlankElement.querySelector('span[style*="position: absolute"]');
        if (mark) mark.style.display = 'none';
      }
      
      // If dropping on a different blank, fill that blank
      if (sourceBlankId !== blankId) {
        // If the target blank already has content, add it back to the word bank
        const existingValue = blankValues[blankId];
        if (existingValue) {
          setWordBankItems(prev => [...prev, existingValue].sort(() => Math.random() - 0.5));
        }
        
        setBlankValues(prev => ({
          ...prev,
          [blankId]: draggedItem
        }));
        
        // Set target blank styling to yellow (unvalidated)
        if (blankElement) {
          blankElement.style.background = "rgba(211, 166, 37, 0.2)";
          blankElement.style.border = "2px solid var(--secondary-color)";
          
          // Hide any existing check/x mark
          const mark = blankElement.querySelector('span[style*="position: absolute"]');
          if (mark) mark.style.display = 'none';
        }
      } else {
        // If dropping back to the same blank, add to word bank
        setWordBankItems(prev => [...prev, draggedItem].sort(() => Math.random() - 0.5));
      }
      
      // Always reset correctness regardless of submission status
      setBlankCorrectness(prev => ({
        ...prev,
        [sourceBlankId]: null,
        ...(sourceBlankId !== blankId ? { [blankId]: null } : {})
      }));
      
      // Reset submission state
      setIsSubmitted(false);
      
      return;
    }
    
    // Check if this blank already has a value (we'll return it to the word bank)
    const existingValue = blankValues[blankId];
    if (existingValue) {
      setWordBankItems(prev => [...prev, existingValue].sort(() => Math.random() - 0.5));
    }
    
    // Update the blank with the dragged item
    setBlankValues(prev => ({
      ...prev,
      [blankId]: item
    }));
    
    // Always set target blank to yellow state
    if (blankElement) {
      blankElement.style.background = "rgba(211, 166, 37, 0.2)";
      blankElement.style.border = "2px solid var(--secondary-color)";
      
      // Hide any existing check/x mark
      const mark = blankElement.querySelector('span[style*="position: absolute"]');
      if (mark) mark.style.display = 'none';
    }
    
    // Always reset correctness regardless of submission status
    setBlankCorrectness(prev => ({
      ...prev,
      [blankId]: null
    }));
    
    // Reset submission state
    setIsSubmitted(false);
    
    // Remove the item from the word bank
    setWordBankItems(prev => prev.filter(word => word !== item));
  };

  // Handle word bank drop zone
  const handleWordBankDrop = (e) => {
    e.preventDefault();
    const item = e.dataTransfer.getData("text/plain");
    const sourceBlankId = e.dataTransfer.getData("source-blank");
    if (sourceBlankId && item) {
      // Clear the blank
      setBlankValues(prev => ({
        ...prev,
        [sourceBlankId]: ""
      }));
      // Add the item back to the word bank
      setWordBankItems(prev => [...prev, item].sort(() => Math.random() - 0.5));
      // Reset correctness if resubmitting
      if (isSubmitted) {
        setBlankCorrectness(prev => ({
          ...prev,
          [sourceBlankId]: null
        }));
        setIsSubmitted(false);
      }
    }
  };

  // Mobile touch events
  const handleTouchStart = (e, item) => {
    // Prevent scrolling during drag
    e.preventDefault();
    // Store which item is being dragged
    setDraggedItem(item);
    setIsDragging(true);
    disableScroll();
    
    // Create a clone of the dragged element for visual feedback
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    // Create ghost element for dragging
    const ghostElement = document.createElement('div');
    ghostElement.textContent = item;
    ghostElement.style.position = 'fixed';
    ghostElement.style.top = `${touch.clientY - 20}px`;
    ghostElement.style.left = `${touch.clientX - 50}px`;
    ghostElement.style.backgroundColor = 'rgba(20, 23, 46, 0.8)';
    ghostElement.style.color = 'var(--secondary-color)';
    ghostElement.style.padding = '8px 12px';
    ghostElement.style.borderRadius = '12px';
    ghostElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3), 0 0 15px rgba(211, 166, 37, 0.3)';
    ghostElement.style.zIndex = '1000';
    ghostElement.style.pointerEvents = 'none';
    ghostElement.style.fontFamily = "'Cinzel', serif";
    ghostElement.style.border = '1px solid rgba(211, 166, 37, 0.5)';
    ghostElement.id = 'ghost-element';
    document.body.appendChild(ghostElement);
    dragItemRef.current = ghostElement;
  };

  const handleTouchMove = (e) => {
    // Prevent scrolling during drag
    e.preventDefault();
    if (!draggedItem) return;
    
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    
    // Check for auto-scrolling
    const scrollThreshold = 60; // pixels from top or bottom of viewport
    const viewportHeight = window.innerHeight;
    
    if (touch.clientY < scrollThreshold) {
      // Near the top - scroll up
      if (autoScrollDirection !== 'up') {
        startAutoScroll('up');
      }
    } else if (touch.clientY > viewportHeight - scrollThreshold) {
      // Near the bottom - scroll down
      if (autoScrollDirection !== 'down') {
        startAutoScroll('down');
      }
    } else {
      // Not near edges - stop auto-scrolling
      if (autoScrollDirection !== null) {
        stopAutoScroll();
      }
    }
    
    // Move the ghost element
    if (dragItemRef.current) {
      dragItemRef.current.style.top = `${touch.clientY - 20}px`;
      dragItemRef.current.style.left = `${touch.clientX - 50}px`;
    }
    
    // Find if we're over a blank
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const blankElement = elementsAtPoint.find(el => el.classList.contains('droppable-blank'));
    
    // Reset all blanks to transparent/normal state
    document.querySelectorAll('.droppable-blank').forEach(el => {
      if (el.textContent.trim() !== '____') {
        // If it has content, use very subtle background
        el.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      } else {
        // If empty, make transparent
        el.style.backgroundColor = 'transparent';
      }
      // Reset any glow effect
      el.style.boxShadow = 'none';
    });
    
    // Highlight the blank we're over with a subtle effect
    if (blankElement) {
      blankElement.style.backgroundColor = 'rgba(211, 166, 37, 0.2)';
      blankElement.style.boxShadow = '0 0 10px rgba(211, 166, 37, 0.3)';
    }
  };

  const handleTouchEnd = (e) => {
    // Prevent default behavior
    e.preventDefault();
    
    // Stop auto-scrolling
    stopAutoScroll();
    
    // Re-enable scrolling
    if (isDragging) {
      setIsDragging(false);
      enableScroll();
    }
    
    if (!draggedItem) return;
    
    // Check if touch ended over a blank
    const elementsAtPoint = document.elementsFromPoint(touchPosition.x, touchPosition.y);
    const blankElement = elementsAtPoint.find(el => el.classList.contains('droppable-blank'));
    
    // Remove ghost element
    if (dragItemRef.current) {
      document.body.removeChild(dragItemRef.current);
      dragItemRef.current = null;
    }
    
    if (blankElement) {
      const blankId = blankElement.getAttribute('data-blank-id');
      
      // Check if this blank already has a value (we'll return it to the word bank)
      const existingValue = blankValues[blankId];
      if (existingValue) {
        setWordBankItems(prev => [...prev, existingValue].sort(() => Math.random() - 0.5));
      }
      
      // Update blank value
      setBlankValues(prev => ({
        ...prev,
        [blankId]: draggedItem
      }));
      
      // Always set target blank to yellow state (regardless of previous validation)
      blankElement.style.background = "rgba(211, 166, 37, 0.2)";
      blankElement.style.border = "2px solid var(--secondary-color)";
      
      // Hide any existing check/x mark
      const mark = blankElement.querySelector('span[style*="position: absolute"]');
      if (mark) mark.style.display = 'none';
      
      // Always reset correctness regardless of submission status
      setBlankCorrectness(prev => ({
        ...prev,
        [blankId]: null
      }));
      
      // Reset submission state
      setIsSubmitted(false);
      
      // Remove from word bank
      setWordBankItems(prev => prev.filter(word => word !== draggedItem));
    }
    
    // Reset
    setDraggedItem(null);
    
    // Reset all blank highlights
    document.querySelectorAll('.droppable-blank').forEach(el => {
      if (el.textContent.trim() !== '____') {
        // If it has content, use very subtle background
        el.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      } else {
        // If empty, make transparent
        el.style.backgroundColor = 'transparent';
      }
      // Reset any glow effect
      el.style.boxShadow = 'none';
    });
  };

  // Define drag start handler for word bank items
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData("text/plain", item);
  };

  // Handle reset button
  const handleReset = () => {
    // Add animation effect to the button
    const resetButton = document.querySelector('.reset-button');
    if (resetButton) {
      resetButton.style.animation = 'button-glow 0.5s ease-in-out';
      setTimeout(() => {
        resetButton.style.animation = '';
      }, 500);
    }
    // Reset blanks
    setBlankValues(blanks.reduce((acc, blank) => ({ ...acc, [blank.id]: "" }), {}));
    setBlankCorrectness(blanks.reduce((acc, blank) => ({ ...acc, [blank.id]: null }), {}));
    // Reset word bank
    setWordBankItems([
      ...solutions,
      ...wrongAnswers
    ].sort(() => Math.random() - 0.5));
    // Reset submission state
    setIsSubmitted(false);
    setScore(null);
    // Clear any fill blanks message
    setFillBlanksMessage(false);
    // Show reset message in results area
    setResetMessage(true);
    // Reset first attempt status
    setIsFirstAttempt(true);
    // Hide reset message after 3 seconds
    setTimeout(() => {
      setResetMessage(false);
    }, 3000);
  };

  // Handle submission
  const handleSubmit = () => {
    // Add animation effect to the button
    const submitButton = document.querySelector('.submit-button');
    if (submitButton) {
      submitButton.style.animation = 'button-glow 0.5s ease-in-out';
      setTimeout(() => {
        submitButton.style.animation = '';
      }, 500);
    }
    // Clear reset message if it's showing
    setResetMessage(false);
    // Check if all blanks are filled
    const allFilled = blanks.every(blank => blankValues[blank.id]);
    if (!allFilled) {
      // Show fill blanks message
      setFillBlanksMessage(true);
      // Reset any previous submission
      setIsSubmitted(false);
      return;
    }
    // Clear the fill blanks message
    setFillBlanksMessage(false);
    // Calculate correctness for each blank
    const newCorrectness = {};
    let correctCount = 0;
    blanks.forEach(blank => {
      const value = blankValues[blank.id];
      const solutions = Array.isArray(blank.solution) ? blank.solution : [blank.solution];
      const isCorrect = solutions.includes(value);
      newCorrectness[blank.id] = isCorrect;
      if (isCorrect) correctCount++;
    });
    // Update correctness state
    setBlankCorrectness(newCorrectness);
    // Calculate score
    const scorePercentage = Math.round((correctCount / blanks.length) * 100);
    const isAllCorrect = correctCount === blanks.length;
    setScore(scorePercentage);
    // Call the onSubmission handler with the results
    if (onSubmission) {
      // Create an object with blank IDs and their correctness status
      const blanksResults = {};
      blanks.forEach(blank => {
        blanksResults[blank.id] = newCorrectness[blank.id];
      });
      onSubmission(blanksResults);
    }
    // No longer first attempt after submission
    setIsFirstAttempt(false);
    // Set as submitted
    setIsSubmitted(true);
  };

  // Render children with updated props
  const renderedChildren = React.Children.map(extractedChildren, child => {
    if (typeof child === 'string') {
      return child;
    }
    if (child.props.id && child.props.id.startsWith('blank-')) {
      return React.cloneElement(child, { 
        onDrop: handleDrop,
        value: blankValues[child.props.id],
        isCorrect: blankCorrectness[child.props.id]
      });
    }
    return child;
  });

  // Get message based on correctness or status
  const getResultMessage = () => {
    if (fillBlanksMessage) return "Please fill in all blanks before casting Revelio! 📝";
    if (resetMessage) return "The spell has been reset! ✨";
    if (!isSubmitted) return "";
    const allCorrect = Object.values(blankCorrectness).every(val => val === true);
    if (allCorrect) return "Excellent! All answers are correct! ⚡";
    return ""; // No message for incorrect answers
  };

  return (
    <Box 
      p="5" 
      border="2px solid var(--panel-border)"
      borderRadius="md" 
      width="100%" 
      maxW="800px" 
      bg="rgba(42, 45, 52, 0.85)"
      boxShadow="0 8px 16px rgba(0,0,0,0.4)"
      position="relative"
      overflow="hidden"
      className="wizard-panel activity-panel"
    >
      {/* Notification system instead of alerts */}
      <div id="notification-container" style={{ 
        position: "absolute",
        top: "10px",
        left: "0",
        right: "0",
        zIndex: "100",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }} ref={notificationContainerRef}></div>
      <Heading 
        as="h3" 
        size="md" 
        mb="4" 
        color="var(--secondary-color)"
        textAlign="center"
        style={{ 
          fontFamily: "'Cinzel', serif",
          position: "relative",
          textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
          letterSpacing: "1px",
        }}
        className="activity-title"
      >
        <span style={{
          display: "inline-block",
          padding: "0 30px",
          position: "relative"
        }}>
          {title}
          <span style={{
            position: "absolute",
            bottom: "-5px",
            left: "0",
            right: "0",
            height: "2px",
            background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
            animation: "shimmer 2s infinite"
          }}></span>
        </span>
      </Heading>
      <Box 
        mb="4" 
        p="4"  
        bg="rgba(20, 23, 46, 0.6)"
        borderRadius="md" 
        border="1px solid var(--panel-border)"
        boxShadow="inset 0 2px 4px rgba(0,0,0,0.2)"
        style={{
          color: "var(--text-primary)",
          fontSize: "16px",
          lineHeight: "1.6",
          letterSpacing: "0.3px"
        }}
        className="activity-content"
      >
        {renderedChildren}
      </Box>
      {(resetMessage || fillBlanksMessage || (isSubmitted && Object.values(blankCorrectness).every(val => val === true))) && (
        <Box 
          mb="4" 
          p="4"  
          position="relative"
          borderRadius="md" 
          border={fillBlanksMessage ? "2px solid #f39c12" : 
                 resetMessage ? "2px solid #3498db" : 
                 "2px solid #2ecc71"}
          textAlign="center"
          fontWeight="bold"
          color="white"
          background={fillBlanksMessage ? "rgba(243, 156, 18, 0.15)" :
                     resetMessage ? "rgba(52, 152, 219, 0.15)" : 
                     "rgba(46, 204, 113, 0.15)"}
          boxShadow="0 4px 8px rgba(0,0,0,0.2)"
          className="result-message"
          style={{
            animation: "fade-in 0.5s ease-out forwards",
            fontFamily: "'Cinzel', serif",
          }}
        >
          {/* Removed sparkle animation background for performance */}
          <Text 
            fontSize="xl" 
            style={{
              textShadow: fillBlanksMessage ? "0 0 5px rgba(243, 156, 18, 0.5)" :
                         resetMessage ? "0 0 5px rgba(52, 152, 219, 0.5)" : 
                         "0 0 5px rgba(46, 204, 113, 0.5)",
              position: "relative",
              zIndex: 1,
              // Remove float animation
              color: fillBlanksMessage ? "#f39c12" :
                    resetMessage ? "#3498db" :
                    "#2ecc71",
              letterSpacing: "0.5px"
            }}
          >
            {getResultMessage()}
          </Text>
        </Box>
      )}
      <Flex justify="space-between" mb="4">
        <button
          onClick={handleReset}
          className="wizard-button reset-button"
          style={{
            background: "linear-gradient(to bottom, #aa3333 0%, #7a1111 100%)",
            color: "var(--text-primary)",
            border: "none",
            padding: "10px 20px",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            fontFamily: "'Cinzel', serif",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{
            display: "inline-block",
            width: "18px",
            height: "18px",
            backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z\" fill=\"%23ffffff\"/></svg>')",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            position: "relative",
          }}></span>
          <span style={{ position: "relative", zIndex: 2 }}>Evanesco</span>
        </button>
        <button
          onClick={handleSubmit}
          className="wizard-button submit-button"
          disabled={isSubmitted}
          style={{
            background: "linear-gradient(to bottom, #2e7d32 0%, #1b5e20 100%)",
            color: "var(--text-primary)",
            border: "none",
            padding: "10px 20px",
            borderRadius: "12px", 
            fontSize: "15px", 
            fontWeight: "bold",
            cursor: isSubmitted ? "default" : "pointer",
            position: "relative",
            overflow: "hidden",
            fontFamily: "'Cinzel', serif",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
            opacity: isSubmitted ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{
            display: "inline-block",
            width: "18px",
            height: "18px",
            backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z\" fill=\"%23ffffff\"/></svg>')",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            position: "relative",
          }}></span>
          <span style={{ position: "relative", zIndex: 2 }}>Revelio</span>
        </button>
      </Flex>
      <Box 
        p="5" 
        bg="linear-gradient(to bottom, rgba(24, 36, 76, 0.9), rgba(14, 26, 56, 0.95))"
        borderRadius="lg"
        border="2px solid var(--panel-border)"
        boxShadow="0 8px 16px rgba(0,0,0,0.4), inset 0 0 30px rgba(211, 166, 37, 0.15)"
        style={{
          position: "relative",
          overflow: "hidden",
          marginTop: "20px",
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleWordBankDrop}
        className="wordbank-container"
      >
        {/* Decorative background elements */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "radial-gradient(circle at 20% 30%, rgba(211, 166, 37, 0.15) 0%, transparent 60%), radial-gradient(circle at 80% 70%, rgba(211, 166, 37, 0.15) 0%, transparent 60%)",
          opacity: 0.7,
          pointerEvents: "none",
        }}></div>
        
        {/* Title section with enhanced styling */}
        <Flex
          direction="column"
          align="center"
          mb="5"
        >
          <div style={{ 
            position: "relative", 
            marginBottom: "10px",
            padding: "0 40px",
            width: "100%"
          }}>
            <div style={{
              height: "2px",
              width: "100%",
              background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
              position: "relative",
            }}></div>
          </div>
          
          <Heading
            size="md"
            color="var(--secondary-color)"
            textAlign="center"
            style={{ 
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
              position: "relative",
              letterSpacing: "1.5px",
              marginBottom: "10px",
            }}
          >
            <span style={{ 
              display: "inline-block",
              color: "var(--secondary-color)",
              fontSize: "22px",
              textTransform: "uppercase"
            }}>
              Magical Incantations Vault
            </span>
          </Heading>
          
          <div style={{ 
            position: "relative", 
            marginTop: "10px",
            padding: "0 40px",
            width: "100%"
          }}>
            <div style={{
              height: "2px",
              width: "100%",
              background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
              position: "relative",
            }}></div>
          </div>
        </Flex>
        
        {/* Word bank items container with improved styling */}
        <Box 
          style={{
            background: "linear-gradient(to bottom, rgba(16, 25, 56, 0.8), rgba(12, 21, 46, 0.9))",
            border: "1px solid rgba(211, 166, 37, 0.4)",
            borderRadius: "14px",
            boxShadow: "inset 0 0 15px rgba(0,0,0,0.5)",
            padding: "16px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" fill=\"none\" stroke=\"%23D3A625\" stroke-width=\"0.5\" stroke-opacity=\"0.15\"/></svg>')",
            opacity: 0.15,
            pointerEvents: "none",
          }}></div>
          
          {/* Scroll container for words */}
          <Flex 
            flexWrap="wrap" 
            gap="3"
            justifyContent="center"
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              padding: "8px",
              position: "relative",
              zIndex: 2,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gridGap: "12px"
            }}
            className="word-bank-scrollable"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleWordBankDrop}
          >
            {/* Word items with upgraded styling */}
            {wordBankItems.map((item, index) => (
              <Box 
                key={index}
                p="3"
                bg="rgba(30, 33, 50, 0.95)"
                border="1px solid rgba(211, 166, 37, 0.6)"
                borderRadius="10px"
                fontSize="md"
                color="var(--secondary-color)"
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                cursor="grab"
                onTouchStart={(e) => handleTouchStart(e, item)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  fontFamily: "'Cinzel', serif",
                  transition: "all 0.15s ease",
                  minWidth: "100px",
                  maxWidth: "150px",
                  height: "42px",
                  textAlign: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "8px",
                  fontWeight: "500",
                  letterSpacing: "0.5px",
                  fontSize: "16px"
                }}
                className="word-bank-item"
                _hover={{ 
                  borderColor: "var(--secondary-color)",
                  boxShadow: "0 2px 6px rgba(211, 166, 37, 0.4)",
                  transform: "translateY(-2px)"
                }}
              >
                {item}
              </Box>
            ))}
            
            {/* Show placeholder when word bank is empty */}
            {wordBankItems.length === 0 && (
              <Box
                p="4"
                textAlign="center"
                color="rgba(211, 166, 37, 0.6)"
                fontSize="sm"
                width="100%"
                style={{
                  fontStyle: "italic",
                  animation: "fade-in 1s forwards"
                }}
              >
                All magical incantations have been used.
              </Box>
            )}
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

// System of Inequalities Challenge Component
const SystemOfInequalitiesChallenge = ({ onSolutionCheck, onFormatCheck }) => {
  const [inequalities, setInequalities] = useState(['', '', '']);
  const [latexInequalities, setLatexInequalities] = useState(['', '', '']);
  const [parsedInequalities, setParsedInequalities] = useState([]);
  const [solutionPoint, setSolutionPoint] = useState({ x: '', y: '' });
  const [validationResult, setValidationResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [errorMessages, setErrorMessages] = useState(['', '', '']);
  const [isSystemVerified, setIsSystemVerified] = useState(false);
  const [systemCheckResult, setSystemCheckResult] = useState(null);

  // Function to convert user input to LaTeX
  const convertToLatex = (input) => {
    if (!input.trim()) return '';
    // Replace common inequality operators with LaTeX versions
    let latex = input
      .replace(/>=|≥/g, '\\geq ')
      .replace(/<=|≤/g, '\\leq ')
      .replace(/=/g, '=')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      // Convert uppercase X and Y to lowercase before other replacements
      .replace(/X/g, 'x')
      .replace(/Y/g, 'y')
      .replace(/(\d+)x/g, '$1x')  // Add multiplication symbol
      .replace(/(\d+)y/g, '$1y')  // Add multiplication symbol
      .replace(/x/g, 'x')
      .replace(/y/g, 'y');
    return latex;
  };

  // Update LaTeX representation when inequalities change
  useEffect(() => {
    const newLatexInequalities = inequalities.map(ineq => convertToLatex(ineq));
    setLatexInequalities(newLatexInequalities);
  }, [inequalities]);

  // Render LaTeX formula in a container
  const renderLatex = (latex) => {
    if (!latex) return '';
    try {
      const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      });
      return html;
    } catch (error) {
      return '';
    }
  };

  // Handle inequality input changes
  const handleInequalityChange = (index, value) => {
    const newInequalities = [...inequalities];
    newInequalities[index] = value;
    setInequalities(newInequalities);
    
    // Clear error message when typing
    const newErrorMessages = [...errorMessages];
    newErrorMessages[index] = '';
    setErrorMessages(newErrorMessages);
    
    // Reset styling for this input field - using both class and style approach for reliability
    const inputField = document.querySelectorAll(`input[placeholder="Inequality ${index + 1}"]`)[0];
    if (inputField) {
      // Remove any validation classes
      inputField.classList.remove('input-valid', 'input-invalid');
      // Reset border to default yellow
      inputField.style.border = '1px solid rgba(240, 199, 94, 0.3)';
    }
    
    // Clear results when changing inputs
    setShowResult(false);
    setIsSystemVerified(false);
    setSystemCheckResult(null);
  };

  // Handle solution point input changes
  const handlePointChange = (coord, value) => {
    // Only allow numeric values (digits, decimal point, and minus sign)
    if (/^-?\d*\.?\d*$/.test(value) || value === '') {
      setSolutionPoint(prev => ({
        ...prev,
        [coord]: value
      }));
      setShowResult(false);
    }
  };

  // Validate and parse all inequalities
  const validateInequalities = () => {
    const { parseInequality } = require('../utils/parser');
    const newParsedInequalities = [];
    const newErrorMessages = ['', '', ''];
    let valid = true;
    inequalities.forEach((ineq, index) => {
      if (!ineq.trim()) {
        newErrorMessages[index] = 'Please enter an inequality';
        valid = false;
        return;
      }
      const parsed = parseInequality(ineq);
      if (!parsed) {
        newErrorMessages[index] = `Invalid format. Try examples like: x+y<0, 2x-3y+1≥0`;
        valid = false;
      } else {
        newParsedInequalities.push(parsed);
      }
      if (onFormatCheck) {
        onFormatCheck(!!parsed, index);
      }
    });
    setErrorMessages(newErrorMessages);
    if (valid) {
      setParsedInequalities(newParsedInequalities);
    }
    return valid;
  };

  // Check system of inequalities
  const handleCheckSystem = (e) => {
    e.preventDefault();
    // Check if we have at least 3 inequalities
    if (inequalities.filter(ineq => ineq.trim()).length < 3) {
      setErrorMessages(prev => prev.map((err, i) => 
        !inequalities[i].trim() ? 'Please enter an inequality' : err
      ));
      setSystemCheckResult({
        isValid: false,
        message: "Please enter at least 3 inequalities."
      });
      return;
    }
    // Validate inequalities
    if (!validateInequalities()) {
      setSystemCheckResult({
        isValid: false,
        message: "Please correct the errors in your inequalities."
      });
      // Apply red styling to the inputs with errors
      inequalities.forEach((ineq, idx) => {
        if (errorMessages[idx]) {
          const inputField = document.querySelectorAll(`input[placeholder="Inequality ${idx + 1}"]`)[0];
          if (inputField) {
            inputField.classList.add('input-invalid');
            inputField.style.border = '1px solid #e74c3c';
          }
        }
      });
      return;
    }
    // Apply green styling to valid inputs
    inequalities.forEach((ineq, idx) => {
      if (ineq.trim()) {
        const inputField = document.querySelectorAll(`input[placeholder="Inequality ${idx + 1}"]`)[0];
        if (inputField) {
          inputField.classList.add('input-valid');
          inputField.style.border = '1px solid #2ecc71';
        }
      }
    });
    // System is valid
    setIsSystemVerified(true);
    setSystemCheckResult({
      isValid: true,
      message: "System of inequalities verified! You can now enter a solution point."
    });
  };

  // Check if the point is a solution for all inequalities
  const checkPointInInequality = (eq, point) => {
    const val = eq.a * point.x + eq.b * point.y + eq.c;
    const EPSILON = 1e-9;
    // For points exactly on the boundary line (within small epsilon)
    if (Math.abs(val) < EPSILON) {
      return eq.operator === '<=' || eq.operator === '>=' || eq.operator === '=';
    }
    // For strict inequalities
    switch (eq.operator) {
      case '<': return val < 0;
      case '<=': return val <= 0;
      case '>': return val > 0;
      case '>=': return val >= 0;
      case '=': return Math.abs(val) < EPSILON;
      default: return false;
    }
  };

  // Handle form submission for solution point check
  const handleSubmit = (e) => {
    e.preventDefault();
    // Don't process if system hasn't been verified
    if (!isSystemVerified) {
      return;
    }
    // Validate solution point
    if (!solutionPoint.x || !solutionPoint.y) {
      setValidationResult({
        isCorrect: false,
        message: 'Please enter both x and y coordinates for your solution point.'
      });
      setShowResult(true);
      return;
    }
    // Convert point coordinates to numbers
    const pointX = parseFloat(solutionPoint.x);
    const pointY = parseFloat(solutionPoint.y);
    if (isNaN(pointX) || isNaN(pointY)) {
      setValidationResult({
        isCorrect: false,
        message: 'Please enter valid numbers for coordinates.'
      });
      setShowResult(true);
      return;
    }
    // Check if the point satisfies all inequalities
    const point = { x: pointX, y: pointY };
    const satisfiesAll = parsedInequalities.every(ineq => checkPointInInequality(ineq, point));
    // Generate unsatisfied inequalities list if needed
    let failedInequalities = [];
    if (!satisfiesAll) {
      parsedInequalities.forEach((ineq, index) => {
        if (!checkPointInInequality(ineq, point)) {
          // Store the original inequality for error message
          failedInequalities.push(`<span class="katex-error">${inequalities[index]}</span>`);
        }
      });
    }
    // Set result with properly formatted message
    setValidationResult({
      isCorrect: satisfiesAll,
      message: satisfiesAll 
        ? `Magnificent! The point (${pointX}, ${pointY}) is indeed a magical solution to your system of inequalities.`
        : `Not quite. The point (${pointX}, ${pointY}) does not satisfy: ${failedInequalities.join(', ')}`
    });
    setShowResult(true);
    // If there are failed inequalities, update them with proper LaTeX rendering
    if (!satisfiesAll && failedInequalities.length > 0) {
      // Wait for the DOM to update
      setTimeout(() => {
        // Find all elements with the katex-error class
        const errorSpans = document.querySelectorAll('.katex-error');
        errorSpans.forEach((span, idx) => {
          // Get the original inequality text
          const ineqIndex = inequalities.indexOf(span.textContent);
          if (ineqIndex !== -1) {
            // Render it with KaTeX
            span.innerHTML = renderLatex(latexInequalities[ineqIndex]);
          }
        });
      }, 50);
    }
    if (onSolutionCheck) {
      onSolutionCheck(true, false, satisfiesAll);
    }
  };

  // Handle declaring the system has no solution
  const handleNoSolution = () => {
    // TODO: Add actual verification logic to check if the system truly has no solution
    setValidationResult({
      isCorrect: false,
      message: "This system of inequalities has at least one solution."
    });
    setShowResult(true);
    if (onSolutionCheck) {
      onSolutionCheck(true, true, false);
    }
  };

  const addInequality = () => {
    setInequalities([...inequalities, '']);
    setErrorMessages([...errorMessages, '']);
  };

  const removeInequality = (index) => {
    if (inequalities.length <= 3) return; // Keep minimum 3 inequalities
    const newInequalities = [...inequalities];
    newInequalities.splice(index, 1);
    setInequalities(newInequalities);
    const newErrorMessages = [...errorMessages];
    newErrorMessages.splice(index, 1);
    setErrorMessages(newErrorMessages);
    setShowResult(false);
  };

  // Handle reset of the inequality system
  const handleReset = () => {
    // Reset all state
    setInequalities(['', '', '']);
    setLatexInequalities(['', '', '']);
    setParsedInequalities([]);
    setSolutionPoint({ x: '', y: '' });
    setValidationResult(null);
    setShowResult(false);
    setErrorMessages(['', '', '']);
    setIsSystemVerified(false);
    setSystemCheckResult(null);
  };

  return (
    <Box mt="6">
      <Heading 
        as="h3" 
        size="md" 
        mb="4" 
        color="var(--secondary-color)"
        textAlign="center"
        style={{ 
          fontFamily: "'Cinzel', serif",
          position: "relative",
          textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
          letterSpacing: "1px",
        }}
        className="activity-title"
      >
        <span style={{
          display: "inline-block",
          padding: "0 30px",
          position: "relative"
        }}>
          System of Inequalities Challenge
          <span style={{
            position: "absolute",
            bottom: "-5px",
            left: "0",
            right: "0",
            height: "2px",
            background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
            animation: "shimmer 2s infinite"
          }}></span>
        </span>
      </Heading>
      <Box 
        mb="4" 
        p="4"  
        bg="rgba(20, 23, 46, 0.6)"
        borderRadius="md" 
        border="1px solid var(--panel-border)"
        boxShadow="inset 0 2px 4px rgba(0,0,0,0.2)"
        style={{
          color: "var(--text-primary)",
          fontSize: "16px",
          lineHeight: "1.6",
          letterSpacing: "0.3px"
        }}
      >
        <form onSubmit={isSystemVerified ? handleSubmit : handleCheckSystem}>
          <Box mb="4">
            <Text fontWeight="bold" mb="2" color="var(--secondary-color)">Enter your system of inequalities:</Text>
            {inequalities.map((ineq, index) => (
              <Box key={index} mb="4">
                <Flex align="center" mb="1">
                  <input
                    type="text"
                    value={ineq}
                    onChange={(e) => handleInequalityChange(index, e.target.value)}
                    placeholder={`Inequality ${index + 1}`}
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      border: "1px solid rgba(240, 199, 94, 0.3)",
                      borderRadius: "4px"
                    }}
                  />
                  {inequalities.length > 3 && (
                    <Box ml="2">
                      <button
                        type="button"
                        onClick={() => removeInequality(index)}
                        className="delete-button"
                        title="Remove inequality"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--error-color)",
                          cursor: "pointer",
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: "20px" }}>delete</span>
                      </button>
                    </Box>
                  )}
                </Flex>
                
                {/* LaTeX Preview */}
                {ineq.trim() && (
                  <Box 
                    mt="1" 
                    p="2" 
                    borderRadius="md" 
                    bg="rgba(0, 0, 0, 0.2)"
                    border="1px dashed rgba(211, 166, 37, 0.3)"
                    textAlign="center"
                  >
                    <div 
                      dangerouslySetInnerHTML={{
                        __html: renderLatex(latexInequalities[index])
                      }}
                      style={{
                        fontSize: "1.1em",
                        color: "#f0c75e"
                      }}
                    />
                  </Box>
                )}
                
                {errorMessages[index] && (
                  <Text mt="1" color="var(--error-color)" fontSize="sm">{errorMessages[index]}</Text>
                )}
              </Box>
            ))}
            {!isSystemVerified && (
              <button 
                type="button"
                onClick={addInequality}
                className="example-button"
                style={{
                  marginTop: "10px",
                  fontSize: "0.8rem",
                  padding: "5px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <span className="material-icons" style={{ fontSize: "16px" }}>add</span>
                Add Inequality
              </button>
            )}
          </Box>
          {!isSystemVerified ? (
            <button 
              type="submit"
              className="spellcast-button"
              style={{
                padding: "10px 20px",
                fontSize: "1rem",
                marginTop: "10px",
                marginBottom: "20px",
                background: "linear-gradient(to bottom, #3949ab 0%, #283593 100%)"
              }}
            >
              <span className="spell-icon" style={{ marginRight: "5px" }}>⚡</span>
              Check System of Inequalities
            </button>
          ) : (
            <>
              <Box mb="4">
                <Text fontWeight="bold" mb="2" color="var(--secondary-color)">Your Solution Point:</Text>
                <Flex align="center">
                  <Text mr="2">(</Text>
                  <input
                    type="text"
                    value={solutionPoint.x}
                    onChange={(e) => handlePointChange('x', e.target.value)}
                    placeholder="x"
                    style={{
                      width: "80px",
                      padding: "8px",
                      textAlign: "center",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      border: "1px solid rgba(240, 199, 94, 0.3)",
                      borderRadius: "4px"
                    }}
                  />
                  <Text mx="2">,</Text>
                  <input
                    type="text" 
                    value={solutionPoint.y}
                    onChange={(e) => handlePointChange('y', e.target.value)}
                    placeholder="y"
                    style={{
                      width: "80px",
                      padding: "8px",
                      textAlign: "center",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      border: "1px solid rgba(240, 199, 94, 0.3)",
                      borderRadius: "4px"
                    }}
                  />
                  <Text ml="2">)</Text>
                </Flex>
              </Box>
              <Flex gap="4">
                <button 
                  type="submit"
                  className="spellcast-button"
                  style={{
                    padding: "10px 20px",
                    fontSize: "1rem",
                    marginTop: "10px",
                    background: "linear-gradient(to bottom, #2e7d32 0%, #1b5e20 100%)"
                  }}
                >
                  <span className="spell-icon" style={{ marginRight: "5px" }}>✨</span>
                  Check Solution
                </button>
                <button 
                  type="button" 
                  onClick={handleNoSolution}
                  className="spellcast-button no-solution-button"
                  style={{
                    padding: "10px 20px",
                    fontSize: "1rem",
                    marginTop: "10px",
                    background: "linear-gradient(to bottom, #7B1FA2 0%, #4A148C 100%)"
                  }}
                >
                  <span className="spell-icon" style={{ marginRight: "5px" }}>🚫</span>
                  No Solution
                </button>
              </Flex>
            </>
          )}
        </form>
        {systemCheckResult && (
          <Box 
            mt="4" 
            p="4"  
            borderRadius="md"
            border={systemCheckResult.isValid 
              ? "2px solid #2ecc71" 
              : "2px solid #e74c3c"}
            background={systemCheckResult.isValid 
              ? "rgba(46, 204, 113, 0.15)" 
              : "rgba(231, 76, 60, 0.15)"}  
            boxShadow="0 4px 8px rgba(0,0,0,0.2)"
            style={{
              animation: "fade-in 0.5s ease-out forwards",
              fontFamily: "'Cinzel', serif",
            }}
          >
            {/* Removed sparkle animation background for performance */}
            <Text 
              color={systemCheckResult.isValid ? "#2ecc71" : "#e74c3c"}
              fontWeight="bold"
              style={{ position: "relative", zIndex: 1 }}
              dangerouslySetInnerHTML={{
                __html: systemCheckResult.message
              }}
            />
          </Box>
        )}
        {showResult && (
          <Box 
            mt="4" 
            p="4" 
            borderRadius="md"
            border={validationResult.isCorrect 
              ? "2px solid #2ecc71" 
              : "2px solid #e74c3c"}
            background={validationResult.isCorrect 
              ? "rgba(46, 204, 113, 0.15)" 
              : "rgba(231, 76, 60, 0.15)"}  
            boxShadow="0 4px 8px rgba(0,0,0,0.2)"
            style={{
              animation: "fade-in 0.5s ease-out forwards",
              fontFamily: "'Cinzel', serif"
            }}
          >
            {/* Removed sparkle animation background for performance */}
            <Text 
              color={validationResult.isCorrect ? "#2ecc71" : "#e74c3c"}
              fontWeight="bold"
              style={{ position: "relative", zIndex: 1 }}
              dangerouslySetInnerHTML={{
                __html: validationResult.message
              }}
            />
          </Box>
        )}
        {/* Only show reset button when the solution is correct */}
        {showResult && validationResult && validationResult.isCorrect && (
          <button 
            onClick={handleReset}
            className="reset-challenge-button"
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              fontSize: "1rem",
              background: "linear-gradient(to bottom, #e74c3c 0%, #c0392b 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "'Cinzel', serif",
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span style={{
              display: "inline-block",
              width: "18px",
              height: "18px",
              backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z\" fill=\"%23ffffff\"/></svg>')",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat"
            }}></span>
            Reset Inequality System
          </button>
        )}
      </Box>
    </Box>
  );
};

// Add this helper function before the LinearInequalitiesActivity component
const renderLatexHTML = (formula) => {
  try {
    return {
      __html: katex.renderToString(formula, {
        throwOnError: false,
        displayMode: false
      })
    };
  } catch (error) {
    return { __html: formula };
  }
};

export default function LinearInequalitiesActivity({ 
  blankState, 
  updateBlankState, 
  onSubmission,
  onInequalitySolution,
  onFormatCheck 
}) {
  React.useEffect(() => {
    // Add the animations style tag
    const style = document.createElement('style');
    style.textContent = animationsCSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Handler for inequality solution checks
  const handleInequalitySolution = (systemHasSolution, selectedNoSolution, isSolutionCorrect) => {
    if (onInequalitySolution) {
      onInequalitySolution(systemHasSolution, selectedNoSolution, isSolutionCorrect);
    }
  };

  // Handler for format checks
  const handleFormatCheck = (isValid, index) => {
    if (onFormatCheck) {
      onFormatCheck(isValid, index);
    }
  };

  return (
    <MagicPointsProvider>
      <Flex 
        direction="column" 
        align="center" 
        p={["2", "4", "6"]} 
        minH="100vh" 
        className="linear-inequalities-activity"
      >
        <Separator />
        <Dnd
          taskId="linear-inequalities-1"
          title="Charm the Blanks with Correct Incantations"
          wrongAnswers={[
            "contradicts", "annihilates", "augments",
            "parameter", "axis", "constant", 
            "determinant", "gradient", "modulus", 
            "delineates", "prescribes", "transposes", 
            "synthesis", "theorem", "matrix",
          ]}
          onSubmission={onSubmission}
        >
          A <Blank solution="system" /> of linear inequalities in two variables is defined as a collection that <Blank solution="comprises" /> at least two distinct inequalities. A <Blank solution="coordinate" /> <span dangerouslySetInnerHTML={renderLatexHTML("(x_0,y_0)")} /> qualifies as a <Blank solution="solution" /> to this system if and only if the ordered pair <Blank solution="satisfies" /> every inequality in the collection without exception.
        </Dnd>
        <Separator />
        <Box 
          p="6" 
          bg="rgba(14, 26, 64, 0.95)" 
          borderRadius="md" 
          border="2px solid var(--hogwarts-secondary)" 
          boxShadow="0 5px 15px rgba(0, 0, 0, 0.5), 0 0 15px rgba(211, 166, 37, 0.3)"
          position="relative"
          zIndex="100"
          style={{
            isolation: "isolate",
            pointerEvents: "auto"
          }}
        >
          <SystemOfInequalitiesChallenge 
            onSolutionCheck={handleInequalitySolution}
            onFormatCheck={handleFormatCheck}
          />
        </Box>
      </Flex>
    </MagicPointsProvider>
  );
}