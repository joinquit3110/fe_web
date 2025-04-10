import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = "https://be-web-6c4k.onrender.com/api";

const UserProfile = () => {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    school: user?.school || '',
    grade: user?.grade || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    if (user) {
      setForm({
        ...form,
        fullName: user.fullName || '',
        school: user.school || '',
        grade: user.grade || ''
      });
      setAvatar(user.avatar || null);
    }
  }, [user]);

  if (!user) return null;
  
  const toggleMenu = () => {
    setShowMenu(!showMenu);
    // Reset error and success messages when toggling menu
    setError('');
    setSuccess('');
  };
  
  const handleLogout = () => {
    logout();
  };
  
  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'W';
  };

  // Assign a Hogwarts house based on username
  const getHouseClass = (username) => {
    if (!username) return 'gryffindor';
    
    // Simple hashing of username to pick a house
    const sum = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const houses = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
    return houses[sum % houses.length];
  };

  const userHouse = getHouseClass(user.username);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      try {
        const formData = new FormData();
        formData.append('avatar', file);
        
        const response = await fetch(`${API_URL}/auth/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (response.ok) {
          const { avatarUrl } = await response.json();
          setAvatar(avatarUrl);
          setSuccess('Avatar updated successfully!');
          updateProfile({ ...user, avatar: avatarUrl });
        }
      } catch (err) {
        setError('Failed to update avatar');
      } finally {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: value
    });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({
        fullName: form.fullName,
        school: form.school,
        grade: form.grade
      });
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match!');
      return;
    }
    try {
      await updatePassword(form.currentPassword, form.newPassword);
      setSuccess('Password changed successfully!');
      setForm({ ...form, currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Failed to change password');
    }
  };

  return (
    <div className="profile-container">
      <div className={`profile-icon ${userHouse}`} onClick={toggleMenu} title={`${user.username}'s profile`}>
        {avatar ? (
          <img src={avatar} alt={user.username} className="avatar-img" />
        ) : (
          getInitials(user.fullName || user.username)
        )}
      </div>
      
      {showMenu && (
        <div className="profile-menu">
          <div className="menu-header">
            <div className="avatar-section">
              <div 
                className={`avatar-container ${userHouse}`} 
                onClick={handleAvatarClick}
                title="Change avatar"
              >
                {avatar ? (
                  <img src={avatar} alt={user.username} className="profile-avatar" />
                ) : (
                  <div className="default-avatar">{getInitials(user.fullName || user.username)}</div>
                )}
                <div className="avatar-overlay">
                  <i className="material-icons">photo_camera</i>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>
            
            <div className="menu-user-info">
              <span className="menu-username">{user.username}</span>
              <div className="profile-email">{user.email}</div>
              <div className="profile-house">
                HOUSE OF 
                <select 
                  className="house-dropdown" 
                  value={userHouse}
                  onChange={(e) => {
                    // Save house preference in localStorage for persistence
                    localStorage.setItem('userHouse', e.target.value);
                    // Use a different event name to avoid confusion
                    const changeEvent = new CustomEvent('houseChange', {
                      detail: { house: e.target.value }
                    });
                    document.dispatchEvent(changeEvent);
                  }}
                >
                  <option value="gryffindor">Gryffindor</option>
                  <option value="slytherin">Slytherin</option>
                  <option value="ravenclaw">Ravenclaw</option>
                  <option value="hufflepuff">Hufflepuff</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="menu-tabs">
            <button 
              className={activeTab === 'profile' ? 'active' : ''} 
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button 
              className={activeTab === 'password' ? 'active' : ''} 
              onClick={() => setActiveTab('password')}
            >
              Password
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="profile-form">
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleInputChange}
                  placeholder="Your wizard name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="school">School</label>
                <input
                  type="text"
                  id="school"
                  name="school"
                  value={form.school}
                  onChange={handleInputChange}
                  placeholder="Your magical school"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="grade">Class/Grade</label>
                <input
                  type="text"
                  id="grade"
                  name="grade"
                  value={form.grade}
                  onChange={handleInputChange}
                  placeholder="Your class or grade"
                />
              </div>
              
              <button type="submit" className="update-btn">Update Profile</button>
            </form>
          )}
          
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="password-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={form.currentPassword}
                  onChange={handleInputChange}
                  placeholder="Enter current password"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={form.newPassword}
                  onChange={handleInputChange}
                  placeholder="Enter new password"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm new password"
                />
              </div>
              
              <button type="submit" className="update-btn">Change Password</button>
            </form>
          )}
          
          <button className="logout-btn" onClick={handleLogout} title="Leave Hogwarts">
            <i className="material-icons">exit_to_app</i>
            Leave Hogwarts
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
