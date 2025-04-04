import React, { useState, useRef } from 'react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ 
  addInequality, 
  setQuizMessage,
  resetAll 
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        setQuizMessage('Please enter an inequality');
        return;
      }

      const parsed = parseInequality(trimmedInput);
      
      if (parsed.error) {
        setQuizMessage('Invalid format!');
        setIsLoading(false);
        return;
      }

      const success = addInequality({
        ...parsed,
        solved: false,
        latex: parsed.latex
      });

      if (success) {
        setInput('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setQuizMessage('An error occurred, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLatex = (input) => {
    if (!input) return '';
    return `$${input
      .replace(/<=>/g, '\\Leftrightarrow')
      .replace(/<=/g, '\\leq')
      .replace(/>=/g, '\\geq')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\*/g, '\\cdot') // Add handling for multiplication character
      .trim()}$`;
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError('');
          }}
          placeholder="Enter inequality (e.g. x + y + 1 > 0)"
          className={`inequality-input ${error ? 'error' : ''}`}
          disabled={isLoading}
        />
        <div className="buttons-container">
          <button
            type="button"
            className="reset-button"
            onClick={resetAll}
          >
            <i className="material-icons" style={{color: '#ffd700'}}>delete_sweep</i>
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {input && !error && (
        <div className="latex-preview">
          <Latex>{formatLatex(input)}</Latex>
        </div>
      )}
    </div>
  );
};

export default InequalityInput;
