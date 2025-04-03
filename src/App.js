import React, { useState, useRef, useEffect } from "react";
import { MathJaxContext } from "better-react-mathjax";
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
    typeset: true,
    ready: () => {
      MathJax.startup.defaultReady();
      MathJax.startup.promise.then(() => {
        // Force typeset all math after MathJax is fully loaded
        MathJax.typeset();
      });
    }
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

  // Add state for drawing mode and intersection points
  const [drawingMode, setDrawingMode] = useState(false); // Drawing boundaries
  const [regionMode, setRegionMode] = useState(false); // Selecting solution regions
  const [intersectionPoints, setIntersectionPoints] = useState([]);
  const [showIntersectionForm, setShowIntersectionForm] = useState(false);
  const [newPoint, setNewPoint] = useState({ x: "", y: "" });

  // Function to toggle drawing mode
  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode);
    if (regionMode) setRegionMode(false);
  };

  // Function to toggle region selection mode
  const toggleRegionMode = () => {
    setRegionMode(!regionMode);
    if (drawingMode) setDrawingMode(false);
  };

  // Function to show the intersection points input form
  const showAddIntersectionPoint = () => {
    setShowIntersectionForm(true);
  };

  // Function to add a new intersection point
  const addIntersectionPoint = () => {
    if (newPoint.x && newPoint.y) {
      setIntersectionPoints([...intersectionPoints, { x: parseFloat(newPoint.x), y: parseFloat(newPoint.y) }]);
      setNewPoint({ x: "", y: "" });
      setShowIntersectionForm(false);
    }
  };

  // Function to remove an intersection point
  const removeIntersectionPoint = (index) => {
    const newPoints = [...intersectionPoints];
    newPoints.splice(index, 1);
    setIntersectionPoints(newPoints);
  };

  if (!user) {
    return <Login />;
  }

  // Add these to the app content JSX
  const toolbarContent = (
    <div className="drawing-toolbar">
      <button 
        className={`tool-btn ${drawingMode ? 'active' : ''}`} 
        onClick={toggleDrawingMode}
        title="Vẽ biên"
      >
        <i className="material-icons">create</i>
      </button>
      <button 
        className={`tool-btn ${regionMode ? 'active' : ''}`} 
        onClick={toggleRegionMode}
        title="Chọn miền nghiệm"
      >
        <i className="material-icons">format_color_fill</i>
      </button>
      <button 
        className="tool-btn" 
        onClick={showAddIntersectionPoint}
        title="Thêm giao điểm"
      >
        <i className="material-icons">add_location</i>
      </button>
    </div>
  );

  // Intersection points display and input form
  const intersectionPointsContent = (
    <div className="intersection-points-container">
      <h4>Giao điểm</h4>
      {intersectionPoints.map((point, index) => (
        <div key={index} className="intersection-point">
          <span>({point.x}, {point.y})</span>
          <button className="remove-point" onClick={() => removeIntersectionPoint(index)}>
            <i className="material-icons">clear</i>
          </button>
        </div>
      ))}
      {showIntersectionForm && (
        <div className="intersection-form">
          <input 
            type="number" 
            placeholder="x" 
            value={newPoint.x} 
            onChange={(e) => setNewPoint({...newPoint, x: e.target.value})} 
          />
          <input 
            type="number" 
            placeholder="y" 
            value={newPoint.y} 
            onChange={(e) => setNewPoint({...newPoint, y: e.target.value})} 
          />
          <button onClick={addIntersectionPoint}>
            <i className="material-icons">check</i>
          </button>
          <button onClick={() => setShowIntersectionForm(false)}>
            <i className="material-icons">close</i>
          </button>
        </div>
      )}
    </div>
  );

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
            <div className="header-decoration"></div>
          </div>
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

          <div className="coordinate-section">
            {toolbarContent}
            <CoordinatePlane 
              ref={coordinatePlaneRef}
              inequalities={inequalities}
              setQuizMessage={setQuizMessage}
              hoveredEq={hoveredEq}
              drawingMode={drawingMode}
              regionMode={regionMode}
              intersectionPoints={intersectionPoints}
              isMobile={isMobile}
            />
            {intersectionPointsContent}
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
