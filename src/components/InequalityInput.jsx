import React, { useState, useEffect, useRef } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState('');
  const [latexPreview, setLatexPreview] = useState('');
  const [isSpellcasting, setIsSpellcasting] = useState(false);
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
      setLatexPreview(`\\(${result.latex}\\)`);
    } else {
      setIsValid(false);
      
      // Provide more helpful error messages based on common issues
      if (input.includes('x') || input.includes('y')) {
        if (!input.includes('<') && !input.includes('>') && !input.includes('=')) {
          setError('Your spell is missing a comparison enchantment (<, >, <=, >=, =)');
        } else if (!input.includes('0') && !input.endsWith('=0') && !input.endsWith('<0') && !input.endsWith('>0')) {
          setError('Magical inequalities should be in the form: ax + by + c [operator] 0');
        } else {
          setError('Invalid spell format. Try examples like: x+y<0, 2x-3y+1≥0');
        }
      } else {
        setError('Your spell must include x and/or y variables to work');
      }
      
      // Still attempt to show the LaTeX preview for any input
      try {
        setLatexPreview(`\\(${input}\\)`);
      } catch (e) {
        setLatexPreview('');
      }
    }
    
    // Trigger MathJax rendering for any preview content
    if (window.MathJax && window.MathJax.typeset) {
      setTimeout(() => {
        window.MathJax.typeset();
      }, 100);
    }
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!input.trim()) {
      setQuizMessage('Please enter an inequality spell!');
      return;
    }
    
    // Animation for spellcasting
    setIsSpellcasting(true);
    
    // Delay to show the animation
    setTimeout(() => {
      const result = addInequality(input);
      
      if (result === true) {
        // Successfully added
        setInput('');
        setLatexPreview('');
      } else if (result === 'EXISTS') {
        setQuizMessage('This inequality spell already exists in your spellbook!');
      } else {
        setQuizMessage('Invalid spell format. Try examples like: x+y<0, 2x-3y+1≥0');
      }
      
      setIsSpellcasting(false);
    }, 600);
  };

  const handleReset = () => {
    resetAll();
    setInput('');
    setLatexPreview('');
    setIsValid(true);
    setError('');
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit} className="input-container">
        <div className={`input-row ${isSpellcasting ? 'spellcasting' : ''}`}>
          <div className="input-group">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter inequality (e.g., x+y<0)"
              className={!isValid && input ? 'error' : ''}
              autoComplete="off"
            />
            {isSpellcasting && (
              <div className="spell-effect">
                <div className="spell-sparkle"></div>
                <div className="spell-sparkle"></div>
                <div className="spell-sparkle"></div>
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            {!error && input && isValid && (
              <div className="valid-message">Valid magical formula ✓</div>
            )}
          </div>
          
          <div className="button-group">
            <button 
              type="submit" 
              className="spellcast-button"
              disabled={!isValid || !input.trim() || isSpellcasting}
            >
              <span className="spell-icon">✨</span>
              Cast
            </button>
            <button 
              type="button" 
              className="finite-button"
              onClick={handleReset}
              title="Reset All (Clear All Inequalities)"
              disabled={isSpellcasting}
            >
              <span className="spell-icon">⚡</span>
              Reset
            </button>
          </div>
        </div>
        
        {/* LaTeX Preview Area - always show */}
        <div className="latex-preview-container">
          <div className="latex-preview">
            <span 
              className="preview-content"
              dangerouslySetInnerHTML={{ __html: latexPreview || '\\(\\)' }}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
