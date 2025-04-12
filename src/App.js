import React, { useState, useRef, useEffect } from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import InequalityInput from "./components/InequalityInput";
import CoordinatePlane from "./components/CoordinatePlane";
import TabNavigation from "./components/TabNavigation";
import Activity1 from "./components/Activity1";
import Activity2 from "./components/Activity2";
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
import NotificationDisplay from './components/NotificationDisplay';
import UserSyncManager from './components/UserSyncManager';

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
    text: "Welcome to Hogwarts School of Inequality Magic! Cast your first spell by entering an inequality.", 
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
    
    // Kiểm tra xem nút xóa có thực sự hiển thị không
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
  
  // Tạo mock user cho local development
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
    <div className="app-container">
      {/* Include the UserSyncManager component */}
      {isAuthenticated && <UserSyncManager />}
      
      {/* Rest of the app content */}
      <TabNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
      />
      
      <div className="hogwarts-app">
        {/* UserProfile component */}
        <UserProfile user={user || (window.location.hostname === 'localhost' ? localUser : null)} />
        
        {/* Notification display */}
        <NotificationDisplay />
        
        <header className="hogwarts-header">
          <h1>Hogwarts School of <span className="highlight">Inequality Magic</span></h1>
        </header>
        
        <div className="hogwarts-content">
          {/* Render different content based on active tab */}
          {activeTab === 'activity1' ? (
            <Activity1 />
          ) : (
            <Activity2 />
          )}
        </div>
      </div>
      
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
          <MagicPointsProvider>
            <AppContent />
          </MagicPointsProvider>
        </AdminProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

export default App;
