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
        <div 
          ref={menuRef} 
          className="profile-menu"
          style={{
            maxHeight: 'calc(100vh - 100px)', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
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
          
          <div className="profile-menu-buttons" style={{ flexGrow: 1, overflow: 'auto' }}>
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
          </div>
          
          <button className="logout-btn" style={{ marginTop: 'auto' }}>
            <i className="fas fa-sign-out-alt"></i>
            Leave Hogwarts
          </button>
        </div>
      )}
      
      {/* Add styles to fix profile menu scrolling */}
      <style jsx>{`
        .profile-menu {
          scrollbar-width: thin;
          scrollbar-color: var(--hogwarts-secondary) rgba(14, 26, 64, 0.4);
        }
        
        .profile-menu::-webkit-scrollbar {
          width: 6px;
        }
        
        .profile-menu::-webkit-scrollbar-track {
          background: rgba(14, 26, 64, 0.4);
          border-radius: 3px;
        }
        
        .profile-menu::-webkit-scrollbar-thumb {
          background-color: var(--hogwarts-secondary);
          border-radius: 3px;
        }
        
        .profile-menu-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default Profile; 