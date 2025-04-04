import React, { useEffect, useState } from 'react';
import '../styles/Animations.css';

const MagicalElements = () => {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    // Generate random magical elements
    const generateElements = () => {
      const newElements = [];
      const icons = ['wand', 'star', 'snitch'];
      const numElements = Math.floor(window.innerWidth / 100);
      
      for (let i = 0; i < numElements; i++) {
        const icon = icons[Math.floor(Math.random() * icons.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 10;
        const duration = 15 + Math.random() * 20;
        
        newElements.push({
          id: `element-${i}`,
          icon,
          style: {
            left: `${left}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`
          }
        });
      }
      
      setElements(newElements);
    };
    
    generateElements();
    
    // Regenerate on window resize
    const handleResize = () => {
      generateElements();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderElement = (element) => {
    switch (element.icon) {
      case 'wand':
        return (
          <div className="hp-icon icon-wand" style={element.style}></div>
        );
      case 'star':
        return (
          <div className="hp-icon icon-star" style={element.style}></div>
        );
      case 'snitch':
        return (
          <div className="hp-icon icon-snitch" style={element.style}>
            <span></span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="floating-elements">
      {elements.map((element) => (
        <div 
          key={element.id} 
          className="floating-element"
          style={element.style}
        >
          {renderElement(element)}
        </div>
      ))}
    </div>
  );
};

export default MagicalElements; 