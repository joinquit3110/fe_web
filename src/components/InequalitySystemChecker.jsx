import React, { useState } from 'react';
import { systemHasSolution, handleInequalitySolutionCheck } from '../utils/inequalityUtils';

const InequalitySystemChecker = ({ inequalitySystem }) => {
  const [feedback, setFeedback] = useState('');
  const [noSolutionSelected, setNoSolutionSelected] = useState(false);

  /**
   * Checks whether the entered solution point is correct for all constraints
   */
  const validateSolution = (solution, constraints) => {
    if (!solution || !constraints || constraints.length === 0) {
      return false;
    }
    
    // First, check if system actually has a solution
    const hasSolution = systemHasSolution(constraints);
    console.log('System has solution:', hasSolution);
    
    if (!hasSolution) {
      // If system has no solution, then "No solution" should be selected
      return { 
        valid: false, 
        systemHasSolution: false 
      };
    }

    // If system has a solution, verify the provided point satisfies all constraints
    // ...existing code...
  };

  const handleSolutionSubmit = () => {
    // If user selected "No Solution"
    if (noSolutionSelected) {
      const hasSolution = systemHasSolution(inequalitySystem);
      console.log('User selected No Solution. System actually has solution:', hasSolution);
      
      const result = !hasSolution; // User is correct if system truly has no solution
      
      // Call the point system handler
      handleInequalitySolutionCheck(!hasSolution, true, false);
      
      if (result) {
        setFeedback("Correct! This system has no solution.");
      } else {
        setFeedback("Incorrect. This system has at least one solution.");
      }
      
      return;
    }

    // ...existing code for validating a specific solution point...
  };

  return (
    <div>
      <h1>Inequality System Checker</h1>
      <button onClick={handleSolutionSubmit}>Submit Solution</button>
      <p>{feedback}</p>
    </div>
  );
};

export default InequalitySystemChecker;