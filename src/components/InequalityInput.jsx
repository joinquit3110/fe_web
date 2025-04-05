import React, { useState, useEffect, useRef } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [latexPreview, setLatexPreview] = useState('');
  const [isSpellcasting, setIsSpellcasting] = useState(false);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
      setLatexPreview('');
      return;
    }

    // Clear any existing timeout to prevent flashes
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Use a timeout to avoid processing during rapid typing
    typingTimeoutRef.current = setTimeout(() => {
      // Try to parse the inequality
      const result = parseInequality(input);
      
      if (result) {
        setIsValid(true);
        setLatexPreview(`\\(${result.latex}\\)`);
      } else {
        setIsValid(false);
        
        // Still try to display the LaTeX preview even for invalid input
        try {
          // Clean the input for LaTeX display 
          let cleanInput = input
            .replace(/</g, '\\lt ')
            .replace(/>/g, '\\gt ')
            .replace(/<=/g, '\\leq ')
            .replace(/>=/g, '\\geq ');
          
          setLatexPreview(`\\(${cleanInput}\\)`);
        } catch (e) {
          // If even this fails, show something basic
          setLatexPreview(`\\(${input}\\)`);
        }
      }
      
      // Trigger MathJax rendering for any preview content
      if (window.MathJax && window.MathJax.typeset) {
        window.MathJax.typeset();
      }
    }, 300); // Delay processing by 300ms
    
    // Cleanup function
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
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
          </div>
          
          {/* LaTeX Preview Area - moved between input and buttons */}
          <div className="latex-preview-container">
            <div className="latex-preview">
              {latexPreview && (
                <span 
                  className="preview-content"
                  dangerouslySetInnerHTML={{ __html: latexPreview }}
                />
              )}
            </div>
          </div>
          
          <div className="button-group">
            <button 
              type="submit" 
              className="spellcast-button"
              disabled={!isValid || !input.trim() || isSpellcasting}
            >
              <span className="spell-icon">✨</span>
              Cast Spell
            </button>
            <button 
              type="button" 
              className="finite-button"
              onClick={handleReset}
              title="Reset All (Clear All Inequalities)"
              disabled={isSpellcasting}
            >
              <span className="spell-icon">⚡</span>
              Finite Incantatem
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
