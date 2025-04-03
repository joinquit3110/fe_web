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
        setQuizMessage('Vui lòng nhập bất phương trình');
        return;
      }

      const parsed = parseInequality(trimmedInput);
      
      if (parsed.error) {
        setQuizMessage('Định dạng không hợp lệ!');
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
      setQuizMessage('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLatex = (input) => {
    if (!input) return '';
    return input
      .replace(/<=>/g, '\\Leftrightarrow')
      .replace(/<=/g, '\\leq')
      .replace(/>=/g, '\\geq')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\*/g, '\\cdot')
      .replace(/\+/g, '+')
      .replace(/-/g, '-')
      .trim();
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit} className="inequality-form">
        <div className="form-header">
          <h3>Nhập bất phương trình</h3>
          <button
            type="button"
            className="reset-button"
            onClick={resetAll}
            title="Xóa tất cả bất phương trình"
          >
            <i className="material-icons">delete_sweep</i>
          </button>
        </div>
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError('');
            }}
            placeholder="Nhập bất phương trình (vd: x + y + 1 > 0)"
            className={`inequality-input ${error ? 'error' : ''}`}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </div>
            ) : (
              <i className="material-icons">arrow_forward</i>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {input && !error && (
        <div className="preview-container">
          <div className="latex-preview">
            <Latex>{`$${formatLatex(input)}$`}</Latex>
          </div>
        </div>
      )}
    </div>
  );
};

export default InequalityInput;
