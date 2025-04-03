import React, { useState, useRef, useEffect } from "react";
import { MathJaxContext, MathJax } from "better-react-mathjax";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import UserProfile from "./components/UserProfile";
import './styles/App.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';

// Configure MathJax
const mathJaxConfig = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true
  },
  svg: {
    fontCache: 'global',
    scale: 1.3,
  },
  options: {
    enableMenu: false
  },
  startup: {
    typeset: true
  }
};

const AppContent = () => {
  const { user } = useAuth();
  const [inequalities, setInequalities] = useState([]);
  const [quizMessage, setQuizMessage] = useState('');
  const [hoveredEq, setHoveredEq] = useState(null);
  const coordinatePlaneRef = useRef(null);
  const [teacherName, setTeacherName] = useState("Vĩ");
  const headerRef = useRef(null);
  const teacherNameRef = useRef(null);
  const clickTimerRef = useRef(null);
  const clickCountRef = useRef(0);
  const isMobile = window.innerWidth < 768;
  
  // Easter egg effect
  useEffect(() => {
    const handleNameClick = (e) => {
      e.stopPropagation(); // Prevent parent's click from triggering
      clickCountRef.current += 1;
      
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      
      clickTimerRef.current = setTimeout(() => {
        if (clickCountRef.current >= 2) {
          // Easter egg: Toggle teacher name on double click with visual feedback
          const nameElement = teacherNameRef.current;
          if (nameElement) {
            nameElement.classList.add('name-toggle');
            setTimeout(() => {
              setTeacherName(prev => prev === "Vĩ" ? "Hưng" : "Vĩ");
              nameElement.classList.remove('name-toggle');
            }, 300);
          }
        }
        clickCountRef.current = 0;
      }, 300);
    };
    
    const handleNameTouch = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Same logic as click but for touch events
      clickCountRef.current += 1;
      
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      
      clickTimerRef.current = setTimeout(() => {
        if (clickCountRef.current >= 2) {
          // Easter egg: Toggle teacher name on double tap with visual feedback
          const nameElement = teacherNameRef.current;
          if (nameElement) {
            nameElement.classList.add('name-toggle');
            setTimeout(() => {
              setTeacherName(prev => prev === "Vĩ" ? "Hưng" : "Vĩ");
              nameElement.classList.remove('name-toggle');
            }, 300);
          }
        }
        clickCountRef.current = 0;
      }, 300);
    };
    
    const nameElement = teacherNameRef.current;
    if (nameElement) {
      nameElement.addEventListener('click', handleNameClick);
      nameElement.addEventListener('touchend', handleNameTouch);
    }
    
    return () => {
      if (nameElement) {
        nameElement.removeEventListener('click', handleNameClick);
        nameElement.removeEventListener('touchend', handleNameTouch);
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
    <MathJaxContext config={mathJaxConfig}>
      <div className="app-container">
        <div className="background-container">
          <div className="stars small-stars">
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={`small-star-${i}`}
                className="star"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
          <div className="stars medium-stars">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={`medium-star-${i}`}
                className="star"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
          <div className="moon" />
        </div>

        <UserProfile />

        <header className="farm-header" ref={headerRef}>
          <div className="header-content">
            <h1>
              Học cùng thầy <span ref={teacherNameRef} className="teacher-name">{teacherName}</span> 
              <span className="highlight"> chỉ điểm 10!</span>
            </h1>
          </div>
        </header>

        <main className="farm-content">
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

          <div className="coordinate-section">
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
            <h3>Danh sách bất phương trình</h3>
            {inequalities.map((ineq, index) => (
              <div
                key={index}
                className="inequality-item"
                style={{ 
                  borderLeftColor: ineq.color,
                  background: hoveredEq?.label === ineq.label ? 'rgba(71, 58, 131, 0.1)' : 'var(--panel-bg)',
                  '--index': index
                }}
                onMouseEnter={() => handleListItemHover(ineq)}
                onMouseLeave={() => handleListItemHover(null)}
              >
                <span 
                  className="inequality-latex"
                  dangerouslySetInnerHTML={{ 
                    __html: `\\(${ineq.label}:\\; ${ineq.latex}\\)` 
                  }}
                />
                <span 
                  className="delete-icon material-icons"
                  onClick={(e) => handleDelete(e, ineq)}
                  title="Xóa bất phương trình"
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
