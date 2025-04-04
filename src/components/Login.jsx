import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Animations.css';
import MagicalElements from './MagicalElements';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      if (!formData.username || !formData.password) {
        setError('Please enter your username and password');
        setLoading(false);
        return;
      }

      if (isLogin) {
        await login(formData.username, formData.password);
        navigate('/dashboard');
      } else {
        if (!formData.email) {
          setError('Please enter your email');
          setLoading(false);
          return;
        }
        
        if (formData.password !== formData.confirmPassword) {
          setError('Password confirmation does not match');
          setLoading(false);
          return;
        }
        
        await register(formData.username, formData.email, formData.password);
        setSuccess('Registration successful! You can now log in.');
        setIsLogin(true);
        setFormData({
          ...formData,
          password: '',
          confirmPassword: ''
        });
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseError = () => {
    setError('');
  };

  const handleCloseSuccess = () => {
    setSuccess('');
  };

  return (
    <div className="auth-container wand-cursor">
      <MagicalElements />
      <div className="auth-background">
        <div className="hogwarts-silhouette"></div>
        <div className="stars">
          <div className="small-stars">
            {[...Array(50)].map((_, i) => (
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
      </div>
      
      <div className="auth-box magic-sparkle">
        <div className="auth-header">
          <div className="hogwarts-crest"></div>
          <h2 className="float">{isLogin ? 'Welcome to Hogwarts' : 'Enroll at Hogwarts'}</h2>
          <p className="subtitle">{isLogin ? 'Sign in to begin your journey' : 'Register to become a math wizard'}</p>
        </div>

        {error && (
          <div className="error-message">
            <i className="material-icons error-icon">error_outline</i>
            <div className="error-content">
              <div className="error-title">Authentication Error</div>
              <div className="error-details">{error}</div>
            </div>
            <button className="error-close" onClick={handleCloseError}>×</button>
          </div>
        )}
        
        {success && (
          <div className="success-message">
            <i className="material-icons success-icon">check_circle</i>
            <div className="error-content">
              <div className="error-title">Success</div>
              <div className="error-details">{success}</div>
            </div>
            <button className="error-close" onClick={handleCloseSuccess}>×</button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <i className="material-icons">person</i>
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              autoComplete="username"
            />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <i className="material-icons">email</i>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                autoComplete="email"
              />
            </div>
          )}
          
          <div className="form-group">
            <i className="material-icons">lock</i>
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <i className="material-icons">lock_outline</i>
              <input
                type="password"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                autoComplete="new-password"
              />
            </div>
          )}
          
          <button type="submit" className="submit-btn spell-trail" disabled={loading}>
            {loading ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : 'Register'}</span>
                <i className="material-icons">arrow_forward</i>
              </>
            )}
          </button>
        </form>
        
        <div className="auth-footer">
          <p onClick={() => !loading && setIsLogin(!isLogin)}>
            {isLogin ? 'Don\'t have an account?' : 'Already have an account?'}
            <span className="switch-btn">
              {isLogin ? 'Register Now' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
