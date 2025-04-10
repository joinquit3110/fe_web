import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // This import now points to an existing file
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import { MagicPointsProvider } from './context/MagicPointsContext';

// Configure MathJax with safer options
if (window.MathJax) {
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']]
    },
    svg: {
      fontCache: 'global'
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
    }
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <MagicPointsProvider>
        <App />
      </MagicPointsProvider>
    </Router>
  </React.StrictMode>
);