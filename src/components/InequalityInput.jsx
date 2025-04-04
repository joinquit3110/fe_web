import React, { useState, useRef, useEffect } from 'react';
import { processInequality } from '../utils/inequalityParser';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import '../styles/App.css';

const InequalityInput = ({ onAddInequality, inequalities }) => {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  // Handle input changes with debounce for preview
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim()) {
        const result = processInequality(input);
        if (result) {
          setPreview(result.latex);
          setError('');
        } else {
          setPreview('');
          setError('Định dạng không hợp lệ!');
        }
      } else {
        setPreview('');
        setError('');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const result = processInequality(input);
      if (result) {
        await onAddInequality(result);
        setInput('');
        setPreview('');
        setError('');
      } else {
        setError('Định dạng không hợp lệ!');
      }
    } catch (err) {
      setError('Có lỗi xảy ra!');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setInput('');
    setPreview('');
    setError('');
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit} className="inequality-form">
        <div className="form-header">
          <h2>Nhập Bất Phương Trình</h2>
          <button
            type="button"
            className="reset-button"
            onClick={resetAll}
            title="Reset tất cả"
          >
            <i className="fas fa-magic"></i>
          </button>
        </div>
        
        <div className="input-group">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ví dụ: 2x + 3y < 6"
            className="inequality-input"
            autoComplete="off"
          />
          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <span className="loading-dots">...</span>
            ) : (
              'Thêm'
            )}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {preview && (
          <div className="preview-container">
            <div className="preview-label">Xem trước:</div>
            <div className="latex-preview">
              <MathJaxContext>
                <MathJax>{`$$${preview}$$`}</MathJax>
              </MathJaxContext>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default InequalityInput;
