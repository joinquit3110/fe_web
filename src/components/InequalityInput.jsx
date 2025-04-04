import React, { useState, useEffect, useRef } from 'react';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState('');
  const [showLatex, setShowLatex] = useState(false);
  const [latexPreview, setLatexPreview] = useState('');
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
        } else if (!input.includes('0') && !input.endsWith('=0') && !input.endsWith('<0') && !input.endsWith('>0')) {
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
      // Successfully added
      setInput('');
      setShowLatex(false);
      setLatexPreview('');
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
    setLatexPreview('');
    setIsValid(true);
    setError('');
  };
  
  const getExampleInequality = () => {
    const examples = [
      'x+y<0',
      'x-y>=0',
      '2x+3y-6<=0',
      'x=0',
      'y=0',
      'y=2x+1',
      'x+y=1'
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    setInput(randomExample);
    // Let the useEffect handle validation and preview
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
            {!error && input && isValid && (
              <div className="valid-message">Valid inequality format ✓</div>
            )}
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
              className="example-button"
              onClick={getExampleInequality}
              title="Get an example inequality"
            >
              <span className="material-icons">auto_fix_high</span>
              Example
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
              <span className="preview-label">Preview: </span>
              <span 
                className="preview-content"
                dangerouslySetInnerHTML={{ __html: latexPreview }}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default InequalityInput;
