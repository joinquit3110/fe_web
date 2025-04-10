import React, { useState } from 'react';
import { checkPointInInequality } from '../utils/geometry';
import { useMagicPoints } from '../context/MagicPointsContext';

const SystemOfInequalitiesChallenge = () => {
  const [inequalities, setInequalities] = useState(['', '', '']);
  const [errorMessages, setErrorMessages] = useState(['', '', '']);
  const [parsedInequalities, setParsedInequalities] = useState([]);
  const [solutionPoint, setSolutionPoint] = useState({ x: '', y: '' });
  const [isSystemVerified, setIsSystemVerified] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  
  const { handleInequalityFormatCheck, handleInequalitySolutionCheck } = useMagicPoints();

  const validateInequalities = () => {
    const { parseInequality } = require('../utils/parser');
    const newParsedInequalities = [];
    const newErrorMessages = ['', '', ''];
    let valid = true;
    inequalities.forEach((ineq, index) => {
      if (!ineq.trim()) {
        newErrorMessages[index] = 'Please enter an inequality';
        valid = false;
        
        // Call for format check - empty inequality counts as invalid
        handleInequalityFormatCheck(false, index);
        return;
      }
      const parsed = parseInequality(ineq);
      if (!parsed) {
        newErrorMessages[index] = `Invalid format. Try examples like: x+y<0, 2x-3y+1≥0`;
        valid = false;
        
        // Call for format check - failed parse
        handleInequalityFormatCheck(false, index);
      } else {
        newParsedInequalities.push(parsed);
        
        // Call for format check - valid parse
        handleInequalityFormatCheck(true, index);
      }
    });
    setErrorMessages(newErrorMessages);
    if (valid) {
      setParsedInequalities(newParsedInequalities);
    }
    return valid;
  };

  const handleVerifySystem = () => {
    const isValid = validateInequalities();
    setIsSystemVerified(isValid);
    setShowResult(false);
    if (!isValid) {
      setValidationResult({
        isCorrect: false,
        message: 'Please fix the errors in the inequalities before proceeding.'
      });
    } else {
      setValidationResult(null);
    }
  };

  const checkSystemHasSolution = () => {
    // Implement the logic to check if system has a solution
    // This is a simplified example - you may need more complex logic
    const testPoints = [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: -1, y: -1 }, 
      { x: 1, y: -1 }, { x: -1, y: 1 }
    ];
    
    // Try to find at least one point that satisfies all inequalities
    for (const point of testPoints) {
      if (parsedInequalities.every(ineq => checkPointInInequality(ineq, point))) {
        return true;
      }
    }
    
    // More advanced check needed for complex systems
    // For now, return false if no test point works
    return false;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isSystemVerified) {
      handleVerifySystem();
      return;
    }
    
    // Check if solution point is provided
    if (!solutionPoint.x || !solutionPoint.y) {
      setValidationResult({
        isCorrect: false,
        message: 'Please enter both x and y coordinates for your solution point.'
      });
      setShowResult(true);
      return;
    }
    
    // Convert to numbers
    const pointX = parseFloat(solutionPoint.x);
    const pointY = parseFloat(solutionPoint.y);
    
    if (isNaN(pointX) || isNaN(pointY)) {
      setValidationResult({
        isCorrect: false,
        message: 'Please enter valid numbers for coordinates.'
      });
      setShowResult(true);
      return;
    }
    
    // Check if point satisfies all inequalities
    const point = { x: pointX, y: pointY };
    const satisfiesAll = parsedInequalities.every(ineq => checkPointInInequality(ineq, point));
    
    // Determine if system actually has a solution
    const systemHasSolution = checkSystemHasSolution();
    
    // Update magic points based on results
    handleInequalitySolutionCheck(
      systemHasSolution,  // Whether system has any solution
      false,              // User did not select "No Solution"
      satisfiesAll        // Whether user's point is correct
    );
    
    // Update UI
    setValidationResult({
      isCorrect: satisfiesAll,
      message: satisfiesAll 
        ? 'Correct! This point satisfies all inequalities.'
        : 'This point does not satisfy all inequalities. Please try again.'
    });
    setShowResult(true);
  };
  
  const handleNoSolution = () => {
    if (!isSystemVerified) {
      handleVerifySystem();
      return;
    }
    
    // Determine if system actually has a solution
    const systemHasSolution = checkSystemHasSolution();
    
    // Update magic points based on results
    handleInequalitySolutionCheck(
      systemHasSolution,  // Whether system has any solution
      true,               // User selected "No Solution"
      false               // Not applicable when declaring no solution
    );
    
    // Update UI
    setValidationResult({
      isCorrect: !systemHasSolution,
      message: !systemHasSolution 
        ? 'Correct! This system has no solution.'
        : 'Incorrect. This system does have solutions. Try finding one.'
    });
    setShowResult(true);
  };

  return (
    <div className="system-challenge-container">
      <h2>System of Inequalities Challenge</h2>
      <form onSubmit={handleSubmit}>
        {inequalities.map((ineq, index) => (
          <div key={index} className="inequality-input-group">
            <label htmlFor={`inequality-${index}`}>Inequality {index + 1}:</label>
            <input
              type="text"
              id={`inequality-${index}`}
              value={ineq}
              onChange={(e) => {
                const newInequalities = [...inequalities];
                newInequalities[index] = e.target.value;
                setInequalities(newInequalities);
                
                // Clear error message when typing
                const newErrorMessages = [...errorMessages];
                newErrorMessages[index] = '';
                setErrorMessages(newErrorMessages);
                
                // Reset results when changing input
                setShowResult(false);
                setIsSystemVerified(false);
              }}
              className={errorMessages[index] ? 'input-error' : ''}
              placeholder={`Example: 2x-3y+1≥0`}
            />
            {errorMessages[index] && <span className="error-message">{errorMessages[index]}</span>}
          </div>
        ))}
        <button type="button" onClick={handleVerifySystem}>
          Verify System
        </button>
        <div className="solution-point-input">
          <label htmlFor="solution-x">Solution Point X:</label>
          <input
            type="text"
            id="solution-x"
            value={solutionPoint.x}
            onChange={(e) => setSolutionPoint({ ...solutionPoint, x: e.target.value })}
            disabled={!isSystemVerified}
          />
          <label htmlFor="solution-y">Solution Point Y:</label>
          <input
            type="text"
            id="solution-y"
            value={solutionPoint.y}
            onChange={(e) => setSolutionPoint({ ...solutionPoint, y: e.target.value })}
            disabled={!isSystemVerified}
          />
        </div>
        <button type="submit" disabled={!isSystemVerified}>
          Check Solution
        </button>
        <button type="button" onClick={handleNoSolution} disabled={!isSystemVerified}>
          Declare No Solution
        </button>
      </form>
      {showResult && (
        <div className={`result-message ${validationResult.isCorrect ? 'correct' : 'incorrect'}`}>
          {validationResult.message}
        </div>
      )}
    </div>
  );
};

export default SystemOfInequalitiesChallenge;