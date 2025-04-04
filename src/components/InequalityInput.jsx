import React, { useState, useEffect, useRef } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState('');
  const [showLatex, setShowLatex] = useState(false);
  const inputRef = useRef(null);

  // Focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Validate input and update LaTeX preview when input changes
  useEffect(() => {
    if (!input.trim()) {
      setShowLatex(false);
      setIsValid(true);
      setError('');
      return;
    }

    const result = parseInequality(input);
    
    if (result) {
      setIsValid(true);
      setError('');
      setShowLatex(true);
      
      // Trigger MathJax rendering
      if (window.MathJax && window.MathJax.typeset) {
        setTimeout(() => {
          window.MathJax.typeset();
        }, 100);
      }
    } else {
      setIsValid(false);
      setError('Invalid inequality format');
      setShowLatex(false);
    }
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!input.trim()) {
      setQuizMessage('Please enter an inequality spell!');
      return;
    }
    
    const result = addInequality(input);
    
    if (result === true) {
      // Successfully added
      setInput('');
      setShowLatex(false);
    } else if (result === 'EXISTS') {
      setQuizMessage('This inequality spell already exists!');
    } else {
      setQuizMessage('Invalid inequality format. Try examples like: x+y<0, 2x-3y+1≥0');
    }
  };

  const handleReset = () => {
    resetAll();
    setInput('');
    setShowLatex(false);
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit} className="input-container">
        <div className="input-row">
          <div className="input-group">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cast your inequality spell (e.g., x+y<0)"
              className={!isValid && input ? 'error' : ''}
              autoComplete="off"
            />
            {error && <div className="error-message">{error}</div>}
          </div>
          
          <div className="button-group">
            <button 
              type="submit" 
              className="spellcast-button"
              disabled={!isValid || !input.trim()}
            >
              Cast Spell
            </button>
            <button 
              type="button" 
              className="finite-button"
              onClick={handleReset}
              title="Reset All (Clear All Inequalities)"
            >
              Finite Incantatem
            </button>
          </div>
        </div>
        
        {/* LaTeX Preview Area - only show for valid input */}
        {showLatex && isValid && input.trim() && (
          <div className="latex-preview-container">
            <div className="latex-preview">
              <span>Preview: </span>
              <span 
                dangerouslySetInnerHTML={{ 
                  __html: `\\(${parseInequality(input)?.latex}\\)` 
                }}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default InequalityInput;
