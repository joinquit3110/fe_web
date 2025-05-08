import React from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useSocket } from '../context/SocketContext';
import { useMagicPoints } from '../context/MagicPointsContext';
import { Box, Text, Tooltip } from '@chakra-ui/react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const { isAdmin } = useAdmin();
  const { isConnected, connectionQuality } = useSocket();
  const { isOfflineMode, toggleOfflineMode } = useMagicPoints();
  
  const handleTabClick = (tabName) => {
    // Call the setActiveTab function passed from parent
    setActiveTab(tabName);
    
    // No need to invoke MathJax anymore as we're using KaTeX
    // KaTeX renders immediately when used in dangerouslySetInnerHTML
  };

  // Determine status for connection indicator
  let statusColor, statusIcon, statusTooltip;
  
  if (isOfflineMode) {
    statusColor = "#ED8936"; // orange.500
    statusIcon = "⚠️";
    statusTooltip = "Offline Mode (Click to reconnect)";
  } else if (!isConnected) {
    statusColor = "#E53E3E"; // red.500
    statusIcon = "❌";
    statusTooltip = "Disconnected from server";
  } else if (connectionQuality === 'poor') {
    statusColor = "#ECC94B"; // yellow.500
    statusIcon = "⚡";
    statusTooltip = "Poor connection";
  } else {
    statusColor = "#38A169"; // green.500
    statusIcon = "✓";
    statusTooltip = "Connected";
  }

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
        {isAdmin ? 'Wizardry Console' : 'Expecto Graph‑tronum!'}
      </button>
      <button 
        className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
        onClick={() => handleTabClick('leaderboard')}
      >
        House Cup
      </button>
      
      {/* Connection status indicator */}
      <Tooltip label={statusTooltip}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          ml="auto"
          mr="10px"
          borderRadius="full"
          bg={`${statusColor}20`}
          color={statusColor}
          width="28px"
          height="28px"
          cursor={isOfflineMode ? "pointer" : "default"}
          onClick={isOfflineMode ? () => toggleOfflineMode(false) : undefined}
          border={`2px solid ${statusColor}`}
          fontWeight="bold"
          _hover={isOfflineMode ? { bg: `${statusColor}30` } : {}}
          transition="all 0.2s"
        >
          <Text>{statusIcon}</Text>
        </Box>
      </Tooltip>
    </div>
  );
};

export default TabNavigation;