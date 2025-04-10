import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { 
  fetchMagicPoints, 
  updateMagicPoints, 
  syncMagicPointsOperations, 
  USE_OFFLINE_MODE,
  checkAuthStatus 
} from "../api/magicPointsApi";

// Create context
const MagicPointsContext = createContext();

// Custom hook for using the Magic Points context
export const useMagicPoints = () => useContext(MagicPointsContext);

// Define MAX_RETRIES as a constant outside the component to avoid reference errors
const MAX_RETRIES = 5;

export const MagicPointsProvider = ({ children }) => {
  const [magicPoints, setMagicPoints] = useState(100); // Default to 100
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncRetries, setSyncRetries] = useState(0);

  // Track Revelio attempts for each blank - key is blankId, value is whether it's first attempt
  const [revelioAttempts, setRevelioAttempts] = useState({});
  // Track correctly answered blanks to avoid double counting
  const [correctBlanks, setCorrectBlanks] = useState({});

  // Load authentication state from localStorage
  useEffect(() => {
    const authState = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authState === 'true');

    // Verify authentication status with server
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuthStatus();
        console.log('[POINTS] Auth verification result:', authStatus);
        
        if (authStatus.authenticated) {
          setIsAuthenticated(true);
          localStorage.setItem('isAuthenticated', 'true');
          
          // If authenticated, check for pending operations to auto-sync
          const pendingOps = localStorage.getItem('pendingOperations');
          if (pendingOps && JSON.parse(pendingOps).length > 0) {
            console.log('[POINTS] Found pending operations on load, triggering auto-sync');
            // Use a slight delay to ensure all states are properly initialized
            setTimeout(() => syncToServer(), 1500);
          } else {
            console.log('[POINTS] No pending operations found on load');
          }
        } else {
          console.warn(`[POINTS] Auth verification failed: ${authStatus.reason}`);
          // Don't immediately set to false - we'll rely on API call failures for that
        }
      } catch (error) {
        console.error('[POINTS] Error verifying auth:', error);
      }
    };
    
    if (authState === 'true' && navigator.onLine) {
      verifyAuth();
    }

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

  // Also add an initial sync attempt at the end of the useEffect
  useEffect(() => {
    // Auto-sync on app load if online and authenticated
    if (isOnline && isAuthenticated && pendingOperations.length > 0) {
      console.log('[POINTS] Auto-syncing points on app initialization');
      // Use timeout to ensure the component is fully mounted
      const autoSyncTimeout = setTimeout(() => {
        syncToServer();
      }, 2000);
      
      return () => clearTimeout(autoSyncTimeout);
    }
  }, [isOnline, isAuthenticated, pendingOperations.length, syncToServer]);

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
          const token = localStorage.getItem('token') || localStorage.getItem('authToken');
          if (!token) {
            console.log('[POINTS] No auth token found, skipping server sync');
            throw new Error('Authentication required');
          }
          
          // Log the actual token format (just the beginning for security)
          console.log('[POINTS] Auth token format check:', `${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
          
          try {
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
          } catch (syncError) {
            console.error(`[POINTS] Specific sync error: ${syncError.message}`);
            
            // Handle authentication errors specially
            if (syncError.message && (
              syncError.message.includes('Authentication') || 
              syncError.message.includes('401') || 
              syncError.message.includes('403')
            )) {
              console.error('[POINTS] Authentication error during sync, clearing auth state');
              setIsAuthenticated(false);
              localStorage.setItem('isAuthenticated', 'false');
              throw new Error(`Authentication failed: ${syncError.message}`);
            }
            
            throw syncError;
          }
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
    
    // First, immediately update local state and storage for responsiveness
    const newPoints = magicPoints + amount;
    setMagicPoints(newPoints);
    localStorage.setItem('magicPoints', newPoints);
    setPendingChanges(true);
    
    // Create operation record
    const operation = {
      type: 'add',
      amount,
      source,
      timestamp: new Date().toISOString()
    };
    
    // Update pending operations in local storage first
    setPendingOperations(prev => {
      const updated = [...prev, operation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Only attempt to sync if we're online and authenticated - but do it on next tick to avoid UI lag
    if (isOnline && isAuthenticated) {
      setTimeout(() => syncToServer(), 0);
    } else {
      console.log('[POINTS] Working in offline mode, changes will sync when online');
    }
  }, [magicPoints, isOnline, isAuthenticated, syncToServer]);

  const removePoints = useCallback((amount, source = '') => {
    if (amount <= 0) return;
    
    // First, immediately update local state and storage
    const currentPoints = parseInt(localStorage.getItem('magicPoints') || magicPoints.toString(), 10);
    const newPoints = Math.max(0, currentPoints - amount);
    
    console.log(`[POINTS] Removing ${amount} points from ${currentPoints}. New total: ${newPoints} (${source})`);
    
    // Update state and localStorage in a consistent way
    setMagicPoints(newPoints);
    localStorage.setItem('magicPoints', newPoints);
    setPendingChanges(true);
    
    const operation = {
      type: 'remove',
      amount,
      source,
      timestamp: new Date().toISOString()
    };
    
    // Ensure pendingOperations update is atomic and stored locally first
    setPendingOperations(prev => {
      const updated = [...prev, operation];
      try {
        localStorage.setItem('pendingOperations', JSON.stringify(updated));
      } catch (error) {
        console.error('[POINTS] Error storing pending operations:', error);
      }
      return updated;
    });
    
    // Only attempt to sync if we're online and authenticated - but do it on next tick to avoid UI lag
    if (isOnline && isAuthenticated) {
      setTimeout(() => syncToServer(), 0);
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
  // IMPORTANT: Keep this function for backward compatibility with existing code
  const processBlankSubmission = useCallback((blankId, isCorrect) => {
    console.log(`[POINTS] Processing Revelio for blank ${blankId}. Is correct: ${isCorrect}, State: ${revelioAttempts[blankId]}`);
    
    // Check if this is the first attempt for this blank
    const isFirstAttempt = revelioAttempts[blankId] === undefined || revelioAttempts[blankId] === true;
    console.log(`[POINTS] Is first attempt for ${blankId}: ${isFirstAttempt}`);
    
    // Updated rewards system:
    // - Correct on first attempt: no points (changed from +5)
    // - Correct after first attempt: +10 points (changed from +2)
    // - Incorrect: -10 points
    
    if (isCorrect) {
      if (isFirstAttempt) {
        console.log(`[POINTS] Blank ${blankId} correctly answered on first attempt, no points awarded`);
        // No points awarded for correct first attempt
      } else {
        console.log(`[POINTS] Blank ${blankId} correctly answered after attempts, adding 10 points`);
        addPointsWithLog(10, `correct_retry_${blankId}`);
      }
      
      // Add to correct blanks
      const newCorrectBlanks = { ...correctBlanks, [blankId]: true };
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
    } else {
      console.log(`[POINTS] Blank ${blankId} incorrect answer, removing 10 points`);
      removePointsWithLog(10, `incorrect_${blankId}`);
      
      // Mark as no longer first attempt
      console.log(`[POINTS] Marking ${blankId} as no longer first attempt`);
      const newRevelioAttempts = { ...revelioAttempts, [blankId]: false };
      setRevelioAttempts(newRevelioAttempts);
      localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
    }
    
    return isCorrect;
  }, [revelioAttempts, correctBlanks, addPointsWithLog, removePointsWithLog]);
  
  // Add batch processing for multiple blanks - keep for backward compatibility
  const processMultipleBlanks = useCallback((results) => {
    console.log('[POINTS] Processing multiple blanks submission:', results);
    
    let correctCount = 0;
    let processingPromises = [];
    
    // Process each blank
    Object.entries(results).forEach(([blankId, isCorrect]) => {
      if (isCorrect) correctCount++;
      processingPromises.push(processBlankSubmission(blankId, isCorrect));
    });
    
    // No more bonus points for high accuracy
    console.log(`[POINTS] Results: ${correctCount}/${Object.keys(results).length} correct`);
    
    return Promise.all(processingPromises);
  }, [processBlankSubmission]);

  // Handle Revelio attempts for fill-in-the-blank activities with updated scoring rules
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
    
    // Current magic points before processing
    const pointsBefore = magicPoints;
    console.log(`[POINTS] Current points before processing: ${pointsBefore}`);
    
    // 2.1. Updated Charm the Blanks scoring rules:
    // 2.1.1: First Revelio attempt - wrong: -10 points, correct: no points
    // 2.1.2: Second+ Revelio attempts - corrected answer: +10 points, wrong again: -10 points
    
    if (isCorrect) {
      if (!isFirstAttempt) {
        // 2.1.2: Second+ attempt that's now correct (corrected a previous wrong answer)
        console.log(`[POINTS] Blank ${blankId} corrected after initial wrong attempt, adding 10 points`);
        addPointsWithLog(10, `revelio_correction_${blankId}`);
      } else {
        // 2.1.1: First attempt correct - no points awarded
        console.log(`[POINTS] Blank ${blankId} correctly answered on first attempt, no points awarded`);
      }
      
      // Add to correct blanks to avoid double counting
      const newCorrectBlanks = { ...correctBlanks, [blankId]: true };
      setCorrectBlanks(newCorrectBlanks);
      localStorage.setItem('correctBlanks', JSON.stringify(newCorrectBlanks));
    } else {
      // Wrong answer (both first attempt and subsequent attempts)
      console.log(`[POINTS] Blank ${blankId} answered incorrectly, removing 10 points from ${magicPoints}`);
      removePointsWithLog(10, `revelio_incorrect_${blankId}`);
      
      // Mark as no longer first attempt if it was the first attempt
      if (isFirstAttempt) {
        console.log(`[POINTS] Marking ${blankId} as no longer first attempt`);
        const newRevelioAttempts = { ...revelioAttempts, [blankId]: false };
        setRevelioAttempts(newRevelioAttempts);
        localStorage.setItem('revelioAttempts', JSON.stringify(newRevelioAttempts));
      }
    }
    
    // Log the point change
    console.log(`[POINTS] Points after processing ${blankId}: ${magicPoints} (change: ${magicPoints - pointsBefore})`);
    
    return isCorrect;
  }, [revelioAttempts, correctBlanks, addPointsWithLog, removePointsWithLog, magicPoints]);
  
  // Handle multiple blanks submission for Charm the Blanks activity
  const handleMultipleRevelioAttempts = useCallback((results) => {
    console.log('[POINTS] Processing multiple blanks submission:', results);
    
    // Process each blank individually with updated scoring rules
    const processingPromises = Object.entries(results).map(([blankId, isCorrect]) => 
      handleBlankRevelioAttempt(blankId, isCorrect)
    );
    
    // Log overall results
    const correctCount = Object.values(results).filter(Boolean).length;
    const totalBlanks = Object.keys(results).length;
    console.log(`[POINTS] Revelio results: ${correctCount}/${totalBlanks} correct`);
    
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

  // Add debugging utility functions with silent option
  const debugPointsState = useCallback((silent = false) => {
    if (!silent) {
      console.log('[POINTS DEBUG] Current state:');
      console.log(`- Magic Points: ${magicPoints}`);
      console.log(`- Online Status: ${isOnline ? 'Online' : 'Offline'}`);
      console.log(`- Authentication Status: ${isAuthenticated ? 'Authenticated' : 'Not Authenticated'}`);
      console.log(`- Syncing Status: ${isSyncing ? 'Syncing' : 'Idle'}`);
      console.log(`- Pending Operations: ${pendingOperations.length}`);
      console.log(`- Last Synced: ${lastSynced || 'Never'}`);
    }
    
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
  
  // Force sync with debug information and improved error handling
  const forceSyncWithDebug = useCallback(async () => {
    console.log('[POINTS DEBUG] Force syncing with debug info...');
    
    // Log auth state
    const token = localStorage.getItem('token');
    const authToken = localStorage.getItem('authToken');
    console.log(`[POINTS DEBUG] Auth token: ${token ? 'Present' : 'Missing'}`);
    console.log(`[POINTS DEBUG] Alt auth token: ${authToken ? 'Present' : 'Missing'}`);
    console.log(`[POINTS DEBUG] Token length: ${token?.length || 0}`);
    console.log(`[POINTS DEBUG] isAuthenticated state: ${isAuthenticated}`);
    
    // Verify with server
    try {
      const authStatus = await checkAuthStatus();
      console.log(`[POINTS DEBUG] Server auth check: ${JSON.stringify(authStatus)}`);
    } catch (error) {
      console.error('[POINTS DEBUG] Error checking auth:', error);
    }
    
    // Verify local storage
    console.log(`[POINTS DEBUG] Local magic points: ${localStorage.getItem('magicPoints')}`);
    console.log(`[POINTS DEBUG] State magic points: ${magicPoints}`);
    
    // Log pending operations
    const storedOps = localStorage.getItem('pendingOperations');
    const parsedOps = storedOps ? JSON.parse(storedOps) : [];
    console.log(`[POINTS DEBUG] Pending operations in localStorage: ${parsedOps.length}`);
    console.log(`[POINTS DEBUG] Pending operations in state: ${pendingOperations.length}`);
    
    // Check for discrepancies
    if (pendingOperations.length !== parsedOps.length) {
      console.warn('[POINTS DEBUG] Discrepancy between state and localStorage operations!');
      // Sync the state from localStorage to ensure consistency
      setPendingOperations(parsedOps);
    }
    
    if (pendingOperations.length > 0) {
      console.log('[POINTS DEBUG] Pending operations:', pendingOperations);
    }
    
    try {
      await syncToServer();
      return true;
    } catch (error) {
      console.error('[POINTS DEBUG] Sync error:', error);
      return false;
    }
  }, [pendingOperations, syncToServer, magicPoints, isAuthenticated]);
  
  // Reset points to 100
  const resetPoints = useCallback(async () => {
    console.log('[POINTS DEBUG] Resetting points to 100');
    
    // Reset local state immediately
    setMagicPoints(100);
    localStorage.setItem('magicPoints', '100');
    
    // Add a reset operation
    const resetOperation = {
      type: 'set',
      amount: 100,
      source: 'debug_reset',
      timestamp: new Date().toISOString()
    };
    
    // Update pending operations in local storage first
    setPendingOperations(prev => {
      const updated = [...prev, resetOperation];
      localStorage.setItem('pendingOperations', JSON.stringify(updated));
      return updated;
    });
    
    // Force sync if online in the background
    if (isOnline && isAuthenticated) {
      setTimeout(async () => {
        try {
          await syncToServer();
        } catch (error) {
          console.error('[POINTS DEBUG] Error syncing after reset:', error);
        }
      }, 0);
    } else {
      console.log('[POINTS DEBUG] Working offline, changes will sync when online');
    }
    
    return true; // Return immediately after local update for better responsiveness
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
