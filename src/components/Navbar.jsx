import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/App.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Don't display navbar on login page
  if (location.pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-brand">
          <Link to="/dashboard" className="navbar-logo">
            <div className="navbar-logo-crest"></div>
            <span>Hogwarts Math Academy</span>
          </Link>
        </div>
        
        <div className="navbar-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          <i className="material-icons">{menuOpen ? 'close' : 'menu'}</i>
        </div>
        
        <div className={`navbar-menu ${menuOpen ? 'active' : ''}`}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="navbar-item">
                <i className="material-icons">dashboard</i>
                <span>Dashboard</span>
              </Link>
              <div className="navbar-item user-info">
                <div className="user-avatar">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.username} />
                  ) : (
                    <div className="avatar-placeholder">{user?.username?.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <span>{user?.username}</span>
              </div>
              <button onClick={handleLogout} className="navbar-item logout-button">
                <i className="material-icons">logout</i>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="navbar-item login-button">
              <i className="material-icons">login</i>
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 