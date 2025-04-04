import React, { useState, useEffect } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ onSpellCast }) => {
  const [inputValue, setInputValue] = useState('');
  const [latexPreview, setLatexPreview] = useState('');

  useEffect(() => {
    // Update the LaTeX preview whenever the input changes
    if (inputValue.trim()) {
      try {
        const result = parseInequality(inputValue);
        if (result && result.latex) {
          setLatexPreview(`\\(${result.latex}\\)`);
        } else {
          setLatexPreview('');
        }
      } catch (error) {
        setLatexPreview('');
      }
    } else {
      setLatexPreview('');
    }
    
    // Trigger MathJax to reprocess the LaTeX
    if (window.MathJax) {
      window.MathJax.typeset();
    }
  }, [inputValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      return;
    }
    
    try {
      // Add the inequality to the parent component
      onSpellCast(inputValue);
      
      // Reset the input field
      setInputValue('');
    } catch (error) {
      console.error('Error casting spell:', error);
    }
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
          
          <button 
            type="submit" 
            className="spellcast-button"
            disabled={!inputValue.trim()}
          >
            Cast Spell
          </button>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
