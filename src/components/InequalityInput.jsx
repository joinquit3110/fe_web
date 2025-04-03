import React, { useState, useRef, useEffect } from "react";
import { MathJax } from "better-react-mathjax";
import 'katex/dist/katex.min.css';
import { parseInequality } from '../utils/parser';

const InequalityInput = ({ 
  addInequality, 
  setQuizMessage,
  resetAll 
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [latexPreview, setLatexPreview] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus the input field when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Add meta viewport tag to prevent zoom on input focus
    const viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(viewportMeta);
    
    return () => {
      // Restore normal viewport behavior when component unmounts
      document.head.removeChild(viewportMeta);
    };
  }, []);

  // Format input for LaTeX preview
  const formatLatex = (input) => {
    if (!input) return '';
    return input
      .replace(/<=>/g, '\\Leftrightarrow')
      .replace(/<=/g, '\\leq')
      .replace(/>=/g, '\\geq')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\*/g, '\\cdot');
  };

  // Update LaTeX preview whenever input changes
  useEffect(() => {
    setLatexPreview(formatLatex(inputValue));
  }, [inputValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setQuizMessage('Vui lòng nhập bất phương trình');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const trimmedInput = inputValue.trim();
      
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
        setInputValue("");
        setQuizMessage("Thêm bất phương trình thành công!");
        setTimeout(() => setQuizMessage(null), 3000);
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Error adding inequality:", err);
      setQuizMessage('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit} className="inequality-form">
        <div className="form-header">
          <h3>Thêm Phép Thuật (Bất Phương Trình)</h3>
          <div className="magical-icon wand"></div>
          <button
            type="button"
            className="reset-button"
            onClick={resetAll}
            title="Xóa tất cả bất phương trình"
          >
            <i className="material-icons">delete_sweep</i>
          </button>
        </div>
        
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            placeholder="Nhập bất phương trình (vd: x + y + 1 > 0)"
            disabled={isLoading}
            className="inequality-input"
          />
          <button 
            type="submit" 
            disabled={isLoading} 
            className="submit-btn"
          >
            {isLoading ? (
              <span className="loading-dots">Đang tạo<span>.</span><span>.</span><span>.</span></span>
            ) : (
              "Tạo phép thuật"
            )}
          </button>
        </div>
        
        {inputValue && (
          <div className="preview-container">
            <div className="preview-label">Xem trước:</div>
            <div className="latex-preview">
              <MathJax>{`\\(${latexPreview}\\)`}</MathJax>
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <i className="material-icons">error</i>
            {error}
          </div>
        )}
        
        <div className="magical-footer">
          <div className="scroll-decoration"></div>
          <div className="quill-decoration"></div>
        </div>
      </form>
    </div>
  );
};

export default InequalityInput;
