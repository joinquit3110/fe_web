import React, { useEffect, useState } from 'react';
import LinearInequalitiesActivity from './LinearInequalitiesActivity';
import { ActivityStateProvider, useActivityState } from '../context/ActivityStateContext';
import { useMagicPoints } from '../context/MagicPointsContext';

// Create a wrapper component to access context
const ActivityContent = () => {
  const { blankActivityState, updateBlankActivityState } = useActivityState();
  const [revelioResetDone, setRevelioResetDone] = useState(false);
  const { 
    removePointsWithLog, 
    handleInequalityFormatCheck,
    handleInequalitySolutionCheck,
    handleBlankRevelioAttempt,
    handleMultipleRevelioAttempts,
    resetRevelioAttempts
  } = useMagicPoints();

  // When component mounts, reset Revelio attempts only once
  useEffect(() => {
    if (!revelioResetDone) {
      console.log('[ACTIVITY1] Resetting Revelio attempts on mount');
      resetRevelioAttempts();
      setRevelioResetDone(true);
    }
  }, [resetRevelioAttempts, revelioResetDone]);

  // Handler for when answers are submitted in Charm the Blanks
  const handleCharmBlanksSubmission = (blanksResults) => {
    console.log('[ACTIVITY1] Charm the Blanks submission:', blanksResults);
    
    // Process each blank's result according to the rules
    Object.entries(blanksResults).forEach(([blankId, isCorrect]) => {
      handleBlankRevelioAttempt(blankId, isCorrect);
    });
  };

  // Handler for inequality solution inputs
  const handleInequalitySolution = (systemHasSolution, selectedNoSolution, isSolutionCorrect) => {
    console.log(`[ACTIVITY1] Inequality solution check: 
      Has solution: ${systemHasSolution}, 
      Selected no solution: ${selectedNoSolution}, 
      Is correct: ${isSolutionCorrect}`);
      
    // Use the context function for inequality solution checks
    handleInequalitySolutionCheck(systemHasSolution, selectedNoSolution, isSolutionCorrect);
  };

  // Handler for inequality format check
  const handleFormatCheck = (isValid, index) => {
    console.log(`[ACTIVITY1] Format check for inequality ${index}: ${isValid ? 'valid' : 'invalid'}`);
    handleInequalityFormatCheck(isValid, index);
  };

  return (
    <LinearInequalitiesActivity 
      blankState={blankActivityState}
      updateBlankState={updateBlankActivityState}
      onSubmission={handleCharmBlanksSubmission}
      onInequalitySolution={handleInequalitySolution}
      onFormatCheck={handleFormatCheck}
    />
  );
};

export default function Activity1() {
  return (
    <ActivityStateProvider>
      <ActivityContent />
    </ActivityStateProvider>
  );
}