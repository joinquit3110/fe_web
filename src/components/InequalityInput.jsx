import React, { useState } from 'react';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [inputValue, setInputValue] = useState('');
  const [quizMode, setQuizMode] = useState(false);
  const [pointsMode, setPointsMode] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      setQuizMessage('Please enter an inequality');
      return;
    }
    
    try {
      const result = addInequality(inputValue);
      
      if (result === 'EXISTS') {
        setQuizMessage('This inequality already exists');
      } else if (result) {
        setInputValue('');
      } else {
        setQuizMessage('Incorrect format. Try examples like: x+y<0, 2x-3y+1≥0, x>-2');
      }
    } catch (error) {
      console.error('Error adding inequality:', error);
      setQuizMessage('An error occurred. Please try again.');
    }
  };

  const toggleQuizMode = () => {
    setQuizMode(prev => !prev);
    resetAll();
    if (pointsMode) setPointsMode(false);
    setQuizMessage('');
  };

  const togglePointsMode = () => {
    setPointsMode(prev => !prev);
    resetAll();
    if (quizMode) setQuizMode(false);
    setQuizMessage('');
  };

  return (
    <div className="inequality-input">
      <h3 className="control-title">Input Inequality</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter inequality (e.g., x+y<0)"
            disabled={quizMode || pointsMode}
            className="inequality-input-field"
          />
          <button 
            type="submit" 
            className="add-btn"
            disabled={quizMode || pointsMode}
          >
            <i className="material-icons">add</i>
          </button>
        </div>
      </form>
      
      <div className="mode-controls">
        <button 
          className={`mode-btn ${quizMode ? 'active' : ''}`} 
          onClick={toggleQuizMode}
        >
          <i className="material-icons">quiz</i> 
          <span>Quiz Mode</span>
        </button>
        
        <button 
          className={`mode-btn ${pointsMode ? 'active' : ''}`} 
          onClick={togglePointsMode}
        >
          <i className="material-icons">place</i>
          <span>Points Mode</span>
        </button>
        
        <button 
          className="reset-btn" 
          onClick={resetAll}
        >
          <i className="material-icons">refresh</i>
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

export default InequalityInput;
