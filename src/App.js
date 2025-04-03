import React, { useState, useRef, useEffect } from "react";
import { MathJaxContext } from "better-react-mathjax";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import UserProfile from "./components/UserProfile";
import './styles/App.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';

const AppContent = () => {
  const { user } = useAuth();
  const [inequalities, setInequalities] = useState([]);
  const [quizMessage, setQuizMessage] = useState('');
  const [hoveredEq, setHoveredEq] = useState(null);
  const coordinatePlaneRef = useRef(null);
  const [teacherName, setTeacherName] = useState("Vĩ");
  const headerRef = useRef(null);
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);
  const isMobile = window.innerWidth < 768;
  
  // Easter egg effect
  useEffect(() => {
    const handleHeaderClick = () => {
      clickCountRef.current += 1;
      
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      
      clickTimerRef.current = setTimeout(() => {
        if (clickCountRef.current >= 2) {
          // Easter egg: Toggle teacher name on double click
          setTeacherName(prev => prev === "Vĩ" ? "Hưng" : "Vĩ");
        }
        clickCountRef.current = 0;
      }, 300);
    };
    
    const headerElement = headerRef.current;
    if (headerElement) {
      headerElement.addEventListener('click', handleHeaderClick);
    }
    
    return () => {
      if (headerElement) {
        headerElement.removeEventListener('click', handleHeaderClick);
      }
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handleAddInequality = (newInequality) => {
    // Check if already exists
    const exists = inequalities.some(
      (ineq) => ineq.latex === newInequality.latex
    );

    if (exists) {
      setQuizMessage("Bất phương trình này đã tồn tại!");
      return false;
    }

    // Add label for the inequality
    const lastIndex = inequalities.length > 0 ? parseInt(inequalities[inequalities.length - 1].label.replace('d_', ''), 10) : 0;
    const newIndex = lastIndex + 1;
    const labeledInequality = {
      ...newInequality,
      label: `d_${newIndex}`
    };

    setInequalities(prev => [...prev, labeledInequality]);
    return true;
  };

  const handleDelete = (e, targetIneq) => {
    e.stopPropagation();
    setInequalities(prev => prev.filter(ineq => ineq.label !== targetIneq.label));
  };

  const handleListItemHover = (ineq) => {
    setHoveredEq(ineq);
  };

  const resetAll = () => {
    setInequalities([]);
    setQuizMessage('');
    setHoveredEq(null);
  };

  if (!user) {
    return <Login />;
  }

  return (
    <MathJaxContext>
      <div className="app-container">
        <div className="background-container">
          <div className="stars">
            <div className="small-stars">
              {[...Array(40)].map((_, i) => (
                <div key={i} className="star" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }} />
              ))}
            </div>
            <div className="medium-stars">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="star" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }} />
              ))}
            </div>
          </div>
          <div className="moon"></div>
          <div className="hogwarts-castle"></div>
          <div className="flying-broom">
            <div className="broom-stick"></div>
            <div className="broom-bristles"></div>
            <div className="broom-rider"></div>
          </div>
        </div>

        <UserProfile />

        <header className="farm-header" ref={headerRef}>
          <h1>Học cùng thầy {teacherName} <span className="highlight">chỉ điểm 10!</span></h1>
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
                quizMessage.includes('đúng') || quizMessage.includes('thành công') ? 'success' : ''
              }`}>
                {quizMessage.includes('Chính xác') && <i className="material-icons">check_circle</i>}
                {quizMessage.includes('Sai') && <i className="material-icons">error</i>}
                {quizMessage.includes('tồn tại') && <i className="material-icons">warning</i>}
                {quizMessage.includes('Định dạng') && <i className="material-icons">format_clear</i>}
                {(quizMessage.includes('Vui lòng nhập') || quizMessage.includes('Nhập tọa độ')) && 
                  <i className="material-icons">info</i>}
                {quizMessage.includes('thành công') && <i className="material-icons">check_circle</i>}
                {quizMessage}
              </div>
            )}
          </div>

          <div className="coordinate-container farm-panel">
            <div className="magical-decoration potion" style={{ bottom: '10px', left: '10px' }}></div>
            <CoordinatePlane
              ref={coordinatePlaneRef}
              inequalities={inequalities}
              setQuizMessage={setQuizMessage}
              hoveredEq={hoveredEq}
              isMobile={isMobile}
            />
          </div>

          <div className="inequalities-list farm-panel">
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
    </MathJaxContext>
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
