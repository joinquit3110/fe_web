import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
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
  }, []);

  // Format input for LaTeX preview
  const formatLatex = (input) => {
    // Basic formatting - could be expanded for more complex inequalities
    return input.replace(/</g, "<").replace(/>/g, ">");
  };

  // Update LaTeX preview whenever input changes
  useEffect(() => {
    setLatexPreview(formatLatex(inputValue));
  }, [inputValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setQuizMessage('Please enter an inequality');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/inequality`, {
        inequality: inputValue,
      });

      if (response.data.success) {
        addInequality(response.data.inequality);
        setInputValue("");
        setQuizMessage({
          text: "Inequality added successfully!",
          type: "success",
        });
        setTimeout(() => setQuizMessage(null), 3000);
      } else {
        setError(response.data.message || "Failed to add inequality");
      }
    } catch (err) {
      console.error("Error adding inequality:", err);
      setQuizMessage(
        err.response?.data?.message ||
          "Failed to add inequality. Please check your input and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inequality-input-container">
      <form onSubmit={handleSubmit} className="inequality-form">
        <div className="form-header">
          <h3>Add a New Spell (Inequality)</h3>
          <div className="magical-icon wand"></div>
        </div>
        
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            placeholder="Enter your inequality (e.g., x > 0)"
            disabled={isLoading}
            className="inequality-input"
          />
          <button 
            type="submit" 
            disabled={isLoading} 
            className="submit-btn"
          >
            {isLoading ? (
              <span className="loading-dots">Casting<span>.</span><span>.</span><span>.</span></span>
            ) : (
              "Cast Spell"
            )}
          </button>
        </div>
        
        {inputValue && (
          <div className="preview-container">
            <div className="preview-label">Preview:</div>
            <div className="latex-preview">
              <MathJax>{"\\(" + latexPreview + "\\)"}</MathJax>
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
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
