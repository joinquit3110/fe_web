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
        setError('Vui lòng nhập đầy đủ thông tin');
        return;
      }

      console.log('Submitting login...'); // Debug log
      
      if (isLogin) {
        await login(formData.username, formData.password);
      } else {
        if (!formData.email) {
          setError('Vui lòng nhập email');
          return;
        }
        await register(formData.username, formData.email, formData.password);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  return (
    <div className="login-container">
      <div className="hogwarts-login-bg">
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
            {[...Array(12)].map((_, i) => (
              <div key={i} className="star" style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }} />
            ))}
          </div>
        </div>
        
        <div className="flying-broom">
          <div className="broom-stick"></div>
          <div className="broom-bristles"></div>
          <div className="broom-rider"></div>
        </div>
        
        <div className="hogwarts-castle"></div>
        <div className="moon"></div>
      </div>
      
      <div className="login-box">
        <div className="login-header">
          <h2>{isLogin ? 'Welcome to Hogwarts' : 'Join the Wizarding World'}</h2>
          <p className="subtitle">{isLogin ? 'Enter your credentials to continue your magical journey' : 'Register to begin learning the art of inequalities'}</p>
          <div className="magical-icon hat"></div>
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
              className="wizard-input"
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
                className="wizard-input"
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
              className="wizard-input"
            />
          </div>
          
          <button type="submit" className="hogwarts-submit-btn">
            <span>{isLogin ? 'Enter the Great Hall' : 'Get Sorted'}</span>
            <i className="material-icons">arrow_forward</i>
          </button>
        </form>
        
        <div className="login-footer">
          <div className="magical-decoration book"></div>
          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'First year at Hogwarts?' : 'Already a student?'}
            <span className="switch-btn">
              {isLogin ? 'Sign up for classes' : 'Return to your studies'}
            </span>
          </p>
          <div className="magical-decoration potion"></div>
        </div>
      </div>
    </div>
  );
};

export default Login;
