import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (!formData.username || !formData.password) {
        setError('Please enter your username and password');
        return;
      }

      console.log('Submitting login...'); // Debug log
      
      if (isLogin) {
        await login(formData.username, formData.password);
      } else {
        if (!formData.email) {
          setError('Please enter your email');
          return;
        }
        await register(formData.username, formData.email, formData.password);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred, please try again');
    }
  };

  return (
    <div className="login-container">
      <div className="stars">
        <div className="small-stars">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="star" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }} />
          ))}
        </div>
        <div className="medium-stars">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="star" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }} />
          ))}
        </div>
      </div>
      
      <div className="login-box">
        <div className="login-header">
          <h2>{isLogin ? 'Welcome to Hogwarts' : 'Join Hogwarts School'}</h2>
          <p className="subtitle">{isLogin ? 'Sign in to continue your magical journey' : 'Register to start your wizarding education'}</p>
        </div>

        {error && (
          <div className="error-message">
            <i className="material-icons">error</i>
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <i className="material-icons">person</i>
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
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
            />
          </div>
          
          <button type="submit" className="submit-btn">
            <span>{isLogin ? 'Sign In' : 'Register'}</span>
            <i className="material-icons">arrow_forward</i>
          </button>
        </form>
        
        <div className="login-footer">
          <p onClick={() => setIsLogin(!isLogin)}>
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
