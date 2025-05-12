import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import { MagicPointsProvider } from './context/MagicPointsContext';
import './utils/i18n';

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