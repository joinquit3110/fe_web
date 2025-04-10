import React, { useState } from 'react';
import { checkPointInInequality } from '../utils/geometry';
import { useMagicPoints } from '../context/MagicPointsContext';

const styles = {
  inequalityInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '16px',
    transition: 'all 0.2s ease-in-out',
    position: 'relative',
    zIndex: 200,
    pointerEvents: 'auto',
    ':focus': {
      borderColor: '#4a90e2',
      boxShadow: '0 0 0 2px rgba(74, 144, 226, 0.2)'
    }
  },
  coordinateInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '16px',
    transition: 'all 0.2s ease-in-out',
    pointerEvents: 'auto'
  },
  button: {
    padding: '10px 16px',
    background: '#4a90e2',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    pointerEvents: 'auto',
    ':hover': {
      background: '#3a7bc8'
    },
    ':disabled': {
      background: '#cccccc',
      cursor: 'not-allowed'
    }
  },
  addButton: {
    padding: '8px 12px',
    background: '#5cb85c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    pointerEvents: 'auto',
    ':hover': {
      background: '#4cae4c'
    },
    ':disabled': {
      background: '#cccccc',
      cursor: 'not-allowed'
    }
  },
  resultMessage: {
    padding: '15px',
    borderRadius: '8px',
    marginTop: '20px',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  successMessage: {
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb'
  },
  errorMessage: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb'
  }
};

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
      systemHasSolution,      // Whether system has any solution
      true,                   // User selected "No Solution"
      false                   // Point correctness doesn't apply here
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

  const handleInequalityChange = (index, value) => {
    const newInequalities = [...inequalities];
    newInequalities[index] = value;
    setInequalities(newInequalities);
    
    // Clear error message when typing
    const newErrorMessages = [...errorMessages];
    newErrorMessages[index] = '';
    setErrorMessages(newErrorMessages);
    
    // Reset results when changing input
    setShowResult(false);
    setIsSystemVerified(false);
  };

  const addInequality = () => {
    if (inequalities.length < 5) {
      setInequalities([...inequalities, '']);
      setErrorMessages([...errorMessages, '']);
    }
  };

  const systemHasSolution = checkSystemHasSolution();

  return (
    <div className="system-challenge-container">
      <h2>System of Inequalities Challenge</h2>
      
      <form onSubmit={handleVerifySystem} className="inequality-form">
        {inequalities.map((inequality, index) => (
          <div key={index} className="inequality-input-group">
            <label htmlFor={`inequality-${index}`}>Inequality {index + 1}</label>
            <input
              id={`inequality-${index}`}
              type="text"
              value={inequality}
              onChange={(e) => handleInequalityChange(index, e.target.value)}
              className={errorMessages[index] ? 'input-error' : ''}
              placeholder="Example: 2x + 3y > 6"
              style={styles.inequalityInput}
            />
            {errorMessages[index] && (
              <span className="error-message">{errorMessages[index]}</span>
            )}
          </div>
        ))}

        <div className="actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', position: 'relative', zIndex: 200 }}>
          <button 
            type="button" 
            onClick={addInequality} 
            disabled={inequalities.length >= 5}
            style={styles.addButton}
          >
            ADD INEQUALITY
          </button>
          
          {!isSystemVerified ? (
            <button 
              type="submit" 
              disabled={inequalities.some(ineq => !ineq.trim()) || inequalities.length === 0}
              style={styles.button}
            >
              CHECK SYSTEM OF INEQUALITIES
              <span style={{ marginLeft: '8px' }}>⚡</span>
            </button>
          ) : (
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={!systemHasSolution}
              style={styles.button}
            >
              VERIFY MY SOLUTION
              <span style={{ marginLeft: '8px' }}>✓</span>
            </button>
          )}
        </div>

        {isSystemVerified && (
          <>
            {systemHasSolution ? (
              <div className="solution-section" style={{ position: 'relative', zIndex: 200, marginTop: '20px' }}>
                <p>This system has a solution! Find any point that satisfies all inequalities:</p>
                
                <div className="solution-point-input">
                  <div>
                    <label htmlFor="x-coordinate">X-coordinate:</label>
                    <input
                      id="x-coordinate"
                      type="number"
                      step="any"
                      value={solutionPoint.x}
                      onChange={(e) => setSolutionPoint({...solutionPoint, x: e.target.value})}
                      style={styles.coordinateInput}
                    />
                  </div>
                  <div>
                    <label htmlFor="y-coordinate">Y-coordinate:</label>
                    <input
                      id="y-coordinate"
                      type="number"
                      step="any"
                      value={solutionPoint.y}
                      onChange={(e) => setSolutionPoint({...solutionPoint, y: e.target.value})}
                      style={styles.coordinateInput}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="result-message error"
                style={{
                  ...styles.resultMessage,
                  ...styles.errorMessage
                }}
              >
                This system of inequalities has no solution.
              </div>
            )}
          </>
        )}

        {validationResult && (
          <div 
            className={`result-message ${validationResult.isCorrect ? 'success' : 'error'}`}
            style={{
              ...styles.resultMessage,
              ...(validationResult.isCorrect ? styles.successMessage : styles.errorMessage)
            }}
          >
            {validationResult.message}
          </div>
        )}
      </form>
    </div>
  );
};

export default SystemOfInequalitiesChallenge;