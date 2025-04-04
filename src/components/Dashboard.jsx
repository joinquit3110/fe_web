import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useInequalityContext } from '../contexts/InequalityContext';
import InequalityInput from './InequalityInput';
import CoordinatePlane from './CoordinatePlane';
import MagicalElements from './MagicalElements';
import '../styles/App.css';
import '../styles/Animations.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { inequalities } = useInequalityContext();

  return (
    <div className="dashboard-container wand-cursor">
      <MagicalElements />
      <div className="welcome-section">
        <h2 className="float">Welcome, {user?.username}!</h2>
        <p>Start solving inequalities by entering them below.</p>
      </div>

      <div className="dashboard-content">
        <div className="control-panel magic-sparkle">
          <InequalityInput />
        </div>

        <div className="coordinate-container">
          <CoordinatePlane />
        </div>

        <div className="inequalities-list">
          {inequalities.map((ineq, index) => (
            <div
              key={index}
              className="inequality-item spell-trail"
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