import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useInequalityContext } from '../contexts/InequalityContext';
import InequalityInput from './InequalityInput';
import CoordinatePlane from './CoordinatePlane';
import '../styles/App.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { inequalities } = useInequalityContext();

  return (
    <div className="dashboard-container">
      <div className="welcome-section">
        <h2>Welcome, {user?.username}!</h2>
        <p>Start solving inequalities by entering them below.</p>
      </div>

      <div className="dashboard-content">
        <div className="control-panel">
          <InequalityInput />
        </div>

        <div className="coordinate-container">
          <CoordinatePlane />
        </div>

        <div className="inequalities-list">
          {inequalities.map((ineq, index) => (
            <div
              key={index}
              className="inequality-item"
              style={{ borderLeftColor: ineq.color }}
            >
              <span dangerouslySetInnerHTML={{ __html: `\\(${ineq.latex}\\)` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 