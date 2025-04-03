import React, { useState, useRef, useEffect } from "react";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import './styles/App.css';

// Import images
import chickenImage from './assets/chicken.png';
import cowImage from './assets/cow.png';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import UserProfile from './components/UserProfile';

const AppContent = () => {
  const { user } = useAuth();
  const [inequalities, setInequalities] = useState([]);
  const [quizMessage, setQuizMessage] = useState('');
  const [hoveredEq, setHoveredEq] = useState(null);
  const coordinatePlaneRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleAddInequality = (newInequality) => {
    const lastIndex = inequalities.length > 0 ? parseInt(inequalities[inequalities.length - 1].label.replace('d_', ''), 10) : 0;
    const newIndex = lastIndex + 1;
    const labeledInequality = {
      ...newInequality,
      label: `d_${newIndex}`
    };
    setInequalities(prev => [...prev, labeledInequality]);
    return true;
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
    const filteredInequalities = inequalities.filter(item => item.label !== inequality.label);
    
    // Rename all inequalities to ensure sequential numbering
    const renamedInequalities = filteredInequalities.map((ineq, index) => ({
      ...ineq,
      label: `d_${index + 1}`
    }));
    
    setInequalities(renamedInequalities);
    setQuizMessage('');
  };
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2 className="loading-text">Đang tải...</h2>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <div className="background-container">
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
        <div className="moon"></div>
      </div>

      <UserProfile />

      <header className="farm-header">
        <h1>Học cùng thầy Vĩ <span className="highlight">chỉ điểm 10!</span></h1>
        <div className="magical-decoration hat" style={{ top: '10%', left: '5%' }}></div>
        <div className="magical-decoration wand" style={{ top: '20%', right: '5%' }}></div>
      </header>

      <main className="farm-content">
        <div className="control-panel farm-panel">
          <div className="control-panel-content">
            <div className="magical-decoration book" style={{ top: '10px', right: '10px' }}></div>
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
          <div className="magical-decoration potion" style={{ bottom: '10px', left: '10px' }}></div>
          <CoordinatePlane
            ref={coordinatePlaneRef}
            inequalities={inequalities}
            setInequalities={setInequalities}
            setQuizMessage={setQuizMessage}
            hoveredEq={hoveredEq}
            setHoveredEq={setHoveredEq}
            isMobile={isMobile}
          />
        </div>

        <div className="inequalities-list farm-panel">
          <div className="cow-decoration"></div>
          <div className="chicken-decoration"></div>
          <h3>Danh sách bất phương trình</h3>
          {inequalities.map((ineq, index) => (
            <div
              key={index}
              className="inequality-item"
              style={{ 
                borderLeftColor: ineq.color,
                background: hoveredEq?.label === ineq.label ? 'rgba(139, 69, 19, 0.1)' : 'var(--panel-bg)',
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
          ))}
        </div>
      </main>

      <footer className="farm-footer">
        <p>© 2024 - Bất phương trình</p>
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
