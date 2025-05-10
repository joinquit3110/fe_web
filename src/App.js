import React, { useState, useRef, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import TabNavigation from "./components/TabNavigation";
import Activity1 from "./components/Activity1";
import Leaderboard from "./components/Leaderboard";
import 'katex/dist/katex.min.css';
import katex from 'katex';
import './styles/App.css';
import './styles/HarryPotter.css';
// Fix AuthContext import
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import Login from './components/Login';
import Register from './components/Register';
import UserProfile from './components/UserProfile';
import MagicPointsDebug from './components/MagicPointsDebug';
import { MagicPointsProvider } from './context/MagicPointsContext';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import AdminHousePoints from './components/AdminHousePoints';
import AdminUserManagement from './components/AdminUserManagement'; // Added import for AdminUserManagement
import NotificationDisplay from './components/NotificationDisplay';
import { SocketProvider } from './context/SocketContext';
// Import the Hogwarts logo image
import hogwartsLogoImg from './asset/Hogwarts logo.png';

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
  }
});

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

// Admin Route component specifically for admin-only routes
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // ADMIN_USERS hardcoded list for direct checks
  const ADMIN_USERS = ['hungpro', 'vipro'];
  
  // Track if we've attempted to load user from localStorage
  const [attemptedLocalStorageLoad, setAttemptedLocalStorageLoad] = useState(false);
  const [loadedAdminData, setLoadedAdminData] = useState(false);
  
  // First useEffect to try loading user data from storage if not in context
  useEffect(() => {
    if (!attemptedLocalStorageLoad && (!user || !Object.keys(user || {}).length)) {
      try {
        console.log('[AdminRoute] User data not found in context, checking storage');
        
        // Try session storage first (preferred for admin)
        let storedUserJson = sessionStorage.getItem('user');
        if (!storedUserJson) {
          // Fall back to local storage
          storedUserJson = localStorage.getItem('user');
        }
        
        if (storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          console.log('[AdminRoute] Found user data in storage:', 
            storedUser ? { username: storedUser.username, isAdmin: storedUser.isAdmin } : null);
        }
      } catch (err) {
        console.error('[AdminRoute] Error checking storage:', err);
      } finally {
        setAttemptedLocalStorageLoad(true);
      }
    }
  }, [user, attemptedLocalStorageLoad]);
  
  // Second useEffect dedicated to checking admin status and loading admin data
  useEffect(() => {
    const adminLoginFlag = sessionStorage.getItem('adminLogin') === 'true';
    
    // If admin flag is set but we haven't loaded admin data yet
    if (adminLoginFlag && !loadedAdminData) {
      try {
        console.log('[AdminRoute] Admin flag detected, checking admin data');
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!storedUser.isAdmin) {
          // Force update admin flag
          storedUser.isAdmin = true;
          localStorage.setItem('user', JSON.stringify(storedUser));
          console.log('[AdminRoute] Updated admin flag in stored user data');
        }
        
        setLoadedAdminData(true);
      } catch (err) {
        console.error('[AdminRoute] Error updating admin data:', err);
      }
    }
  }, [loadedAdminData]);
  
  // Get user from localStorage as fallback
  let effectiveUser = user;
  if (!effectiveUser || !Object.keys(effectiveUser || {}).length) {
    try {
      const storedUserJson = localStorage.getItem('user');
      if (storedUserJson) {
        effectiveUser = JSON.parse(storedUserJson);
        console.log('[AdminRoute] Using user data from localStorage');
      }
    } catch (e) {
      console.error('[AdminRoute] Error parsing user from localStorage:', e);
    }
  }
  
  // More robust admin check
  const isAdmin = effectiveUser && (
    // Check against hardcoded admin list
    (effectiveUser.username && ADMIN_USERS.includes(effectiveUser.username)) || 
    // Check isAdmin flag
    effectiveUser.isAdmin === true || 
    // Check role field
    effectiveUser.role === 'admin' || 
    // Check house field
    effectiveUser.house === 'admin'
  );
  
  console.log('[AdminRoute] Checking admin access:', { 
    isAuthenticated,
    isAdmin,
    username: effectiveUser?.username,
    inAdminList: effectiveUser?.username ? ADMIN_USERS.includes(effectiveUser.username) : false,
    isAdminFlag: effectiveUser?.isAdmin,
    role: effectiveUser?.role,
    house: effectiveUser?.house,
  });
  
  // Check for explicit admin session marker
  const hasAdminSession = sessionStorage.getItem('adminLogin') === 'true';
  
  // Get search params for various checks
  const searchParams = new URLSearchParams(window.location.search);
  const hasAdminParam = searchParams.get('admin') === 'true';

  // First check if authenticated, then check if admin
  if (!isAuthenticated && !isDevelopment) {
    console.log('[AdminRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // Special handling for admin session restart - if we have admin session marker,
  // try to refresh the admin data from localStorage
  if (hasAdminSession && !isAdmin) {
    console.log('[AdminRoute] Admin session marker found but context not updated yet');
    
    // If less than 2 seconds after page load, show loading and wait for context
    const pageLoadTime = window.performance.timing.navigationStart || 0;
    const timeSinceLoad = Date.now() - pageLoadTime;
    
    if (timeSinceLoad < 2000) {
      console.log('[AdminRoute] Recently loaded, waiting for context update');
      return <div>Loading admin interface...</div>;
    }
  }
  
  // If authenticated but not admin and no admin session, redirect to dashboard
  if (isAuthenticated && !isAdmin && !hasAdminSession && !isDevelopment && !hasAdminParam) {
    console.log('[AdminRoute] User is not admin, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }
  
  // If this is coming directly from admin login via redirect marker, clear the marker
  if (sessionStorage.getItem('adminRedirect') === 'true') {
    console.log('[AdminRoute] Processing admin redirect');
    sessionStorage.removeItem('adminRedirect');
  }
  
  // For debugging purposes - allow viewing detailed admin auth state
  const showDebug = searchParams.get('debug') === 'admin';
  
  console.log('[AdminRoute] Successfully granted access to admin route', {
    path: window.location.pathname,
    adminUser: effectiveUser ? {
      username: effectiveUser.username,
      isAdmin: effectiveUser.isAdmin,
      role: effectiveUser.role,
      house: effectiveUser.house
    } : null,
    localStorage: {
      user: localStorage.getItem('user') ? 'present' : 'missing',
      token: localStorage.getItem('token') ? 'present' : 'missing',
      isAuthenticated: localStorage.getItem('isAuthenticated')
    },
    sessionStorage: {
      adminLogin: sessionStorage.getItem('adminLogin'),
      user: sessionStorage.getItem('user') ? 'present' : 'missing',
      token: sessionStorage.getItem('token') ? 'present' : 'missing'
    }
  });
  
  // If debug is enabled, include debug information
  if (showDebug) {
    return (
      <div style={{padding: '20px'}}>
        <div style={{marginBottom: '20px', padding: '10px', background: '#0d47a1', color: 'white'}}>
          <h3>Admin Authentication Debug</h3>
          <pre style={{background: '#002171', padding: '10px', overflow: 'auto'}}>
            {JSON.stringify({
              user: effectiveUser,
              isAuthenticated,
              isAdmin,
              hasAdminSession: sessionStorage.getItem('adminLogin') === 'true',
              localStorage: {
                user: localStorage.getItem('user'),
                token: localStorage.getItem('token') ? '[PRESENT]' : '[MISSING]',
                isAuthenticated: localStorage.getItem('isAuthenticated')
              },
              sessionStorage: {
                adminLogin: sessionStorage.getItem('adminLogin'),
                token: sessionStorage.getItem('token') ? '[PRESENT]' : '[MISSING]'
              }
            }, null, 2)}
          </pre>
        </div>
        {children}
      </div>
    );
  }
  
  return children;
};

// Helper function for KaTeX rendering
const renderLatex = (latex) => {
  if (!latex) return '';
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch (error) {
    return '';
  }
};

const AppContent = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('activity1'); // Default to Activity 1 instead of Activity 2
  const [inequalities, setInequalities] = useState([]);
  const [message, setMessage] = useState({ 
    text: "Cast your first spell by entering an inequality!", 
    type: "info" 
  });
  const [hoveredEq, setHoveredEq] = useState(null);
  const [quizMessage, setQuizMessage] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const coordinatePlaneRef = useRef(null);
  const inequalityListRef = useRef(null);
  const [relatedToIntersection, setRelatedToIntersection] = useState([]);
  
  const handleAddInequality = (newInequality) => {
    const result = coordinatePlaneRef.current?.handleAddInequality(newInequality);
    
    if (result === true) {
      setMessage({
        text: "Spell cast successfully! Your inequality has been added to the magical plane.",
        type: "success"
      });
      
      // KaTeX renders immediately when used, no need for typeset calls
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

  const handleListItemHover = (equation) => {
    setHoveredEq(equation);
  };

  const handleListItemClick = (inequality) => {
    setHoveredEq(inequality);
    // If we have a reference to the coordinate plane, highlight this inequality
    coordinatePlaneRef.current?.highlightInequality(inequality);
  };

  // Function to scroll to an inequality in the list
  const scrollToInequality = (inequality) => {
    if (!inequality || !inequalityListRef.current) return;
    
    // Find the inequality index
    const index = inequalities.findIndex(ineq => ineq.label === inequality.label);
    if (index === -1) return;
    
    // Find the DOM element for that inequality
    const listItems = inequalityListRef.current.querySelectorAll('.inequality-item');
    if (index < listItems.length) {
      // Add highlight animation class
      listItems[index].classList.add('scrolled-to');
      
      // Remove the class after animation completes
      setTimeout(() => {
        listItems[index].classList.remove('scrolled-to');
      }, 800); // Reduced from 1000ms
      
      // Scroll the item into view with smooth animation but faster
      // Use scrollTo with custom duration instead of scrollIntoView for more control
      const container = inequalityListRef.current;
      const targetItem = listItems[index];
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetItem.getBoundingClientRect();
      
      // Calculate the scroll position to center the item
      const scrollTop = targetRect.top - containerRect.top - (containerRect.height / 2) + (targetRect.height / 2) + container.scrollTop;
      
      // Use custom smooth scroll with shorter duration
      smoothScrollTo(container, scrollTop, 200); // 200ms duration - faster than default scrollIntoView
    }
  };
  
  // Custom smooth scroll function with controllable duration
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
      
      // Use easeOutQuad for smooth deceleration
      const progress = elapsedTime / duration;
      const easeOutValue = 1 - (1 - progress) * (1 - progress);
      
      element.scrollTop = start + change * easeOutValue;
      requestAnimationFrame(animateScroll);
    };
    
    requestAnimationFrame(animateScroll);
  };

  const handleDelete = (e, inequality) => {
    e.stopPropagation();
    
    // Check if the delete button is actually displayed
    const target = e.target;
    if (!target || !target.classList.contains('delete-icon')) {
      console.log('Prevented deletion - click not on delete icon');
      return;
    }
    
    setInequalities(prev => prev.filter(item => item.label !== inequality.label));
    setQuizMessage('');
  };
  
  // Generate sequential labels for inequalities (d_1, d_2, ...)
  const getSequentialLabel = (index) => {
    return `d_${index + 1}`;
  };
  
  // Create mock user for local development
  const localUser = {
    id: 'mock-user-id',
    username: 'HogwartsWizard',
    email: 'dev@hogwarts.edu',
    fullName: 'Dev Wizard',
    school: 'Hogwarts',
    grade: 'Advanced',
  };
  
  // Handle tab change and ensure rendering is reprocessed
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };

  return (
    <div className="app">
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={
          <AdminRoute>
            <AdminUserManagement />
          </AdminRoute>
        } />
        <Route path="/admin/house-points" element={
          <AdminRoute>
            <AdminHousePoints />
          </AdminRoute>
        } />
        {/* Dashboard route - redirects to main app */}
        <Route path="/dashboard" element={
          <Navigate to="/" replace />
        } />
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <div className="hogwarts-app">
                {/* UserProfile component */}
                <UserProfile user={user || (window.location.hostname === 'localhost' ? localUser : null)} />
                
                {/* Notification display */}
                <NotificationDisplay />
                
                <header className="hogwarts-header">
                  <img src={hogwartsLogoImg} alt="Hogwarts Logo" className="hogwarts-logo" />
                  <h1><span className="magical-text">Hogwarts School of</span> <span className="highlight">Inequality Magic</span></h1>
                </header>
                
                {/* Tab Navigation */}
                <TabNavigation activeTab={activeTab} setActiveTab={handleTabChange} />
                
                <div className="hogwarts-content">
                  {/* Render different content based on active tab */}
                  {activeTab === 'activity1' ? (
                    <Activity1 />
                  ) : activeTab === 'leaderboard' ? (
                    <Leaderboard />
                  ) : (
                    <>
                      {/* Check if user is admin then don't display content */}
                      {user && user.isAdmin ? (
                        <div className="admin-message wizard-panel" style={{
                          padding: "30px",
                          textAlign: "center",
                          borderRadius: "8px"
                        }}>
                          <h3 style={{ 
                            fontFamily: "'Cinzel', serif",
                            fontSize: "24px",
                            color: "var(--secondary-color)",
                            marginBottom: "15px"
                          }}>
                            Admin Console
                          </h3>
                          <p>Activity 2 content is disabled for admin users. Please use the Admin Console for management tasks.</p>
                        </div>
                      ) : (
                        <>
                          {/* 1. Control Panel - Cast Spell at top */}
                          <div className="control-panel wizard-panel">
                            <div className="control-panel-content">
                              <h2 className="activity-title" style={{ 
                                fontFamily: "'Cinzel', serif",
                                position: "relative",
                                textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
                                letterSpacing: "1px",
                                textAlign: "center"
                              }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "0 30px",
                                  position: "relative"
                                }}>
                                  Grand Arcanum of<br />Inequality
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
                            <h2 className="activity-title" style={{ 
                                fontFamily: "'Cinzel', serif",
                                position: "relative",
                                textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
                                letterSpacing: "1px",
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
                            </div>
                          </div>

                          {/* 4. Inequalities List at bottom */}
                          <div className="inequalities-list wizard-panel">
                            <h2 className="activity-title" style={{ 
                                fontFamily: "'Cinzel', serif",
                                position: "relative",
                                textShadow: "0 0 10px rgba(211, 166, 37, 0.5)",
                                letterSpacing: "1px",
                                textAlign: "center"
                              }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "0 30px",
                                  position: "relative"
                                }}>
                                  Spells Collection
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
                            <div className="scroll-container" ref={inequalityListRef}>
                              {inequalities.length > 0 ? (
                                inequalities.map((ineq, index) => (
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
                                        __html: renderLatex(`${getSequentialLabel(index)}:\\; ${ineq.latex}`) 
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
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </PrivateRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Add the debug component */}
      <MagicPointsDebug />
      
      <footer className="hogwarts-footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} Hogwarts School of Inequality Magic</p>
        </div>
      </footer>
    </div>
  );
};

// Wrap App with ChakraProvider first
const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <AdminProvider>
          <SocketProvider>
            <AppContent />
          </SocketProvider>
        </AdminProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

export default App;
