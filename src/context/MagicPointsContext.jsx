import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchMagicPoints, updateMagicPoints, syncMagicPointsOperations, USE_OFFLINE_MODE } from "../api/magicPointsApi";

// Create context
const MagicPointsContext = createContext();

// Custom hook for using the Magic Points context
export const useMagicPoints = () => useContext(MagicPointsContext);

export const MagicPointsProvider = ({ children }) => {
  const [magicPoints, setMagicPoints] = useState(100); // Default to 100
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncRetries, setSyncRetries] = useState(0);
  const MAX_RETRIES = 5;

  // Track Revelio attempts for each blank - key is blankId, value is whether it's first attempt
  const [revelioAttempts, setRevelioAttempts] = useState({});
  // Track correctly answered blanks to avoid double counting
  const [correctBlanks, setCorrectBlanks] = useState({});

  // Load authentication state from localStorage
  useEffect(() => {
    const authState = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authState === 'true');

    // Also load pending operations
    const savedOperations = localStorage.getItem('pendingOperations');
    if (savedOperations) {
      setPendingOperations(JSON.parse(savedOperations));
    }
    
    // Load stored magic points from localStorage as backup
    const storedPoints = localStorage.getItem('magicPoints');
    if (storedPoints) {
      const parsedPoints = parseInt(storedPoints, 10);
      // Ensure points are never less than 0
      setMagicPoints(parsedPoints >= 0 ? parsedPoints : 100);
    } else {
      // If no stored points, initialize to 100
      localStorage.setItem('magicPoints', '100');
    }
    
    // Load stored revelio attempts from localStorage
    const storedRevelioAttempts = localStorage.getItem('revelioAttempts');
    if (storedRevelioAttempts) {
      setRevelioAttempts(JSON.parse(storedRevelioAttempts));
    }
    
    // Load stored correct blanks from localStorage
    const storedCorrectBlanks = localStorage.getItem('correctBlanks');
    if (storedCorrectBlanks) {
      setCorrectBlanks(JSON.parse(storedCorrectBlanks));
    }
    
    // Set up online/offline event listeners with improved handlers
    const handleOnline = () => {
      console.log('[POINTS] Back online, attempting to sync');
      setIsOnline(true);
      // Attempt to sync when coming back online
      if (pendingOperations.length > 0 || pendingChanges) {
        setTimeout(() => syncToServer(), 1000);
      }
    };
    
    const handleOffline = () => {
      console.log('[POINTS] Device went offline, pausing sync operations');
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Clean up event listeners properly
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync to server with enhanced reliability
  const syncToServer = useCallback(async () => {
    // Create a local reference to the current retry count that remains stable for this function call
    const currentRetryAttempt = parseInt(localStorage.getItem('syncRetryCount') || '0', 10);
    
    if (isSyncing || !isOnline) {
      console.log(`[POINTS] Sync aborted - isSyncing: ${isSyncing}, isOnline: ${isOnline}`);
      return;
    }

    // Only attempt to sync if there are actual changes to sync
    if (!pendingChanges && pendingOperations.length === 0) {
      console.log('[POINTS] No changes to sync, skipping sync operation');
      return;
    }

    setIsSyncing(true);
    console.log(`[POINTS] Starting sync to server (attempt ${currentRetryAttempt + 1}/${MAX_RETRIES})`);

    try {
      if (pendingOperations.length > 0) {
        const sortedOperations = [...pendingOperations].sort((a, b) =>
          new Date(a.timestamp) - new Date(b.timestamp)
        );

        try {
          // Use sync operations endpoint instead of fetching first
          console.log(`[POINTS] Syncing ${sortedOperations.length} operations to server:`, 
            sortedOperations.map(op => `${op.type}:${op.amount}`).join(', '));
          
          // Clone operations to prevent potential mutations
          const operationsToSync = JSON.parse(JSON.stringify(sortedOperations));
          
          // Verify token exists before syncing
          const token = localStorage.getItem('token');
          if (!token) {
            console.log('[POINTS] No auth token found, skipping server sync');
            throw new Error('Authentication required');
          }
          
          const response = await syncMagicPointsOperations(operationsToSync);
          const { magicPoints: serverPoints } = response;

          // Clear pending operations only after successful sync
          setPendingOperations([]);
          localStorage.removeItem('pendingOperations');

          setMagicPoints(serverPoints);
          localStorage.setItem('magicPoints', serverPoints);
          console.log(`[POINTS] Synced all operations, new point value: ${serverPoints}`);
          
          // Reset retry counter on success
          localStorage.setItem('syncRetryCount', '0');
          setSyncRetries(0);
        } catch (error) {
          console.error(`[POINTS] Error during sync operations: ${error.message}`);
          throw error;
        }
      } else if (pendingChanges) {
        console.log(`[POINTS] No pending operations, updating points directly to: ${magicPoints}`);
        
        // Verify token exists before syncing
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('[POINTS] No auth token found, skipping server sync');
          throw new Error('Authentication required');
        }
        
        const response = await updateMagicPoints(magicPoints);
        console.log(`[POINTS] Updated points directly to: ${response.magicPoints}`);
        
        // Reset retry counter on success
        localStorage.setItem('syncRetryCount', '0');
        setSyncRetries(0);
      } else {
        console.log('[POINTS] No pending changes or operations to sync');
        // Reset retry counter as there's nothing to sync
        localStorage.setItem('syncRetryCount', '0');
        setSyncRetries(0);
      }

      const now = new Date().toISOString();
      localStorage.setItem('magicPointsTimestamp', now);
      setLastSynced(now);
      setPendingChanges(false);

    } catch (error) {
      console.error(`[POINTS] Error syncing magic points: ${error.message}`);
      
      // Use the captured retry count to calculate the next value
      const nextRetryCount = currentRetryAttempt + 1;
      console.log(`[POINTS] Setting retry count from ${currentRetryAttempt} to ${nextRetryCount}`);
      
      // Update both state and localStorage
      setSyncRetries(nextRetryCount);
      localStorage.setItem('syncRetryCount', nextRetryCount.toString());
      
      if (nextRetryCount < MAX_RETRIES) {
        const retryDelay = Math.min(1000 * (2 ** nextRetryCount), 30000);
        console.log(`[POINTS] Will retry sync in ${retryDelay}ms (attempt ${nextRetryCount + 1}/${MAX_RETRIES})`);
        
        // Only set up retry if we're still online
        setTimeout(() => {
          if (isOnline) {
            // By this time, isSyncing should be false due to the finally block
            if (!isSyncing) {
              console.log(`[POINTS] Executing retry #${nextRetryCount + 1} with retry count ${nextRetryCount}`);
              syncToServer();
            } else {
              console.log(`[POINTS] Skipping retry #${nextRetryCount + 1} - sync already in progress`);
            }
          } else {
            console.log(`[POINTS] Skipping retry #${nextRetryCount + 1} - offline`);
          }
        }, retryDelay);
      } else {
        console.log(`[POINTS] Max retries (${MAX_RETRIES}) reached, giving up sync`);
        // Store points locally to prevent complete loss
        localStorage.setItem('magicPoints', magicPoints);
        
        // We should keep pending operations for future sync attempts
        console.log(`[POINTS] Keeping ${pendingOperations.length} operations for future sync attempts`);
        
        // Reset the retry counter to allow future attempts
        localStorage.setItem('syncRetryCount', '0');
        setSyncRetries(0);
        setPendingChanges(false);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, pendingOperations, pendingChanges, magicPoints]);

  const addPoints = useCallback((amount, source = '') => {
    if (amount <= 0) return;
    
    const newPoints = magicPoints + amount;
    setMagicPoints(newPoints);
    localStorage.setItem('magicPoints', newPoints);
    setPendingChanges(true);
    
    const operation = {
      type: 'add',
      amount,
      source,
      timestamp: new Date().toISOString()
    };
    
    setPendingOperations(prev => {
      const updated = [...prev, operation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Only attempt to sync if we're online and authenticated
    if (isOnline && isAuthenticated) {
      syncToServer();
    } else {
      console.log('[POINTS] Working in offline mode, changes will sync when online');
    }
  }, [magicPoints, isOnline, isAuthenticated, syncToServer]);

  const removePoints = useCallback((amount, source = '') => {
    if (amount <= 0) return;
    
    const newPoints = Math.max(0, magicPoints - amount);
    setMagicPoints(newPoints);
    localStorage.setItem('magicPoints', newPoints);
    setPendingChanges(true);
    
    const operation = {
      type: 'remove',
      amount,
      source,
      timestamp: new Date().toISOString()
    };
    
    setPendingOperations(prev => {
      const updated = [...prev, operation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Only attempt to sync if we're online and authenticated
    if (isOnline && isAuthenticated) {
      syncToServer();
    } else {
      console.log('[POINTS] Working in offline mode, changes will sync when online');
    }
  }, [magicPoints, isOnline, isAuthenticated, syncToServer]);

  const addPointsWithLog = useCallback((amount, source = 'general') => {
    console.log(`[POINTS] Adding ${amount} points (${source})`);
    addPoints(amount, source);
  }, [addPoints]);

  const removePointsWithLog = useCallback((amount, source = 'general') => {
    console.log(`[POINTS] Removing ${amount} points (${source})`);
    removePoints(amount, source);
  }, [removePoints]);

  // Reset all Revelio attempts for a new exercise
  const resetRevelioAttempts = useCallback((blankIds = []) => {
    console.log(`[POINTS] Resetting Revelio attempts. Specific blanks: ${blankIds.length > 0 ? blankIds.join(', ') : 'none (all)'}`);
    
    if (blankIds.length === 0) {
      // Reset all blanks if no specific IDs provided
      console.log('[POINTS] Resetting all revelioAttempts and correctBlanks');
      setRevelioAttempts({});
      setCorrectBlanks({});
      localStorage.removeItem('revelioAttempts');
      localStorage.removeItem('correctBlanks');
    } else {
      // Reset only specific blanks
      const newRevelioAttempts = { ...revelioAttempts };
      const newCorrectBlanks = { ...correctBlanks };
      
      blankIds.forEach(id => {
        newRevelioAttempts[id] = true; // true means it's ready for first attempt
        delete newCorrectBlanks[id]; // Remove from correct blanks
      });
      
      setRevelioAttempts(newRevelioAttempts);
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
      console.log('[POINTS] Updated revelioAttempts:', newRevelioAttempts);
      console.log('[POINTS] Updated correctBlanks:', newCorrectBlanks);
    }
  }, [revelioAttempts, correctBlanks]);
  
  // Add a new function to process blank submissions with rewards for correct answers
  const processBlankSubmission = useCallback((blankId, isCorrect) => {
    console.log(`[POINTS] Processing Revelio for blank ${blankId}. Is correct: ${isCorrect}, State: ${revelioAttempts[blankId]}`);
    
    // Check if this is the first attempt for this blank
    const isFirstAttempt = revelioAttempts[blankId] === undefined || revelioAttempts[blankId] === true;
    console.log(`[POINTS] Is first attempt for ${blankId}: ${isFirstAttempt}`);
    
    // Updated rewards system:
    // - Correct on first attempt: +5 points
    // - Correct after first attempt: +2 points
    // - Incorrect: -5 points (reduced from -10)
    
    if (isCorrect) {
      if (isFirstAttempt) {
        console.log(`[POINTS] Blank ${blankId} correctly answered on first attempt, adding 5 points`);
        addPointsWithLog(5, `correct_first_${blankId}`);
      } else {
        console.log(`[POINTS] Blank ${blankId} correctly answered after attempts, adding 2 points`);
        addPointsWithLog(2, `correct_retry_${blankId}`);
      }
      
      // Add to correct blanks
      const newCorrectBlanks = { ...correctBlanks, [blankId]: true };
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
    } else {
      console.log(`[POINTS] Blank ${blankId} incorrect answer, removing 5 points`);
      removePointsWithLog(5, `incorrect_${blankId}`);
      
      // Mark as no longer first attempt
      console.log(`[POINTS] Marking ${blankId} as no longer first attempt`);
      const newRevelioAttempts = { ...revelioAttempts, [blankId]: false };
      setRevelioAttempts(newRevelioAttempts);
      localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
    }
    
    console.log('[POINTS] Updated revelioAttempts:', revelioAttempts);
    console.log('[POINTS] Updated correctBlanks:', correctBlanks);
    
    return isCorrect;
  }, [revelioAttempts, correctBlanks, addPointsWithLog, removePointsWithLog]);
  
  // Add batch processing for multiple blanks
  const processMultipleBlanks = useCallback((results) => {
    console.log('[POINTS] Processing multiple blanks submission:', results);
    
    let correctCount = 0;
    let processingPromises = [];
    
    // Process each blank
    Object.entries(results).forEach(([blankId, isCorrect]) => {
      if (isCorrect) correctCount++;
      processingPromises.push(processBlankSubmission(blankId, isCorrect));
    });
    
    // Add bonus points for high percentage correct
    const totalBlanks = Object.keys(results).length;
    const percentCorrect = (correctCount / totalBlanks) * 100;
    
    // Bonus points for getting 80%+ correct
    if (percentCorrect >= 80 && totalBlanks >= 3) {
      const bonus = Math.ceil(totalBlanks * 0.5); // 0.5 point per blank rounded up
      console.log(`[POINTS] High accuracy bonus! ${percentCorrect.toFixed(1)}% correct, adding ${bonus} points`);
      addPointsWithLog(bonus, 'high_accuracy_bonus');
    }
    
    return Promise.all(processingPromises);
  }, [processBlankSubmission, addPointsWithLog]);

  // Handle Revelio attempts for fill-in-the-blank activities
  const handleBlankRevelioAttempt = useCallback((blankId, isCorrect) => {
    console.log(`[POINTS] Processing Revelio for blank ${blankId}. Is correct: ${isCorrect}`);
    
    // Check if this blank has already been answered correctly previously
    if (correctBlanks[blankId]) {
      console.log(`[POINTS] Blank ${blankId} was already answered correctly, skipping scoring`);
      return isCorrect;
    }
    
    // Check if this is the first attempt for this blank
    const isFirstAttempt = revelioAttempts[blankId] === undefined || revelioAttempts[blankId] === true;
    console.log(`[POINTS] Is first attempt for ${blankId}: ${isFirstAttempt}`);
    
    // Scoring rules:
    // - First attempt: -10 points for wrong, no points for correct
    // - Second+ attempt: +10 points for correcting previously wrong, -10 points for any wrong
    
    if (isCorrect) {
      if (!isFirstAttempt) {
        // This is a correction of a previously wrong answer, award points
        console.log(`[POINTS] Blank ${blankId} corrected after initial wrong attempt, adding 10 points`);
        addPointsWithLog(10, `revelio_correction_${blankId}`);
      } else {
        console.log(`[POINTS] Blank ${blankId} correctly answered on first attempt, no points awarded`);
      }
      
      // Add to correct blanks to avoid double counting
      const newCorrectBlanks = { ...correctBlanks, [blankId]: true };
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
    } else {
      // Always deduct points for wrong answers
      console.log(`[POINTS] Blank ${blankId} answered incorrectly, removing 10 points`);
      removePointsWithLog(10, `revelio_incorrect_${blankId}`);
      
      // Mark as no longer first attempt
      console.log(`[POINTS] Marking ${blankId} as no longer first attempt`);
      const newRevelioAttempts = { ...revelioAttempts, [blankId]: false };
      setRevelioAttempts(newRevelioAttempts);
      localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
    }
    
    console.log('[POINTS] Updated revelioAttempts:', revelioAttempts);
    console.log('[POINTS] Updated correctBlanks:', correctBlanks);
    
    return isCorrect;
  }, [revelioAttempts, correctBlanks, addPointsWithLog, removePointsWithLog]);
  
  // Handle multiple blanks submission for Charm the Blanks activity
  const handleMultipleRevelioAttempts = useCallback((results) => {
    console.log('[POINTS] Processing multiple blanks submission:', results);
    
    let processingPromises = [];
    
    // Process each blank
    Object.entries(results).forEach(([blankId, isCorrect]) => {
      processingPromises.push(handleBlankRevelioAttempt(blankId, isCorrect));
    });
    
    return Promise.all(processingPromises);
  }, [handleBlankRevelioAttempt]);
  
  // Handle inequality format checks
  const handleInequalityFormatCheck = useCallback((isValid, index) => {
    console.log(`[POINTS] Checking inequality ${index} format: ${isValid ? 'valid' : 'invalid'}`);
    
    if (!isValid) {
      // Deduct points for invalid format
      removePointsWithLog(10, `inequality_format_invalid_${index}`);
      return false;
    }
    
    // No points awarded for correct format
    console.log(`[POINTS] Inequality ${index} format is valid, no points awarded`);
    return true;
  }, [removePointsWithLog]);
  
  // Handle inequality solution checks
  const handleInequalitySolutionCheck = useCallback((systemHasSolution, selectedNoSolution, isSolutionCorrect) => {
    console.log(`[POINTS] Checking inequality solution:
      System has solution: ${systemHasSolution}
      Selected No Solution: ${selectedNoSolution}
      Is solution correct: ${isSolutionCorrect}`);
    
    // Case 1: System has no solution but user didn't select "No solution"
    if (!systemHasSolution && !selectedNoSolution) {
      removePointsWithLog(10, 'inequality_missed_no_solution');
      return false;
    }
    
    // Case 2: System has solution but user either selected "No solution" or entered wrong coordinates
    if (systemHasSolution && (!isSolutionCorrect || selectedNoSolution)) {
      removePointsWithLog(10, 'inequality_wrong_solution');
      return false;
    }
    
    // No points awarded for correct solution
    console.log('[POINTS] Inequality solution is correct, no points awarded');
    return true;
  }, [removePointsWithLog]);

  // Utility function to log current points state (for debugging)
  const logCurrentPoints = useCallback(() => {
    console.log(`[POINTS] Current magic points: ${magicPoints}`);
    console.log(`[POINTS] Pending operations: ${pendingOperations.length}`);
    console.log(`[POINTS] Last synced: ${lastSynced || 'never'}`);
    console.log(`[POINTS] Is online: ${isOnline}, Is syncing: ${isSyncing}`);
    return {
      magicPoints,
      pendingOperations,
      lastSynced,
      isOnline,
      isSyncing
    };
  }, [magicPoints, pendingOperations, lastSynced, isOnline, isSyncing]);

  // Force a sync to the server (manual trigger)
  const forceSync = useCallback(() => {
    if (!isOnline) {
      console.log('[POINTS] Cannot force sync - device is offline');
      return;
    }
    
    console.log('[POINTS] Force syncing points to server');
    return syncToServer();
  }, [isOnline, syncToServer]);

  // Add debugging utility functions
  const debugPointsState = useCallback(() => {
    console.log('[POINTS DEBUG] Current state:');
    console.log(`- Magic Points: ${magicPoints}`);
    console.log(`- Online Status: ${isOnline ? 'Online' : 'Offline'}`);
    console.log(`- Authentication Status: ${isAuthenticated ? 'Authenticated' : 'Not Authenticated'}`);
    console.log(`- Syncing Status: ${isSyncing ? 'Syncing' : 'Idle'}`);
    console.log(`- Pending Operations: ${pendingOperations.length}`);
    console.log(`- Last Synced: ${lastSynced || 'Never'}`);
    
    // Return debug data for UI display
    return {
      magicPoints,
      isOnline,
      isAuthenticated,
      isSyncing,
      pendingOperations,
      lastSynced,
      revelioAttempts,
      correctBlanks
    };
  }, [magicPoints, isOnline, isAuthenticated, isSyncing, pendingOperations, lastSynced, revelioAttempts, correctBlanks]);
  
  // Force sync with debug information
  const forceSyncWithDebug = useCallback(async () => {
    console.log('[POINTS DEBUG] Force syncing with debug info...');
    
    // Log auth state
    const token = localStorage.getItem('token');
    console.log(`[POINTS DEBUG] Auth token: ${token ? 'Present' : 'Missing'}`);
    
    // Log pending operations
    console.log(`[POINTS DEBUG] Pending operations: ${pendingOperations.length}`);
    if (pendingOperations.length > 0) {
      console.log(pendingOperations);
    }
    
    try {
      await syncToServer();
      return true;
    } catch (error) {
      console.error('[POINTS DEBUG] Sync error:', error);
      return false;
    }
  }, [pendingOperations, syncToServer]);
  
  // Reset points to 100
  const resetPoints = useCallback(async () => {
    console.log('[POINTS DEBUG] Resetting points to 100');
    
    // Reset local state
    setMagicPoints(100);
    localStorage.setItem('magicPoints', '100');
    
    // Add a reset operation
    const resetOperation = {
      type: 'set',
      amount: 100,
      source: 'debug_reset',
      timestamp: new Date().toISOString()
    };
    
    setPendingOperations(prev => {
      const updated = [...prev, resetOperation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Force sync if online
    if (isOnline && isAuthenticated) {
      try {
        await syncToServer();
        return true;
      } catch (error) {
        console.error('[POINTS DEBUG] Error syncing after reset:', error);
        return false;
      }
    } else {
      console.log('[POINTS DEBUG] Working offline, changes will sync when online');
      return true;
    }
  }, [isOnline, isAuthenticated, syncToServer]);
  
  // Update authentication status (for debugging purposes)
  const updateAuthentication = useCallback((authData) => {
    if (authData) {
      console.log('[POINTS DEBUG] Setting authenticated state');
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authToken', authData.token);
      localStorage.setItem('token', authData.token);
    } else {
      console.log('[POINTS DEBUG] Clearing authenticated state');
      setIsAuthenticated(false);
      localStorage.setItem('isAuthenticated', 'false');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
    }
  }, []);
  
  // Add offline mode detection property
  const isOfflineMode = USE_OFFLINE_MODE || !isOnline || !isAuthenticated;

  return (
    <MagicPointsContext.Provider value={{
      magicPoints,
      addPoints,
      removePoints,
      addPointsWithLog,
      removePointsWithLog,
      isOnline,
      isSyncing,
      lastSynced,
      pendingChanges,
      pendingOperations,
      resetRevelioAttempts,
      handleBlankRevelioAttempt,
      handleMultipleRevelioAttempts,
      handleInequalityFormatCheck,
      handleInequalitySolutionCheck,
      processBlankSubmission, // Keep for backward compatibility
      processMultipleBlanks,  // Keep for backward compatibility
      logCurrentPoints,
      forceSync,
      debugPointsState,
      forceSyncWithDebug,
      resetPoints,
      updateAuthentication,
      isOfflineMode,
      isAuthenticated
    }}>
      {children}
    </MagicPointsContext.Provider>
  );
};
