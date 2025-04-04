import React, { useState, useRef, useEffect } from "react";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import './styles/App.css';

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
      <div className="stars">
        <div className="small-stars">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="star" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: '2px',
              height: '2px'
            }} />
          ))}
        </div>
        <div className="medium-stars">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="star" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: '3px',
              height: '3px'
            }} />
          ))}
        </div>
      </div>
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
      
      <header className="farm-header">
        <h1>Học cùng thầy Vĩ <span className="highlight">chỉ điểm 10!</span></h1>
      </header>
      
      <div className="farm-content">
        <div className="control-panel farm-panel">
          <div className="control-panel-content">
            <InequalityInput 
              addInequality={handleAddInequality}
              setQuizMessage={setQuizMessage}
              resetAll={resetAll}
            />
          </div>
        </div>

        <div className="message-box">
          {quizMessage && (
            <div className={`message ${
              quizMessage.includes('Chính xác') ? 'success' :
              quizMessage.includes('Sai') || quizMessage.includes('sai') ? 'error' :
              quizMessage.includes('tồn tại') ? 'warning' :
              quizMessage.includes('Định dạng') ? 'error' :
              quizMessage.includes('Vui lòng nhập') ? 'info' :
              quizMessage.includes('Nhập tọa độ') ? 'info' :
              quizMessage.includes('đúng') ? 'success' : ''
            }`}>
              {quizMessage.includes('Chính xác') && <i className="material-icons">check_circle</i>}
              {quizMessage.includes('Sai') && <i className="material-icons">error</i>}
              {quizMessage.includes('tồn tại') && <i className="material-icons">warning</i>}
              {quizMessage.includes('Định dạng') && <i className="material-icons">format_clear</i>}
              {(quizMessage.includes('Vui lòng nhập') || quizMessage.includes('Nhập tọa độ')) && 
                <i className="material-icons">info</i>}
              {quizMessage}
            </div>
          )}
        </div>

        <div className="coordinate-container farm-panel">
          <div className="tree-decoration"></div>
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

        <div className="inequalities-list farm-panel">
          <div className="cow-decoration"></div>
          <div className="chicken-decoration"></div>
          {inequalities.map((ineq, index) => (
            <div
              key={index}
              className="inequality-item"
              style={{ 
                borderLeftColor: ineq.color,
                background: hoveredEq?.label === ineq.label ? '#fff3e0' : '#fff',
                '--index': index // Add animation delay index
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
          ))}
        </div>
      </div>
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
