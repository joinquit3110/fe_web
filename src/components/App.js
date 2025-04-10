import React, { useState, useRef, useEffect } from "react";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import './styles/App.css';
import './styles/HarryPotter.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import UserProfile from './components/UserProfile';
import Profile from './components/Profile';

const AppContent = () => {
  const { user } = useAuth();
  const [inequalities, setInequalities] = useState([]);
  const [message, setMessage] = useState({ 
    text: "Welcome to Hogwarts School of Inequality Magic! Cast your first spell by entering an inequality.", 
    type: "info" 
  });
  const [hoveredEq, setHoveredEq] = useState(null);
  const [quizMessage, setQuizMessage] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const coordinatePlaneRef = useRef(null);
  
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

  const resetAll = () => {
    coordinatePlaneRef.current?.resetView();
    setInequalities([]);
    setQuizMessage('');
    setHoveredEq(null);
    setMessage({
      text: "The magical plane has been reset. Ready for your next spell!",
      type: "info"
    });
  };

  useEffect(() => {
    if (quizMessage) {
      setMessage({
        text: quizMessage,
        type: quizMessage.includes('Incorrect') || quizMessage.includes('Error') 
          ? 'error' 
          : (quizMessage.includes('Correct') ? 'success' : 'info')
      });
    }
  }, [quizMessage]);

  useEffect(() => {
    if (window.MathJax && window.MathJax.typeset) {
      setTimeout(() => {
        window.MathJax.typeset();
      }, 100);
    }
  }, [inequalities]);

  const handleListItemHover = (equation) => {
    setHoveredEq(equation);
  };

  const handleDelete = (e, inequality) => {
    e.stopPropagation();
    setInequalities(prev => prev.filter(item => item.label !== inequality.label));
    setQuizMessage('');
  };
  
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
        <Profile user={user} />
      </header>
      
      {/* Message Box - Moved outside the main grid */}
      <div className={`message-box ${message.type}`}>
        <div className="message-content">{message.text || "Welcome to Hogwarts School of Inequality Magic! Cast your first spell by entering an inequality."}</div>
      </div>

      <div className="hogwarts-content">
        {/* 1. Control Panel - Cast Spell */}
        <div className="control-panel wizard-panel">
          <div className="panel-decoration left"></div>
          <div className="panel-decoration right"></div>
          <div className="control-panel-content">
            <h2>Professor's Spellbook</h2>
            <InequalityInput 
              addInequality={handleAddInequality}
              setQuizMessage={setQuizMessage}
              resetAll={resetAll}
            />
          </div>
        </div>

        {/* 3. Coordinate Plane */}
        <div className="coordinate-container wizard-panel">
          <div className="panel-decoration left"></div>
          <div className="panel-decoration right"></div>
          <h2>Magical Coordinate Plane</h2>
          <div className="coordinate-plane">
            <CoordinatePlane
              ref={coordinatePlaneRef}
              inequalities={inequalities}
              setInequalities={setInequalities}
              setQuizMessage={setQuizMessage}
              hoveredEq={hoveredEq}
              setHoveredEq={setHoveredEq}
            />
          </div>
        </div>

        {/* 4. Inequalities List at bottom */}
        <div className="inequalities-list wizard-panel">
          <div className="panel-decoration left"></div>
          <div className="panel-decoration right"></div>
          <h2>Spells Collection</h2>
          <div className="scroll-container">
            {inequalities.length > 0 ? (
              inequalities.map((ineq, index) => (
                <div
                  key={index}
                  className={`inequality-item ${ineq.solved ? (ineq.isCorrect ? 'correct' : 'incorrect') : ''}`}
                  style={{ 
                    borderLeftColor: ineq.color,
                    background: hoveredEq?.label === ineq.label ? 'rgba(211, 166, 37, 0.2)' : 'rgba(14, 26, 64, 0.6)',
                    '--index': index
                  }}
                  onMouseEnter={() => handleListItemHover(ineq)}
                  onMouseLeave={() => handleListItemHover(null)}
                >
                  <span 
                    className="latex-content"
                    dangerouslySetInnerHTML={{ 
                      __html: `\\(${ineq.label}:\\; ${ineq.latex}\\)` 
                    }}
                  />
                  <span 
                    className="delete-icon material-icons"
                    onClick={(e) => handleDelete(e, ineq)}
                  >
                    delete
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-spells">Cast your first inequality spell!</div>
            )}
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