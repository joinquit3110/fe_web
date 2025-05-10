import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { MagicPointsProvider } from './context/MagicPointsContext';

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