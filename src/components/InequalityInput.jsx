import React, { useState, useEffect } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [inputValue, setInputValue] = useState('');
  const [latexPreview, setLatexPreview] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Validate input and update LaTeX preview
  useEffect(() => {
    if (inputValue.trim()) {
      try {
        const result = parseInequality(inputValue);
        if (result && result.latex) {
          setLatexPreview(`\\(${result.latex}\\)`);
          setErrorMsg('');
          setIsValid(true);
        } else {
          setLatexPreview('');
          setErrorMsg('Invalid inequality format');
          setIsValid(false);
        }
      } catch (error) {
        setLatexPreview('');
        setErrorMsg('Invalid inequality format');
        setIsValid(false);
      }
    } else {
      setLatexPreview('');
      setErrorMsg('');
      setIsValid(false);
    }
    
    // Trigger MathJax to reprocess the LaTeX only if valid
    if (window.MathJax && isValid) {
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typeset) {
          window.MathJax.typeset();
        }
      }, 100);
    }
  }, [inputValue, isValid]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || !isValid) {
      setErrorMsg('Please enter a valid inequality');
      return;
    }
    
    try {
      const result = addInequality(inputValue);
      
      if (result === true) {
        // Success - inequality added
        setQuizMessage('Inequality spell cast successfully!');
        setInputValue('');
        setLatexPreview('');
        setIsValid(false);
      } else if (result === 'EXISTS') {
        // Duplicate inequality
        setErrorMsg('This spell is already in your collection!');
        setQuizMessage('This inequality is already in your collection.');
      } else {
        // Error adding inequality
        setErrorMsg('Invalid inequality format. Try examples like x+y<0 or 2x-3y≤4');
        setQuizMessage('Incorrect spell format. Try examples like: x+y<0, 2x-3y≥1');
      }
    } catch (error) {
      console.error('Error casting spell:', error);
      setErrorMsg('Error casting spell');
      setQuizMessage('Error in casting inequality spell.');
    }
  };

  const handleReset = () => {
    resetAll();
    setInputValue('');
    setLatexPreview('');
    setErrorMsg('');
    setIsValid(false);
    setQuizMessage('All spells cleared. Ready for new inequality magic!');
  };

  return (
    <div className="inequality-form">
      <h3>Cast Your Spell</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="inequality-input">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter an inequality (e.g., x+y<0, 2x-3y≥1)"
            className={`styled-input ${errorMsg ? 'input-error' : ''}`}
          />
          
          {/* LaTeX Preview Box - only show if valid */}
          <div className="latex-preview-container">
            {isValid && latexPreview ? (
              <div className="latex-preview" dangerouslySetInnerHTML={{ __html: latexPreview }}></div>
            ) : (
              <div className="latex-preview empty">Valid LaTeX preview will appear here</div>
            )}
          </div>
          
          {/* Always show error message if present */}
          {errorMsg && <div className="error-message">{errorMsg}</div>}
          
          <div className="button-group">
            <button 
              type="submit" 
              className="spellcast-button"
              disabled={!inputValue.trim() || !isValid}
            >
              Cast Spell
            </button>
            
            <button 
              type="button"
              className="reset-button finite-button"
              onClick={handleReset}
            >
              Finite Incantatem
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
