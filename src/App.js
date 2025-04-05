import React, { useState, useRef, useEffect } from "react";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import './styles/App.css';
import './styles/HarryPotter.css';
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
    <div className="app mobile-optimized">
      <UserProfile />
      
      <header className="hogwarts-header">
        <h1>Hogwarts School of <span className="highlight">Inequality Magic</span></h1>
      </header>
      
      <div className="hogwarts-content">
        {/* 1. Control Panel - Cast Spell at top */}
        <div className="control-panel wizard-panel">
          <div className="control-panel-content">
            <h2>Professor's Spellbook</h2>
            <InequalityInput 
              addInequality={handleAddInequality}
              setQuizMessage={setQuizMessage}
              resetAll={resetAll}
            />
          </div>
        </div>

        {/* 2. Message Box - Always show a message */}
        <div className={`message-box ${message.type}`}>
          <div className="message-content">{message.text || "Welcome to Hogwarts School of Inequality Magic! Cast your first spell by entering an inequality."}</div>
        </div>

        {/* 3. Coordinate Plane */}
        <div className="coordinate-container wizard-panel">
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
          <h2>Spells Collection</h2>
          <div className="scroll-container">
            {inequalities.length > 0 ? (
              inequalities.map((ineq, index) => (
                <div
                  key={index}
                  className="inequality-item"
                  style={{ 
                    borderLeftColor: ineq.color,
                    background: hoveredEq?.label === ineq.label ? 'rgba(211, 166, 37, 0.2)' : 'rgba(14, 26, 64, 0.7)',
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
