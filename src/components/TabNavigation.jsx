import React from 'react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const handleTabClick = (tabName) => {
    // Call the setActiveTab function passed from parent
    setActiveTab(tabName);
    
    // No need to invoke MathJax anymore as we're using KaTeX
    // KaTeX renders immediately when used in dangerouslySetInnerHTML
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