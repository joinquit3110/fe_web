import React, { useState } from 'react';

const InequalityInput = ({ addInequality, setQuizMessage, resetAll }) => {
  const [inputValue, setInputValue] = useState('');
  const [quizMode, setQuizMode] = useState(false);
  const [pointsMode, setPointsMode] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      setQuizMessage('Please enter an inequality spell');
      return;
    }
    
    try {
      const result = addInequality(inputValue);
      
      if (result === 'EXISTS') {
        setQuizMessage('This spell has already been cast');
      } else if (result) {
        setInputValue('');
        setQuizMessage('Spell successfully cast!');
      } else {
        setQuizMessage('Incorrect spell format. Try examples like: x+y<0, 2x-3y+1≥0, x>-2');
      }
    } catch (error) {
      console.error('Error adding inequality:', error);
      setQuizMessage('Your spell misfired. Please try again.');
    }
  };

  const toggleQuizMode = () => {
    setQuizMode(prev => !prev);
    resetAll();
    if (pointsMode) setPointsMode(false);
    setQuizMessage(prev => quizMode ? '' : 'O.W.L. Exam mode activated. Find the correct inequalities!');
  };

  const togglePointsMode = () => {
    setPointsMode(prev => !prev);
    resetAll();
    if (quizMode) setQuizMode(false);
    setQuizMessage(prev => pointsMode ? '' : 'Magical Points mode activated. Plot points to create regions.');
  };

  return (
    <div className="inequality-input">
      <h3 className="control-title">Spell Formula</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Cast your inequality spell (e.g., x+y<0)"
            disabled={quizMode || pointsMode}
            className="inequality-input-field"
          />
          <button 
            type="submit" 
            className="add-btn"
            disabled={quizMode || pointsMode}
            title="Cast Spell"
          >
            <i className="material-icons">auto_fix_high</i>
          </button>
        </div>
      </form>
      
      <div className="mode-controls">
        <button 
          className={`mode-btn ${quizMode ? 'active' : ''}`} 
          onClick={toggleQuizMode}
          title="O.W.L. Exam Mode"
        >
          <i className="material-icons">school</i> 
          <span>O.W.L. Exam</span>
        </button>
        
        <button 
          className={`mode-btn ${pointsMode ? 'active' : ''}`} 
          onClick={togglePointsMode}
          title="Plot Magical Points"
        >
          <i className="material-icons">place</i>
          <span>Magical Points</span>
        </button>
        
        <button 
          className="reset-btn" 
          onClick={resetAll}
          title="Clear All Spells"
        >
          <i className="material-icons">restart_alt</i>
          <span>Finite Incantatem</span>
        </button>
      </div>
    </div>
  );
};

export default InequalityInput;
