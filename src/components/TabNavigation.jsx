import React from 'react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const handleTabClick = (tabName) => {
    // Call the setActiveTab function passed from parent
    setActiveTab(tabName);
    
    // Allow time for the DOM to update before invoking MathJax if available
    if (window.MathJax && window.MathJax.typeset) {
      setTimeout(() => {
        window.MathJax.typeset();
      }, 100);
    }
  };

  return (
    <div className="tab-navigation">
      <button 
        className={`tab-button ${activeTab === 'activity1' ? 'active' : ''}`}
        onClick={() => handleTabClick('activity1')}
      >
        Activity 1
      </button>
      <button 
        className={`tab-button ${activeTab === 'activity2' ? 'active' : ''}`}
        onClick={() => handleTabClick('activity2')}
      >
        Activity 2
      </button>
    </div>
  );
};

export default TabNavigation; 