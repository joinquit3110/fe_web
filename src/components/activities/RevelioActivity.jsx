import React, { useState, useEffect } from 'react';
import { useMagicPoints } from '../../context/MagicPointsContext';

const RevelioActivity = () => {
  const [userAnswer, setUserAnswer] = useState('');
  const { handleRevelioAttempt, resetRevelioAttempt, logCurrentPoints } = useMagicPoints();
  
  // Reset the attempt counter when component mounts (new activity)
  useEffect(() => {
    resetRevelioAttempt();
  }, [resetRevelioAttempt]); // Add dependency

  const checkAnswer = () => {
    console.log(`[REVELIO] Checking answer: "${userAnswer}"`);
    
    // Compare user's answer with the correct one
    const isCorrect = userAnswer.toLowerCase() === 'correct_answer_here'.toLowerCase();
    
    // Handle points and log current total
    handleRevelioAttempt(isCorrect);
    logCurrentPoints();
    
    // Handle UI feedback here...
  };

  // Component JSX...
  
  return (
    <div>
      {/* Your UI components here */}
    </div>
  );
};

export default RevelioActivity;
