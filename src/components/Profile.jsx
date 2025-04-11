import React, { useState, useRef, useEffect } from 'react';

const Profile = ({ user }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState('Slytherin');
  const menuRef = useRef(null);
  const iconRef = useRef(null);

  const houses = [
    'Gryffindor',
    'Slytherin',
    'Ravenclaw',
    'Hufflepuff',
    'Muggle',
    'Admin'
  ];

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          iconRef.current && !iconRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuRef, iconRef]);

  // Get initial for profile icon
  const getInitial = (email) => {
    return email ? email.charAt(0).toUpperCase() : 'W';
  };

  // Toggle menu
  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  // Handle house change
  const handleHouseChange = (e) => {
    setSelectedHouse(e.target.value);
  };

  return (
    <div className="profile-container">
      <div 
        ref={iconRef}
        className="profile-icon" 
        onClick={toggleMenu}
      >
        {getInitial(user?.email)}
      </div>
      
      {showMenu && (
        <div ref={menuRef} className="profile-menu">
          <div className="profile-email">{user?.email || 'wizard@hogwarts.edu'}</div>
          <div className="profile-house">
            HOUSE OF 
            <select 
              className="house-dropdown" 
              value={selectedHouse}
              onChange={handleHouseChange}
            >
              {houses.map(house => (
                <option key={house} value={house}>{house}</option>
              ))}
            </select>
          </div>
          
          <button>
            <i className="fas fa-user"></i>
            Profile
          </button>
          
          <button>
            <i className="fas fa-key"></i>
            Password
          </button>
          
          <button>
            <i className="fas fa-user-graduate"></i>
            <span>Full Name</span>
          </button>
          
          <button>
            <i className="fas fa-school"></i>
            <span>School</span>
          </button>
          
          <button>
            <i className="fas fa-graduation-cap"></i>
            <span>Class/Grade</span>
          </button>
          
          <button>
            <i className="fas fa-save"></i>
            Update Profile
          </button>
          
          <button className="logout-btn">
            <i className="fas fa-sign-out-alt"></i>
            Leave Hogwarts
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile; 