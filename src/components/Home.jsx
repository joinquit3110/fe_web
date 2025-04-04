import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/App.css';

const Home = () => {
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Welcome to Inequality Solver</h1>
        <p>Solve and visualize inequalities with ease</p>
        <div className="cta-buttons">
          <Link to="/login" className="cta-button primary">
            Get Started
          </Link>
          <Link to="/register" className="cta-button secondary">
            Create Account
          </Link>
        </div>
      </div>

      <div className="features-section">
        <div className="feature-card">
          <h3>Real-time Visualization</h3>
          <p>See your inequalities come to life on the coordinate plane</p>
        </div>
        <div className="feature-card">
          <h3>Interactive Learning</h3>
          <p>Learn through hands-on experience with inequalities</p>
        </div>
        <div className="feature-card">
          <h3>Progress Tracking</h3>
          <p>Save and track your progress as you learn</p>
        </div>
      </div>
    </div>
  );
};

export default Home; 