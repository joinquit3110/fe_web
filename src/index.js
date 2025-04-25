import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import { MagicPointsProvider } from './context/MagicPointsContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './context/SocketContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <SocketProvider>
          <MagicPointsProvider>
            <App />
          </MagicPointsProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>
);