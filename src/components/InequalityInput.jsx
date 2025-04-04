import React, { useState, useEffect } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [inputValue, setInputValue] = useState('');
  const [latexPreview, setLatexPreview] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Update the LaTeX preview whenever the input changes
    if (inputValue.trim()) {
      try {
        const result = parseInequality(inputValue);
        if (result && result.latex) {
          setLatexPreview(`\\(${result.latex}\\)`);
          setErrorMsg('');
        } else {
          setLatexPreview('');
          setErrorMsg('Invalid inequality format');
        }
      } catch (error) {
        setLatexPreview('');
        setErrorMsg('Invalid inequality format');
      }
    } else {
      setLatexPreview('');
      setErrorMsg('');
    }
    
    // Trigger MathJax to reprocess the LaTeX
    if (window.MathJax) {
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typeset) {
          window.MathJax.typeset();
        }
      }, 100);
    }
  }, [inputValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      return;
    }
    
    try {
      const result = addInequality(inputValue);
      
      if (result === true) {
        // Success - inequality added
        setQuizMessage('Inequality spell cast successfully!');
        setInputValue('');
        setLatexPreview('');
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
            className="styled-input"
          />
          
          {/* LaTeX Preview Box */}
          <div className="latex-preview-container">
            {latexPreview ? (
              <div className="latex-preview" dangerouslySetInnerHTML={{ __html: latexPreview }}></div>
            ) : (
              <div className="latex-preview empty">LaTeX preview will appear here</div>
            )}
          </div>
          
          {errorMsg && <div className="error-message">{errorMsg}</div>}
          
          <div className="button-group">
            <button 
              type="submit" 
              className="spellcast-button"
              disabled={!inputValue.trim()}
            >
              Cast Spell
            </button>
            
            <button 
              type="button"
              className="reset-button"
              onClick={handleReset}
            >
              Clear All
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
