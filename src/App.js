import React, { useState, useRef, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme, Spinner, Box } from '@chakra-ui/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { MagicPointsProvider } from './context/MagicPointsContext';
import { SocketProvider } from './context/SocketContext';
import HogwartsLayout, { GridArea } from './components/HogwartsLayout';
import './styles/App.css';
import './styles/HarryPotter.css';
import './styles/responsive.css'; // Import our new responsive styles

// Lazy load components for better performance
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const InequalityInput = lazy(() => import("./components/InequalityInput"));
const CoordinatePlane = lazy(() => import("./components/CoordinatePlane"));
const TabNavigation = lazy(() => import("./components/TabNavigation"));
const Activity1 = lazy(() => import("./components/Activity1"));
const UserProfile = lazy(() => import('./components/UserProfile'));
const MagicPointsDebug = lazy(() => import('./components/MagicPointsDebug'));
const AdminHousePoints = lazy(() => import('./components/AdminHousePoints'));
const NotificationDisplay = lazy(() => import('./components/NotificationDisplay'));

// Fix theme definition - must use proper color format
const theme = extendTheme({
  colors: {
    blue: {
      '500': '#3182ce',
      '600': '#2B6CB0',
      '700': '#2a4365',
    },
    gray: {
      '50': '#f7fafc',
      '700': '#2d3748',
      '800': '#1a202c',
    },
    primary: {
      '500': '#740001',
    },
    secondary: {
      '500': '#D3A625',
    }
  },
  styles: {
    global: {
      body: {
        bg: 'gray.800',
        color: 'white',
      }
    }
  },
  // Add breakpoints for better responsive design
  breakpoints: {
    sm: '30em',    // 480px
    md: '48em',    // 768px
    lg: '62em',    // 992px
    xl: '80em',    // 1280px
    '2xl': '96em', // 1536px
  },
});

// Loading component with Hogwarts theme
const LoadingSpinner = () => (
  <Box 
    display="flex" 
    justifyContent="center" 
    alignItems="center" 
    minHeight="100vh"
    className="glass-panel"
  >
    <Box 
      className="loader hardware-accelerated"
      width="80px"
      height="80px"
      border="4px solid rgba(211, 166, 37, 0.3)"
      borderTopColor="var(--secondary-color)"
    />
  </Box>
);

// Private Route component for protected routes
const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Allow bypassing auth in development mode
  if (!isAuthenticated && !isDevelopment) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Main App component
const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <AdminProvider>
          <SocketProvider>
            <MagicPointsProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/admin/house-points" element={
                    <PrivateRoute>
                      <AdminHousePoints />
                    </PrivateRoute>
                  } />
                  <Route path="/" element={
                    <PrivateRoute>
                      <NotificationDisplay />
                      <AppContent />
                    </PrivateRoute>
                  } />
                </Routes>
              </Suspense>
            </MagicPointsProvider>
          </SocketProvider>
        </AdminProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

// Main application content
const AppContent = () => {
  // Use existing state management and refs
  const { user } = useAuth();
  const [inequalities, setInequalities] = useState([]);
  const [message, setMessage] = useState({ 
    text: "Welcome to Hogwarts School of Inequality Magic! Cast your first spell by entering an inequality.", 
    type: "info" 
  });
  const [hoveredEq, setHoveredEq] = useState(null);
  const [quizMessage, setQuizMessage] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [activeTab, setActiveTab] = useState('activity1');
  const [relatedToIntersection, setRelatedToIntersection] = useState([]);
  const coordinatePlaneRef = useRef(null);
  const inequalityListRef = useRef(null);
  
  // Add a handler for list item click
  const handleListItemClick = (inequality) => {
    // If we have a coordinate plane reference
    if (coordinatePlaneRef.current) {
      coordinatePlaneRef.current.focusOnInequality(inequality);
    }
  };

  // Scroll to an inequality in the list
  const scrollToInequality = (label) => {
    if (!inequalityListRef.current) return;
    
    const listItems = inequalityListRef.current.querySelectorAll('.inequality-item');
    const index = [...listItems].findIndex(item => {
      // Find the item with matching label
      return item.textContent.includes(label);
    });
    
    if (index !== -1) {
      // Add a class to highlight the scrolled item
      listItems[index].classList.add('scrolled-to');
      
      // Remove the class after animation completes
      setTimeout(() => {
        listItems[index].classList.remove('scrolled-to');
      }, 800);
      
      // Use a custom smooth scroll with better performance
      const container = inequalityListRef.current;
      const targetItem = listItems[index];
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetItem.getBoundingClientRect();
      
      // Calculate scroll position to center the item
      const scrollTop = targetRect.top - containerRect.top - (containerRect.height / 2) + (targetRect.height / 2) + container.scrollTop;
      
      // Smooth scroll with requestAnimationFrame for better performance
      smoothScrollTo(container, scrollTop, 200);
    }
  };
  
  // Optimized smooth scroll function using requestAnimationFrame
  const smoothScrollTo = (element, to, duration) => {
    const start = element.scrollTop;
    const change = to - start;
    const startTime = performance.now();
    
    const animateScroll = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      
      if (elapsedTime > duration) {
        element.scrollTop = to;
        return;
      }
      
      // Use easeInOutQuad easing function for smooth animation
      const progress = elapsedTime / duration;
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress;
      
      element.scrollTop = start + change * easeProgress;
      requestAnimationFrame(animateScroll);
    };
    
    requestAnimationFrame(animateScroll);
  };
  
  // Add inequality handler
  const handleAddInequality = (newInequality) => {
    setInequalities(prev => [...prev, newInequality]);
    setMessage({ text: `Spell cast successfully: ${newInequality.latex}`, type: "success" });
    setHoveredEq(null);
  };
  
  // Clear all inequalities
  const handleClearAll = () => {
    setInequalities([]);
    setQuizMessage("");
    setMessage({ text: "All spells have been cleared with Finite Incantatem!", type: "info" });
    setHoveredEq(null);
    setRelatedToIntersection([]);
  };
  
  // Handle hover events
  const handleListItemHover = (equation) => {
    setHoveredEq(equation);
  };
  
  // Handle delete
  const handleDelete = (e, inequality) => {
    e.stopPropagation();
    setInequalities(prev => prev.filter(item => item.label !== inequality.label));
    setQuizMessage('');
    
    // Also clear related intersections if needed
    if (relatedToIntersection.some(eq => eq.label === inequality.label)) {
      setRelatedToIntersection(prev => prev.filter(eq => eq.label !== inequality.label));
    }
  };
  
  // Helper function to get sequential labels
  const getSequentialLabel = (index) => {
    return String.fromCharCode(65 + index);
  };
  
  return (
    <div className="app">
      <UserProfile user={user} />
      
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
      
      {/* Magical Moon - hardware accelerated for better performance */}
      <div className="moon-wrapper hardware-accelerated">
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
      
      {/* Header */}
      <header className="hogwarts-header">
        <h1>Hogwarts School of <span className="highlight">Inequality Magic</span></h1>
      </header>
      
      {/* Tab Navigation */}
      <TabNavigation 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
      />

      {/* Main Content */}
      {activeTab === 'activity1' && (
        <HogwartsLayout contentType="activity">
          {/* Control Panel */}
          <GridArea area="control">
            <div className="control-panel">
              <div className="control-panel-content">
                <InequalityInput 
                  onAddInequality={handleAddInequality} 
                  onClearAll={handleClearAll}
                  inequalities={inequalities}
                />
              </div>
            </div>
          </GridArea>
          
          {/* Message Box */}
          <GridArea area="message">
            <div className="message-box">
              {message && (
                <div className={`message ${message.type}`}>
                  <i className="material-icons">
                    {message.type === 'success' ? 'check_circle' : 
                     message.type === 'error' ? 'error' : 
                     message.type === 'warning' ? 'warning' : 'info'}
                  </i>
                  <span>{message.text}</span>
                </div>
              )}
            </div>
          </GridArea>
          
          {/* Coordinate Plane */}
          <GridArea area="coordinate">
            <div className="coordinate-container">
              <h2 className="responsive-heading" style={{
                color: "var(--secondary-color)",
                marginBottom: "15px",
                textAlign: "center"
              }}>
                <span style={{
                  display: "inline-block",
                  padding: "0 30px",
                  position: "relative"
                }}>
                  Magical Coordinate Plane
                  <span style={{
                    position: "absolute",
                    bottom: "-5px",
                    left: "0",
                    right: "0",
                    height: "2px",
                    background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
                    animation: "shimmer 2s infinite"
                  }}></span>
                </span>
              </h2>
              <div className="coordinate-plane">
                <Suspense fallback={<LoadingSpinner />}>
                  <CoordinatePlane
                    ref={coordinatePlaneRef}
                    inequalities={inequalities}
                    setInequalities={setInequalities}
                    setQuizMessage={setQuizMessage}
                    hoveredEq={hoveredEq}
                    setHoveredEq={setHoveredEq}
                    onInequalityClick={scrollToInequality}
                    setRelatedToIntersection={setRelatedToIntersection}
                  />
                </Suspense>
              </div>
            </div>
          </GridArea>
          
          {/* Inequalities List */}
          <GridArea area="inequalities">
            <div 
              className="inequalities-list scroll-container" 
              ref={inequalityListRef}
            >
              <h2 className="responsive-heading" style={{
                color: "var(--secondary-color)",
                marginBottom: "15px",
                textAlign: "center"
              }}>
                <span style={{
                  display: "inline-block",
                  padding: "0 30px",
                  position: "relative"
                }}>
                  Spellbook of Inequalities
                  <span style={{
                    position: "absolute",
                    bottom: "-5px",
                    left: "0",
                    right: "0",
                    height: "2px",
                    background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
                    animation: "shimmer 2s infinite"
                  }}></span>
                </span>
              </h2>
              
              {inequalities.length > 0 ? (
                <div className="stagger-items">
                  {inequalities.map((ineq, index) => (
                    <div
                      key={index}
                      className={`inequality-item ${relatedToIntersection.some(eq => eq.label === ineq.label) 
                        ? 'related-intersection' 
                        : (hoveredEq?.label === ineq.label ? 'highlighted' : '')}`}
                      style={{ 
                        borderLeftColor: ineq.color,
                        background: relatedToIntersection.some(eq => eq.label === ineq.label)
                          ? 'rgba(46, 125, 50, 0.3)' // Green background for related to intersection
                          : (hoveredEq?.label === ineq.label 
                            ? 'rgba(211, 166, 37, 0.4)'
                            : 'rgba(14, 26, 64, 0.7)'),
                        boxShadow: relatedToIntersection.some(eq => eq.label === ineq.label)
                          ? '0 0 10px rgba(46, 125, 50, 0.5)' // Green glow for related to intersection
                          : (hoveredEq?.label === ineq.label 
                            ? '0 0 10px rgba(211, 166, 37, 0.5)'
                            : 'none'),
                        transform: (relatedToIntersection.some(eq => eq.label === ineq.label) || hoveredEq?.label === ineq.label)
                          ? 'translateX(8px)'
                          : 'none',
                        transition: 'all 0.3s ease',
                        '--index': index
                      }}
                      onMouseEnter={() => handleListItemHover(ineq)}
                      onMouseLeave={() => handleListItemHover(null)}
                      onClick={() => handleListItemClick(ineq)}
                    >
                      <span 
                        className="latex-content"
                        dangerouslySetInnerHTML={{ 
                          __html: `${getSequentialLabel(index)}:\\; ${ineq.latex}`
                        }}
                      />
                      <span 
                        className="delete-icon material-icons touch-target"
                        onClick={(e) => handleDelete(e, ineq)}
                      >
                        delete
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-spells animate-in">Cast your first inequality spell!</div>
              )}
            </div>
          </GridArea>
        </HogwartsLayout>
      )}
      
      {activeTab === 'activity2' && (
        <Suspense fallback={<LoadingSpinner />}>
          <Activity1 />
        </Suspense>
      )}
      
      {/* Footer */}
      <footer className="hogwarts-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} Hogwarts School of Inequality Magic</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
