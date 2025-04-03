import React, { useState, useEffect, useRef } from 'react';
import { processInequality } from '../utils/inequalityParser';

const COLORS = [
  '#4e31aa', '#2c3e50', '#e74c3c', '#27ae60', 
  '#f39c12', '#8e44ad', '#16a085', '#d35400', 
  '#2980b9', '#c0392b', '#1abc9c', '#f1c40f'
];

const InequalityInput = ({ onAddInequality, inequalities, resetAll, setQuizMessage, isMobile }) => {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  
  // Focus input on mount for desktop devices
  useEffect(() => {
    if (!isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobile]);
  
  const handleInputChange = (e) => {
    setInput(e.target.value);
    
    // Start loading animation
    if (e.target.value) {
      setIsLoading(true);
      
      // Debounce preview generation
      const timeoutId = setTimeout(() => {
        try {
          const equation = processInequality(e.target.value);
          if (equation) {
            setPreview(`${equation.label}: ${equation.latex}`);
          } else {
            setPreview('');
          }
        } catch (err) {
          setPreview('');
        } finally {
          setIsLoading(false);
        }
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else {
      setPreview('');
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!input.trim()) {
      setQuizMessage("Vui lòng nhập bất phương trình!");
      return;
    }
    
    try {
      // Process inequality string
      const equation = processInequality(input);
      
      if (!equation) {
        setQuizMessage("Có lỗi khi xử lý bất phương trình. Vui lòng kiểm tra lại!");
        return;
      }
      
      // Assign a color from our palette
      const color = COLORS[inequalities.length % COLORS.length];
      const newInequality = {
        ...equation,
        color,
        solved: false
      };
      
      const success = onAddInequality(newInequality);
      
      if (success) {
        // Clear input on success
        setInput('');
        setPreview('');
      }
    } catch (err) {
      setQuizMessage("Cú pháp không hợp lệ. Vui lòng kiểm tra lại!");
    }
  };
  
  return (
    <div className="inequality-input-container">
      <form className="inequality-form" onSubmit={handleSubmit}>
        <div className="form-header">
          <h3>Nhập Bất Phương Trình</h3>
          <div className="magical-icon wand"></div>
          <button 
            type="button" 
            className="reset-button" 
            onClick={resetAll}
            title="Xóa tất cả bất phương trình"
          >
            <i className="material-icons">restart_alt</i>
          </button>
        </div>
        
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            className="inequality-input"
            placeholder="Ví dụ: 2x + 3y < 6"
            aria-label="Nhập bất phương trình"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button 
            type="submit" 
            className="submit-btn"
            disabled={isLoading}
            aria-label="Thêm bất phương trình"
          >
            {isLoading ? (
              <div className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </div>
            ) : (
              <i className="material-icons">add</i>
            )}
          </button>
        </div>
        
        {(preview || isLoading) && (
          <div className="preview-container">
            <div className="preview-label">Preview:</div>
            <div className="latex-preview">
              {isLoading ? (
                <div className="loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: preview }} />
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default InequalityInput;
