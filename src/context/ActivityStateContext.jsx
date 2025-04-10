import React, { createContext, useState, useContext } from 'react';

// Create the context
const ActivityStateContext = createContext();

// Create the provider component
export const ActivityStateProvider = ({ children }) => {
  // State for activity 1 (fill-in-the-blanks)
  const [blankActivityState, setBlankActivityState] = useState({
    blankValues: {},
    blankCorrectness: {},
    wordBankItems: [],
    isSubmitted: false,
    score: null,
    resetMessage: false,
    fillBlanksMessage: false,
  });

  // State for activity 2 (system of inequalities)
  const [systemActivityState, setSystemActivityState] = useState({
    inequalities: ['', '', ''],
    latexInequalities: ['', '', ''],
    parsedInequalities: [],
    solutionPoint: { x: '', y: '' },
    validationResult: null,
    showResult: false,
    errorMessages: ['', '', ''],
    isSystemVerified: false,
    systemCheckResult: null,
  });

  // Function to update specific activity state
  const updateBlankActivityState = (newState) => {
    setBlankActivityState(prev => ({ ...prev, ...newState }));
  };

  const updateSystemActivityState = (newState) => {
    setSystemActivityState(prev => ({ ...prev, ...newState }));
  };

  // Reset all state (for testing or cleanup)
  const resetAllState = () => {
    setBlankActivityState({
      blankValues: {},
      blankCorrectness: {},
      wordBankItems: [],
      isSubmitted: false,
      score: null,
      resetMessage: false,
      fillBlanksMessage: false,
    });
    
    setSystemActivityState({
      inequalities: ['', '', ''],
      latexInequalities: ['', '', ''],
      parsedInequalities: [],
      solutionPoint: { x: '', y: '' },
      validationResult: null,
      showResult: false,
      errorMessages: ['', '', ''],
      isSystemVerified: false,
      systemCheckResult: null,
    });
  };

  return (
    <ActivityStateContext.Provider value={{
      blankActivityState,
      systemActivityState,
      updateBlankActivityState,
      updateSystemActivityState,
      resetAllState
    }}>
      {children}
    </ActivityStateContext.Provider>
  );
};

// Custom hook for using the context
export const useActivityState = () => {
  const context = useContext(ActivityStateContext);
  if (!context) {
    throw new Error('useActivityState must be used within an ActivityStateProvider');
  }
  return context;
};
