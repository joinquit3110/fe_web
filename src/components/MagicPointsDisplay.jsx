import React, { useState, useEffect, useRef } from "react";
import { Box, Text, Button, Flex, Tooltip, Progress, Badge } from "@chakra-ui/react";
import { useMagicPoints } from "../context/MagicPointsContext";

// CSS for the glow and sparkle effects
const magicPointsStyles = `
  @keyframes magical-glow {
    0% { box-shadow: 0 0 5px rgba(211, 166, 37, 0.6), 0 0 10px rgba(211, 166, 37, 0.4); }
    50% { box-shadow: 0 0 15px rgba(211, 166, 37, 0.8), 0 0 20px rgba(211, 166, 37, 0.6); }
    100% { box-shadow: 0 0 5px rgba(211, 166, 37, 0.6), 0 0 10px rgba(211, 166, 37, 0.4); }
  }

  @keyframes sparkle {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }

  @keyframes point-change {
    0% { opacity: 0; transform: translateY(0); }
    20% { opacity: 1; }
    80% { opacity: 1; transform: translateY(-30px); }
    100% { opacity: 0; transform: translateY(-50px); }
  }

  .point-change {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    animation: point-change 1.5s forwards;
    font-weight: bold;
    pointer-events: none;
    font-size: 16px;
    text-shadow: 0 0 5px rgba(0,0,0,0.5);
    z-index: 10;
  }
  
  .point-change.increase {
    color: #4CAF50;
  }
  
  .point-change.decrease {
    color: #F44336;
  }

  .magic-sparkle {
    position: absolute;
    background: white;
    border-radius: 50%;
    width: 4px;
    height: 4px;
  }

  .magic-sparkle:nth-child(1) {
    top: 20%;
    left: 10%;
    animation: sparkle 2s infinite 0.3s;
  }

  .magic-sparkle:nth-child(2) {
    top: 60%;
    left: 80%;
    animation: sparkle 2s infinite 0.6s;
  }

  .magic-sparkle:nth-child(3) {
    top: 40%;
    left: 50%;
    animation: sparkle 2s infinite 0.9s;
  }

  .magic-sparkle:nth-child(4) {
    top: 80%;
    left: 30%;
    animation: sparkle 2s infinite 1.2s;
  }

  .magic-sparkle:nth-child(5) {
    top: 30%;
    left: 90%;
    animation: sparkle 2s infinite 1.5s;
  }

  .sync-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-left: 8px;
  }

  .sync-indicator.online {
    background-color: #2ecc71;
  }

  .sync-indicator.offline {
    background-color: #e74c3c;
  }

  .sync-indicator.syncing {
    background-color: #f39c12;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }

  .magic-points-indicator {
    animation: magical-glow 2s infinite;
  }

  .magic-exceeded .magic-points-value {
    color: #9b59b6;
    text-shadow: 0 0 5px rgba(155, 89, 182, 0.7);
  }
`;

const MagicPointsDisplay = () => {
  const { 
    magicPoints, 
    addPoints, 
    removePoints, 
    isOnline, 
    isSyncing,
    lastSynced,
    pendingChanges,
    pendingOperations,
    forceSync,
    hasExceeded,
    logCurrentPoints
  } = useMagicPoints();
  
  const [prevPoints, setPrevPoints] = useState(magicPoints);
  const [showPointChange, setShowPointChange] = useState(false);
  const [pointChangeAmount, setPointChangeAmount] = useState(0);
  const pointChangeTimeoutRef = useRef(null);

  // Add the styles when component mounts
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = magicPointsStyles;
    document.head.appendChild(style);
    
    // Log points on component mount for debugging
    logCurrentPoints();
    
    return () => {
      document.head.removeChild(style);
    };
  }, [logCurrentPoints]);
  
  // Track point changes to show animations
  useEffect(() => {
    if (prevPoints !== magicPoints) {
      const pointDiff = magicPoints - prevPoints;
      
      // Only show animation for non-zero changes
      if (pointDiff !== 0) {
        // Clear previous timeout if still running
        if (pointChangeTimeoutRef.current) {
          clearTimeout(pointChangeTimeoutRef.current);
        }
        
        setPointChangeAmount(pointDiff);
        setShowPointChange(true);
        
        // Hide after animation completes
        pointChangeTimeoutRef.current = setTimeout(() => {
          setShowPointChange(false);
        }, 1500);
      }
      
      setPrevPoints(magicPoints);
    }
    
    return () => {
      if (pointChangeTimeoutRef.current) {
        clearTimeout(pointChangeTimeoutRef.current);
      }
    };
  }, [magicPoints, prevPoints]);

  // Format the last synced time
  const formatLastSynced = () => {
    if (!lastSynced) return "Never";
    const date = new Date(lastSynced);
    return date.toLocaleTimeString();
  };

  // Get sync status indicator
  const getSyncStatus = () => {
    if (!isOnline) return "offline";
    if (isSyncing) return "syncing";
    return "online";
  };

  // Get progress percentage (can exceed 100%)
  const progressPercent = Math.min(magicPoints, 100);

  return (
    <Box 
      className={`magic-points-container ${hasExceeded ? 'magic-exceeded' : ''}`}
      borderRadius="lg"
      p={4}
      bg="rgba(20, 23, 46, 0.8)"
      border="1px solid var(--panel-border)"
      boxShadow="0 4px 8px rgba(0,0,0,0.3)"
      position="relative"
      overflow="hidden"
      mb={4}
    >
      {/* Decorative sparkles */}
      <div className="magic-sparkle"></div>
      <div className="magic-sparkle"></div>
      <div className="magic-sparkle"></div>
      <div className="magic-sparkle"></div>
      <div className="magic-sparkle"></div>
      
      {/* Point change animation */}
      {showPointChange && (
        <div className={`point-change ${pointChangeAmount > 0 ? 'increase' : 'decrease'}`}>
          {pointChangeAmount > 0 ? `+${pointChangeAmount}` : pointChangeAmount}
        </div>
      )}

      <Flex justifyContent="space-between" alignItems="center" mb={3}>
        <Text 
          fontFamily="'Cinzel', serif"
          fontSize="lg"
          fontWeight="bold"
          color="var(--secondary-color)"
        >
          Magic Points 
          <span className={`sync-indicator ${getSyncStatus()}`} title={`Status: ${getSyncStatus()}`}></span>
        </Text>

        {pendingChanges && (
          <Badge 
            colorScheme="yellow" 
            variant="solid" 
            borderRadius="full" 
            px={2}
            fontSize="xs"
          >
            Pending Sync
          </Badge>
        )}
      </Flex>

      <Box 
        className="magic-points-indicator"
        bg="rgba(16, 25, 56, 0.7)"
        borderRadius="md"
        p={3}
        textAlign="center"
        position="relative"
        mb={3}
      >
        <Text 
          className="magic-points-value"
          fontSize="2xl" 
          fontWeight="bold"
          color={hasExceeded ? "#9b59b6" : "var(--secondary-color)"}
        >
          {magicPoints}
        </Text>

        {hasExceeded && (
          <Badge 
            colorScheme="purple" 
            variant="solid" 
            borderRadius="full" 
            position="absolute"
            top="-10px"
            right="-10px"
            px={2}
          >
            Exceeded!
          </Badge>
        )}
      </Box>

      {/* Progress Bar */}
      <Box position="relative" mb={4}>
        <Progress 
          value={progressPercent} 
          size="sm"
          colorScheme={hasExceeded ? "purple" : "yellow"} 
          bg="rgba(0,0,0,0.2)" 
          borderRadius="md"
        />
        
        {/* Extra progress indicator for points above 100 */}
        {hasExceeded && (
          <Box
            position="absolute"
            top="0"
            left="0"
            height="100%"
            width="100%"
            pointerEvents="none"
            pl="100%"
            overflow="hidden"
          >
            <Text
              fontSize="xs"
              color="#9b59b6"
              position="absolute"
              top="4px"
              left="calc(100% + 5px)"
              whiteSpace="nowrap"
            >
              +{magicPoints - 100}
            </Text>
          </Box>
        )}
      </Box>

      <Flex justifyContent="space-between">
        <Flex>
          <Button
            onClick={() => removePoints(10)}
            size="sm"
            variant="outline"
            colorScheme="red"
            mr={2}
            fontFamily="'Cinzel', serif"
          >
            -10
          </Button>
          <Button
            onClick={() => removePoints(5)}
            size="sm"
            variant="outline"
            colorScheme="red"
            mr={2}
            fontFamily="'Cinzel', serif"
          >
            -5
          </Button>
        </Flex>

        <Flex>
          <Button
            onClick={() => addPoints(5)}
            size="sm"
            variant="outline"
            colorScheme="green"
            ml={2}
            fontFamily="'Cinzel', serif"
          >
            +5
          </Button>
          <Button
            onClick={() => addPoints(10)}
            size="sm"
            variant="outline"
            colorScheme="green"
            ml={2}
            fontFamily="'Cinzel', serif"
          >
            +10
          </Button>
        </Flex>
      </Flex>

      <Flex justifyContent="center" mt={2}>
        <Tooltip label="Show debug info in console">
          <Button
            onClick={() => {
              console.log('[DEBUG] Magic Points State:', {
                magicPoints,
                isOnline,
                isSyncing, 
                lastSynced,
                pendingChanges,
                pendingOperations: pendingOperations.length
              });
              logCurrentPoints();
            }}
            size="xs"
            colorScheme="blue"
            mr={2}
          >
            Debug
          </Button>
        </Tooltip>
        
        <Tooltip label={isOnline ? "Force sync to server" : "You are offline"}>
          <Button
            onClick={forceSync}
            size="xs"
            variant="ghost"
            isDisabled={!isOnline || isSyncing}
            opacity={0.8}
            color="var(--text-primary)"
          >
            {isSyncing ? "Syncing..." : `Last synced: ${formatLastSynced()}`}
          </Button>
        </Tooltip>
      </Flex>
    </Box>
  );
};

export default MagicPointsDisplay;
