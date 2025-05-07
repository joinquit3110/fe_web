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
  
  @keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
  }
  
  @keyframes reset-pulse {
    0% { background-color: transparent; }
    25% { background-color: rgba(220, 53, 69, 0.6); box-shadow: 0 0 25px rgba(220, 53, 69, 0.8); }
    75% { background-color: rgba(220, 53, 69, 0.6); box-shadow: 0 0 25px rgba(220, 53, 69, 0.8); }
    100% { background-color: transparent; }
  }
  
  @keyframes major-increase-pulse {
    0% { background-color: transparent; }
    25% { background-color: rgba(40, 167, 69, 0.6); box-shadow: 0 0 25px rgba(40, 167, 69, 0.8); }
    75% { background-color: rgba(40, 167, 69, 0.6); box-shadow: 0 0 25px rgba(40, 167, 69, 0.8); }
    100% { background-color: transparent; }
  }
  
  @keyframes major-decrease-pulse {
    0% { background-color: transparent; }
    25% { background-color: rgba(255, 193, 7, 0.6); box-shadow: 0 0 25px rgba(255, 193, 7, 0.8); }
    75% { background-color: rgba(255, 193, 7, 0.6); box-shadow: 0 0 25px rgba(255, 193, 7, 0.8); }
    100% { background-color: transparent; }
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
  
  .magic-points-indicator.reset-pulse {
    animation: reset-pulse 3s ease-in-out, shake 0.5s cubic-bezier(.36,.07,.19,.97) both !important;
  }
  
  .magic-points-indicator.major-increase {
    animation: major-increase-pulse 3s ease-in-out !important;
  }
  
  .magic-points-indicator.major-decrease {
    animation: major-decrease-pulse 3s ease-in-out !important;
  }
  
  .magic-points-indicator.admin-reset {
    background-color: rgba(220, 53, 69, 0.3);
    border: 2px solid rgba(220, 53, 69, 0.8);
  }
  
  .magic-points-indicator.admin-update {
    background-color: rgba(52, 152, 219, 0.3);
    border: 2px solid rgba(52, 152, 219, 0.8);
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
        
        // Create extra visual effects for major changes or resets
        const isReset = magicPoints === 100 && prevPoints !== 100 && prevPoints !== 0;
        const isMajorChange = Math.abs(pointDiff) >= 20;
        
        // Add extra visual feedback for major changes
        if (isReset || isMajorChange) {
          try {
            // Add pulsing background to the points display
            const pointsDisplay = document.querySelector('.magic-points-indicator');
            if (pointsDisplay) {
              // Add intense pulse animation
              pointsDisplay.style.animation = 'none'; // Reset animation
              void pointsDisplay.offsetWidth; // Trigger reflow
              
              const animationType = isReset ? 'reset-pulse' : (pointDiff > 0 ? 'major-increase' : 'major-decrease');
              pointsDisplay.classList.add(animationType);
              
              // Remove the animation class after it completes
              setTimeout(() => {
                pointsDisplay.classList.remove(animationType);
                pointsDisplay.style.animation = 'magical-glow 2s infinite';
              }, 3000);
            }
          } catch (error) {
            console.error('Error creating visual effects:', error);
          }
        }
        
        // Hide after animation completes
        pointChangeTimeoutRef.current = setTimeout(() => {
          setShowPointChange(false);
        }, 1500);
      }
      
      setPrevPoints(magicPoints);
    }
  }, [magicPoints, prevPoints]);
  
  // Listen for direct socket updates to sync display with server value 
  useEffect(() => {
    const handleDirectPointsUpdate = (event) => {
      console.log('[POINTS_DISPLAY] Received direct points update event:', event.detail);
      
      // If we receive a direct update from the server with a different points value
      if (event.detail?.points !== undefined) {
        const newPoints = parseInt(event.detail.points, 10);
        if (!isNaN(newPoints)) {
          console.log(`[POINTS_DISPLAY] Updating points display from ${magicPoints} to ${newPoints}`);
          
          // Calculate point difference for animation
          const pointDiff = newPoints - magicPoints;
          if (pointDiff !== 0) {
            // Clear previous timeout if still running
            if (pointChangeTimeoutRef.current) {
              clearTimeout(pointChangeTimeoutRef.current);
            }
            
            setPointChangeAmount(pointDiff);
            setShowPointChange(true);
            
            // Add special visual effect for big changes
            const isMajorChange = Math.abs(pointDiff) >= 20;
            const isReset = newPoints === 100 && magicPoints !== 100;
            
            if (isMajorChange || isReset) {
              try {
                const pointsDisplay = document.querySelector('.magic-points-indicator');
                if (pointsDisplay) {
                  // Reset animation
                  pointsDisplay.style.animation = 'none';
                  void pointsDisplay.offsetWidth; // Trigger reflow
                  
                  // Apply appropriate animation
                  if (isReset) {
                    pointsDisplay.classList.add('reset-pulse');
                    setTimeout(() => pointsDisplay.classList.remove('reset-pulse'), 3000);
                  } else if (pointDiff > 0) {
                    pointsDisplay.classList.add('major-increase');
                    setTimeout(() => pointsDisplay.classList.remove('major-increase'), 3000);
                  } else {
                    pointsDisplay.classList.add('major-decrease');
                    setTimeout(() => pointsDisplay.classList.remove('major-decrease'), 3000);
                  }
                }
              } catch (error) {
                console.error('[POINTS_DISPLAY] Animation error:', error);
              }
            }
            
            // Hide after animation completes
            pointChangeTimeoutRef.current = setTimeout(() => {
              setShowPointChange(false);
            }, 1500);
          }
          
          // Update the previous points to match the new value
          setPrevPoints(newPoints);
        }
      }
    };
    
    // Listen for all possible point update events
    window.addEventListener('magicPointsUpdated', handleDirectPointsUpdate);
    window.addEventListener('serverSyncCompleted', handleDirectPointsUpdate);
    window.addEventListener('magicPointsUIUpdate', handleDirectPointsUpdate);
    
    // Listen for house points updates (these affect user's house total)
    window.addEventListener('house-points-update', (event) => {
      console.log('[POINTS_DISPLAY] Received house-points-update event:', event.detail);
      
      // This might not update local points directly, but we should refresh
      // our display to stay in sync with the latest server value
      setTimeout(() => {
        if (typeof logCurrentPoints === 'function') {
          logCurrentPoints();
        }
      }, 500);
    });
    
    return () => {
      window.removeEventListener('magicPointsUpdated', handleDirectPointsUpdate);
      window.removeEventListener('serverSyncCompleted', handleDirectPointsUpdate);
      window.removeEventListener('magicPointsUIUpdate', handleDirectPointsUpdate);
      window.removeEventListener('house-points-update', handleDirectPointsUpdate);
    };
  }, [magicPoints, logCurrentPoints]);

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
