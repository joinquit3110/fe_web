import React, { useState, useRef, useEffect } from "react";
import EnhancedInequalityInput from "./components/EnhancedInequalityInput";
import EnhancedCoordinatePlane from "./components/EnhancedCoordinatePlane";
import InequalityList from "./components/InequalityList";
import { resetLabelCounter } from "./utils/inequalityAlgorithms";
import './styles/App.css';
import './styles/HarryPotter.css';
import './styles/enhanced-inequality.css';

// Import images
import sunImage from './assets/sun.png';
import farmerImage from './assets/farmer.png';
import cowImage from './assets/cow.png';
import treeImage from './assets/tree.png';
import chickenImage from './assets/chicken.png';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import UserProfile from './components/UserProfile';

const AppContent = () => {
  const { user } = useAuth();
  const [inequalities, setInequalities] = useState([]);
  const [message, setMessage] = useState({ 
    text: "Welcome to Hogwarts School of Inequality Magic! Cast your first spell by entering an inequality.", 
    type: "info" 
  });
  const [hoveredEq, setHoveredEq] = useState(null);
  const coordinatePlaneRef = useRef(null);
  
  // Handle adding a new inequality
  const handleAddInequality = (newInequality) => {
    const result = coordinatePlaneRef.current?.handleAddInequality(newInequality);
    
    if (result === true) {
      setMessage({
        text: "Spell cast successfully! Your inequality has been added to the magical plane.",
        type: "success"
      });
      
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typeset) {
          window.MathJax.typeset();
        }
      }, 200);
    }
    
    return result;
  };

  // Handle reset all
  const resetAll = () => {
    coordinatePlaneRef.current?.resetView();
    setInequalities([]);
    resetLabelCounter();
    setHoveredEq(null);
    setMessage({
      text: "The magical plane has been reset. Ready for your next spell!",
      type: "info"
    });
  };

  // Handle setting quiz/feedback messages
  const setQuizMessage = (text) => {
    if (!text) return;
    
    const type = 
      text.includes('Incorrect') || text.includes('Error') 
        ? 'error' 
        : (text.includes('Correct') ? 'success' : 'info');
    
    setMessage({ text, type });
  };

  // Handle deleting an inequality
  const handleDeleteInequality = (inequality) => {
    setInequalities(prev => prev.filter(item => item.label !== inequality.label));
    setMessage({
      text: `Inequality ${inequality.label} removed from the magical plane.`,
      type: "info"
    });
  };

  // Handle showing region selection buttons
  const handleShowRegionSelect = (inequalityLabel) => {
    coordinatePlaneRef.current?.showRegionButtons(inequalityLabel);
  };

  // Render MathJax whenever inequalities change
  useEffect(() => {
    if (window.MathJax && window.MathJax.typeset) {
      setTimeout(() => {
        window.MathJax.typeset();
      }, 100);
    }
  }, [inequalities]);
  
  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <UserProfile />
      
      {/* Dynamic Stars Background */}
      <div className="stars">
        <div className="small-stars">
          {[...Array(40)].map((_, i) => (
            <div key={i} className="star" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`
            }} />
          ))}
        </div>
        <div className="medium-stars">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="star" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`
            }} />
          ))}
        </div>
      </div>
      
      {/* Magical Moon */}
      <div className="moon-wrapper">
        <div className="moonlight moonlight-1">
          <div className="moonlight moonlight-2">
            <div className="moonlight moonlight-3">
              <div className="moonlight moonlight-4">
                <div className="moon" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hogwarts Crest */}
      <div className="hogwarts-crest"></div>
      
      <header className="hogwarts-header">
        <h1>Hogwarts School of <span className="highlight">Inequality Magic</span></h1>
      </header>
      
      <div className="hogwarts-content mobile-friendly">
        {/* 1. Inequality Input - Cast Spell */}
        <div className="control-panel wizard-panel">
          <div className="panel-decoration left"></div>
          <div className="panel-decoration right"></div>
          <div className="control-panel-content">
            <h2>Professor's Spellbook</h2>
            <EnhancedInequalityInput 
              addInequality={handleAddInequality}
              setQuizMessage={setQuizMessage}
              resetAll={resetAll}
            />
          </div>
        </div>

        {/* 2. Message Box - Always show a message */}
        <div className={`message-box ${message.type}`}>
          <div className="message-content">{message.text}</div>
        </div>

        <div className="main-content-row">
          {/* 3. Enhanced Coordinate Plane */}
          <div className="coordinate-container wizard-panel">
            <div className="panel-decoration left"></div>
            <div className="panel-decoration right"></div>
            <h2>Magical Coordinate Plane</h2>
            <div className="coordinate-plane">
              <EnhancedCoordinatePlane
                ref={coordinatePlaneRef}
                inequalities={inequalities}
                setInequalities={setInequalities}
                setQuizMessage={setQuizMessage}
                hoveredEq={hoveredEq}
                setHoveredEq={setHoveredEq}
              />
            </div>
          </div>

          {/* 4. Inequality List */}
          <div className="inequalities-list wizard-panel">
            <div className="panel-decoration left"></div>
            <div className="panel-decoration right"></div>
            <InequalityList
              inequalities={inequalities}
              onDelete={handleDeleteInequality}
              onHover={setHoveredEq}
              onShowRegionSelect={handleShowRegionSelect}
            />
          </div>
        </div>
      </div>
      
      <footer className="hogwarts-footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} Hogwarts School of Inequality Magic</p>
        </div>
      </footer>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
