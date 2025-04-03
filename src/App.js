import React, { useState, useRef, useEffect } from "react";
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import './styles/App.css';

// Import images
import treeImage from './assets/tree.png';
import sunImage from './assets/sun.png';
import farmerImage from './assets/farmer.png';
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
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2 className="loading-text">Preparing Magical Experience...</h2>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <div className="magical-background">
        <div className="magical-particles"></div>
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

      <header className="farm-header">
        <h1>Magical Inequality Farm</h1>
        <div className="magical-decoration hat" style={{ top: '10%', left: '5%' }}></div>
        <div className="magical-decoration wand" style={{ top: '20%', right: '5%' }}></div>
      </header>

      <main className="farm-content">
        <div className="farm-panel">
          <h2>Welcome to the Magical Farm</h2>
          <p>Explore the wonders of mathematical inequalities in a magical setting!</p>
        </div>

        <div className="control-panel farm-panel">
          <h3>Magical Controls</h3>
          <div className="input-group">
            <input type="text" placeholder="Enter your magical equation..." />
            <button>Cast Spell</button>
          </div>
        </div>

        <div className="inequality-list">
          {/* Inequality items will be rendered here */}
        </div>

        <div className="coordinate-plane">
          <h3>Magical Graph</h3>
          <CoordinatePlane
            ref={coordinatePlaneRef}
            inequalities={inequalities}
            setInequalities={setInequalities}
            setQuizMessage={setQuizMessage}
            hoveredEq={hoveredEq}
            setHoveredEq={setHoveredEq}
          />
        </div>
      </main>

      <footer className="farm-footer">
        <p>© 2024 Magical Inequality Farm - Where Math Meets Magic</p>
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
