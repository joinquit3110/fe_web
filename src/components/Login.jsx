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
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (!formData.username || !formData.password) {
        setError('Please enter your wizard name and secret spell');
        setLoading(false);
        return;
      }

      if (isLogin) {
        await login(formData.username, formData.password);
      } else {
        if (!formData.email) {
          setError('Please enter your owl mail address');
          setLoading(false);
          return;
        }
        await register(formData.username, formData.email, formData.password);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'A magical mishap occurred, please try again');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="stars">
        <div className="small-stars">
          {[...Array(40)].map((_, i) => (
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
      
      {/* Hogwarts Crest */}
      <div className="hogwarts-crest login-crest"></div>
      
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
              placeholder="Wizard Name"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
            />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <i className="material-icons">email</i>
              <input
                type="email"
                placeholder="Owl Mail Address"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          )}
          
          <div className="form-group">
            <i className="material-icons">lock</i>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Secret Spell"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
            <button 
              type="button" 
              className="password-toggle" 
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <i className="material-icons">{showPassword ? "visibility_off" : "visibility"}</i>
            </button>
          </div>
          
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                <span>Casting Spell...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Enter Hogwarts' : 'Enroll Now'}</span>
                <i className="material-icons">auto_fix_high</i>
              </>
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <p>
            {isLogin ? 'First year at Hogwarts?' : 'Already a Hogwarts student?'}
            <button 
              className="switch-btn" 
              onClick={() => setIsLogin(!isLogin)}
              disabled={loading}
            >
              {isLogin ? 'Enroll Now' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
