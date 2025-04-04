import React, { useState, useRef, useEffect } from "react";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import './styles/App.css';
import './styles/HarryPotter.css';

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
  const [quizMessage, setQuizMessage] = useState('');
  const [hoveredEq, setHoveredEq] = useState(null);
  const coordinatePlaneRef = useRef(null);
  
  const handleAddInequality = (newInequality) => {
    return coordinatePlaneRef.current?.handleAddInequality(newInequality);
  };

  const resetAll = () => {
    coordinatePlaneRef.current?.resetView();
    setInequalities([]);
    setQuizMessage('');
    setHoveredEq(null);
  };

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
      </header>
      
      <div className="hogwarts-content">
        {/* Control Panel */}
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

        {/* Message Box */}
        <div className="message-box">
          {quizMessage && (
            <div className={`message ${
              quizMessage.includes('Correct') ? 'success' :
              quizMessage.includes('Incorrect') || quizMessage.includes('wrong') ? 'error' :
              quizMessage.includes('exists') ? 'warning' :
              quizMessage.includes('Format') ? 'error' :
              quizMessage.includes('Please enter') ? 'info' :
              quizMessage.includes('Enter coordinate') ? 'info' :
              quizMessage.includes('correct') ? 'success' : ''
            }`}>
              {quizMessage.includes('Correct') && <i className="material-icons">check_circle</i>}
              {quizMessage.includes('Incorrect') && <i className="material-icons">error</i>}
              {quizMessage.includes('exists') && <i className="material-icons">warning</i>}
              {quizMessage.includes('Format') && <i className="material-icons">format_clear</i>}
              {(quizMessage.includes('Please enter') || quizMessage.includes('Enter coordinate')) && 
                <i className="material-icons">info</i>}
              {quizMessage}
            </div>
          )}
        </div>

        {/* Coordinate Plane */}
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

        {/* Inequalities List */}
        <div className="inequalities-list wizard-panel">
          <div className="panel-decoration left"></div>
          <div className="panel-decoration right"></div>
          <h2>Spells Collection</h2>
          <div className="scroll-container">
            {inequalities.length > 0 ? (
              inequalities.map((ineq, index) => (
                <div
                  key={index}
                  className="inequality-item"
                  style={{ 
                    borderLeftColor: ineq.color,
                    background: hoveredEq?.label === ineq.label ? 'rgba(211, 166, 37, 0.2)' : 'rgba(14, 26, 64, 0.6)',
                    '--index': index
                  }}
                  onMouseEnter={() => handleListItemHover(ineq)}
                  onMouseLeave={() => handleListItemHover(null)}
                >
                  <span 
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
