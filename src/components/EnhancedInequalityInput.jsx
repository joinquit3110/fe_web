import React, { useState, useEffect, useRef } from 'react';
import { parseInequality } from '../utils/inequalityAlgorithms';

const EnhancedInequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState('');
  const [showLatex, setShowLatex] = useState(false);
  const [latexPreview, setLatexPreview] = useState('');
  const [animateButton, setAnimateButton] = useState(false);
  const inputRef = useRef(null);

  // Focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Enhanced validation with better feedback and syntax suggestions
  useEffect(() => {
    if (!input.trim()) {
      setShowLatex(false);
      setIsValid(true);
      setError('');
      setLatexPreview('');
      return;
    }

    // Try to parse the inequality
    const result = parseInequality(input);
    
    if (result) {
      setIsValid(true);
      setError('');
      setShowLatex(true);
      setLatexPreview(`\\(${result.latex}\\)`);
      
      // Trigger MathJax rendering
      if (window.MathJax && window.MathJax.typeset) {
        setTimeout(() => {
          window.MathJax.typeset();
        }, 100);
      }
    } else {
      setIsValid(false);
      
      // Provide more helpful error messages based on common issues
      if (input.includes('x') || input.includes('y')) {
        if (!input.includes('<') && !input.includes('>') && !input.includes('=')) {
          setError('Missing comparison operator (<, >, <=, >=, =)');
        } else if (!input.endsWith('0') && !input.endsWith('=0') && !input.endsWith('<0') && !input.endsWith('>0')) {
          setError('Inequality should be in the form: ax + by + c [operator] 0');
        } else {
          setError('Invalid format. Try examples like: x+y<0, 2x-3y+1≥0');
        }
      } else {
        setError('Inequality must include x and/or y variables');
      }
      
      setShowLatex(false);
      setLatexPreview('');
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
      // Successfully added - animate the button for visual feedback
      setAnimateButton(true);
      setTimeout(() => setAnimateButton(false), 500);
      
      // Clear the input
      setInput('');
      setShowLatex(false);
      setLatexPreview('');
      setQuizMessage('Spell cast successfully! Your inequality has been added to the magical plane.');
    } else if (result === 'EXISTS') {
      setQuizMessage('This inequality spell already exists in the magical plane!');
    } else {
      setQuizMessage('Invalid inequality format. Try examples like: x+y<0, 2x-3y+1≥0');
    }
  };

  const handleReset = () => {
    resetAll();
    setInput('');
    setShowLatex(false);
    setLatexPreview('');
    setIsValid(true);
    setError('');
    
    // Provide feedback to the user
    setQuizMessage('The magical plane has been reset. Ready for your next spell!');
  };

  return (
    <div className="enhanced-inequality-input">
      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-container">
          <div className="input-group">
            <div className="input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Cast your inequality spell (e.g., x+y<0)"
                className={`inequality-input ${!isValid && input ? 'error' : ''}`}
                autoComplete="off"
              />
              <span className="input-focus-border"></span>
            </div>
            {error && (
              <div className="error-message">
                <span className="material-icons">error_outline</span>
                {error}
              </div>
            )}
            {!error && input && isValid && (
              <div className="valid-message">
                <span className="material-icons">check_circle</span>
                Valid inequality format
              </div>
            )}
          </div>
          
          <div className="button-group">
            <button 
              type="submit" 
              className={`spellcast-button ${animateButton ? 'animate' : ''}`}
              disabled={!isValid || !input.trim()}
            >
              <span className="button-content">
                <span className="material-icons">auto_fix_high</span>
                Cast Spell
              </span>
              <span className="button-glow"></span>
            </button>
            <button 
              type="button" 
              className="reset-button"
              onClick={handleReset}
              title="Reset All (Clear All Inequalities)"
            >
              <span className="material-icons">refresh</span>
              Reset All
            </button>
          </div>
        </div>
        
        {/* Enhanced LaTeX Preview Area - always visible when there's valid input */}
        <div className={`latex-preview-container ${showLatex && isValid && input.trim() ? 'visible' : ''}`}>
          <div className="preview-label">
            <span className="material-icons">preview</span>
            Preview:
          </div>
          <div 
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: latexPreview }}
          />
        </div>
      </form>
    </div>
  );
};

export default EnhancedInequalityInput; 