import React from 'react';
import { useAdmin } from '../contexts/AdminContext';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const { isAdmin } = useAdmin();
  
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
        {isAdmin ? 'Mutatio Chamber' : 'Reparo Gap‑us'}
      </button>
      <button 
        className={`tab-button ${activeTab === 'activity2' ? 'active' : ''}`}
        onClick={() => handleTabClick('activity2')}
      >
        {isAdmin ? 'Wizardry Console' : 'Expecto Graph‑tronum!'}
      </button>
      <button 
        className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
        onClick={() => handleTabClick('leaderboard')}
      >
        House Cup
      </button>
    </div>
  );
};

export default TabNavigation;