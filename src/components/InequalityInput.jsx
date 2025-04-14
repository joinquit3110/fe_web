import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseInequality } from '../utils/parser';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [latexPreview, setLatexPreview] = useState('');
  const [isSpellcasting, setIsSpellcasting] = useState(false);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const previewContainerRef = useRef(null);

  // Focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle immediate operator conversion for better UX
  const handleInputChange = (e) => {
    const value = e.target.value;
    
    // Store original cursor position
    const cursorPosition = e.target.selectionStart;
    
    // Check if we need to perform instant operator conversion
    let updatedValue = value;
    let cursorOffset = 0;
    
    // Convert >= or => to ≥
    if (value.includes('>=') || value.includes('=>')) {
      updatedValue = updatedValue.replace(/=>/g, '≥').replace(/>=/g, '≥');
      // Each replacement of two chars with one char means we might need to adjust cursor
      cursorOffset -= (value.split('>=').length - 1) + (value.split('=>').length - 1);
    }
    
    // Convert <= or =< to ≤
    if (value.includes('<=') || value.includes('=<')) {
      updatedValue = updatedValue.replace(/=</g, '≤').replace(/<=/g, '≤');
      // Each replacement of two chars with one char means we might need to adjust cursor
      cursorOffset -= (value.split('<=').length - 1) + (value.split('=<').length - 1);
    }
    
    // Tự động chuyển X, Y viết hoa thành x, y viết thường
    if (/[XY]/.test(updatedValue)) {
      const oldLength = updatedValue.length;
      updatedValue = updatedValue.replace(/X/g, 'x').replace(/Y/g, 'y');
      // Không cần điều chỉnh vị trí con trỏ vì chiều dài không thay đổi khi chuyển hoa thành thường
    }
    
    // Set the value
    setInput(updatedValue);
    
    // If we made a replacement, restore cursor position
    if (updatedValue !== value && inputRef.current) {
      // Adjust cursor position for the removed characters
      const newPosition = Math.max(0, cursorPosition + cursorOffset);
      
      // Need to use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };

  // Format input for Latex display
  const formatLatex = (input) => {
    if (!input) return '';
    
    return `$${input
      .replace(/≤/g, '\\leq')
      .replace(/≥/g, '\\geq')
      .replace(/≠/g, '\\neq')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\*/g, '\\cdot')
      .trim()}$`;
  };

  // Process and clean input - memoized to avoid unnecessary recalculations
  const cleanedInput = useMemo(() => {
    if (!input.trim()) return '';
    
    // Input has already been normalized with symbol replacements in handleInputChange
    return input;
  }, [input]);

  // Enhanced validation with better feedback and syntax suggestions
  useEffect(() => {
    if (!cleanedInput) {
      setIsValid(true);
      setLatexPreview('');
      return;
    }

    // Clear any existing timeout to prevent flashes
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Use a timeout to avoid processing during rapid typing - reduced from 300ms to 150ms
    typingTimeoutRef.current = setTimeout(() => {
      // Prepare input for the parser - convert symbols back to operators
      const parserInput = cleanedInput
        .replace(/≤/g, '<=')
        .replace(/≥/g, '>=')
        .replace(/≠/g, '!=');
      
      // Try to parse the inequality
      const result = parseInequality(parserInput);
      
      if (result) {
        setIsValid(true);
        // Use the direct input for the LaTeX preview instead of the parsed result
        setLatexPreview(formatLatex(cleanedInput));
      } else {
        setIsValid(false);
        
        // Still try to display the LaTeX preview even for invalid input
        try {
          setLatexPreview(formatLatex(cleanedInput));
        } catch (e) {
          // If even this fails, show a basic message
          setLatexPreview('');
        }
      }
    }, 150); // Reduced delay from 300ms to 150ms
    
    // Cleanup function
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [cleanedInput]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!input.trim()) {
      setQuizMessage('Please enter an inequality spell!');
      return;
    }
    
    // Animation for spellcasting
    setIsSpellcasting(true);
    
    // Prepare input for addInequality by converting symbols back to operators
    const processedInput = input
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/≠/g, '!=');
    
    // Delay to show the animation
    setTimeout(() => {
      const result = addInequality(processedInput);
      
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
              onChange={handleInputChange}
              placeholder="Inscribe your arithmancy formula"
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
          
          {/* LaTeX Preview Area - using react-latex-next */}
          <div className="latex-preview-container">
            <div className="latex-preview" ref={previewContainerRef}>
              {latexPreview && (
                <span className="preview-content">
                  <Latex>{latexPreview}</Latex>
                </span>
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
              <span className="spell-icon">💀</span>
              Avada Kedavra
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
