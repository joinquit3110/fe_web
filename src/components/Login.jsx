import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        setError('Vui lòng nhập đầy đủ thông tin');
        setLoading(false);
        return;
      }

      if (isLogin) {
        await login(formData.username, formData.password);
        navigate('/dashboard');
      } else {
        if (!formData.email) {
          setError('Vui lòng nhập email');
          setLoading(false);
          return;
        }
        
        if (formData.password !== formData.confirmPassword) {
          setError('Mật khẩu xác nhận không khớp');
          setLoading(false);
          return;
        }
        
        await register(formData.username, formData.email, formData.password);
        setSuccess('Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ.');
        setIsLogin(true);
        setFormData({
          ...formData,
          password: '',
          confirmPassword: ''
        });
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
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
      
      <div className="auth-box">
        <div className="auth-header">
          <div className="hogwarts-crest"></div>
          <h2>{isLogin ? 'Chào mừng đến với Hogwarts' : 'Nhập học Hogwarts'}</h2>
          <p className="subtitle">{isLogin ? 'Đăng nhập để bắt đầu hành trình' : 'Đăng ký để trở thành phù thủy toán học'}</p>
        </div>

        {error && (
          <div className="error-message">
            <i className="material-icons">error</i>
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="success-message">
            <i className="material-icons">check_circle</i>
            <span>{success}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <i className="material-icons">person</i>
            <input
              type="text"
              placeholder="Tên đăng nhập"
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
              placeholder="Mật khẩu"
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
                placeholder="Xác nhận mật khẩu"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                autoComplete="new-password"
              />
            </div>
          )}
          
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <>
                <span>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</span>
                <i className="material-icons">arrow_forward</i>
              </>
            )}
          </button>
        </form>
        
        <div className="auth-footer">
          <p onClick={() => !loading && setIsLogin(!isLogin)}>
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <span className="switch-btn">
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
