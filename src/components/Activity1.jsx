import React, { useEffect, useState } from 'react';
import LinearInequalitiesActivity from './LinearInequalitiesActivity';
import { ActivityStateProvider, useActivityState } from '../context/ActivityStateContext';
import { useMagicPoints } from '../context/MagicPointsContext';
import { useAdmin } from '../contexts/AdminContext';
import AdminUserManagement from './AdminUserManagement';

const MagicalBackground = () => {
  return (
    <div className="magical-background" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--background-color)',
      backgroundImage: 'url("/images/hogwarts-bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      zIndex: -1,
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 12, 23, 0.85)',
      }
    }} />
  );
};

const FloatingStars = () => {
  return (
    <div className="floating-stars" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: 0
    }}>
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="star"
          style={{
            position: 'absolute',
            width: Math.random() * 3 + 1 + 'px',
            height: Math.random() * 3 + 1 + 'px',
            background: 'var(--secondary-color)',
            borderRadius: '50%',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            animation: `twinkle ${Math.random() * 2 + 2}s ease-in-out infinite`,
            opacity: Math.random() * 0.5 + 0.3
          }}
        />
      ))}
    </div>
  );
};

const ActivityContent = () => {
  const { blankActivityState, updateBlankActivityState } = useActivityState();
  const [revelioResetDone, setRevelioResetDone] = useState(false);
  const { 
    handleInequalityFormatCheck,
    handleInequalitySolutionCheck,
    handleBlankRevelioAttempt,
    handleMultipleRevelioAttempts,
    resetRevelioAttempts
  } = useMagicPoints();
  
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!revelioResetDone) {
      resetRevelioAttempts();
      setRevelioResetDone(true);
    }
  }, [resetRevelioAttempts, revelioResetDone]);

  const handleCharmBlanksSubmission = (blanksResults) => {
    handleMultipleRevelioAttempts(blanksResults);
  };

  const handleInequalitySolution = (systemHasSolution, selectedNoSolution, isSolutionCorrect) => {
    handleInequalitySolutionCheck(systemHasSolution, selectedNoSolution, isSolutionCorrect);
  };

  const handleFormatCheck = (isValid, index) => {
    handleInequalityFormatCheck(isValid, index);
  };

  return (
    <div className="magical-activity-wrapper">
      <MagicalBackground />
      <FloatingStars />
      
      <div className="activity-content">
        {isAdmin ? (
          <AdminUserManagement />
        ) : (
    <LinearInequalitiesActivity 
      blankState={blankActivityState}
      updateBlankState={updateBlankActivityState}
      onSubmission={handleCharmBlanksSubmission}
      onInequalitySolution={handleInequalitySolution}
      onFormatCheck={handleFormatCheck}
    />
        )}
      </div>
    </div>
  );
};

const Activity1 = () => {
  return (
    <ActivityStateProvider>
      <div className="magical-activity">
        <header className="magical-header">
          <h1 className="magical-heading">
            Transfiguration Class: Linear Inequalities
          </h1>
          <div className="magical-decoration-wrapper">
            <img 
              src="/images/wand-sparkle.gif" 
              alt="Magical sparkle" 
              className="magical-sparkle"
              style={{
                position: 'absolute',
                width: '50px',
                height: '50px',
                animation: 'float 3s ease-in-out infinite'
              }}
            />
          </div>
        </header>
        
      <ActivityContent />
        
        <footer className="magical-footer">
          <div className="magical-border">
            <p className="magical-text">
              "Happiness can be found even in the darkest of times, 
              if one only remembers to turn on the light." - Albus Dumbledore
            </p>
          </div>
        </footer>
      </div>
    </ActivityStateProvider>
  );
};

export default Activity1;
