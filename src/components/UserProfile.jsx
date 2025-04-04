import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = "https://be-web-6c4k.onrender.com/api";

const UserProfile = () => {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
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

  if (!user) return null;
  
  const toggleMenu = () => {
    setShowMenu(!showMenu);
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
        
        const response = await fetch(`${API_URL}/api/auth/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (response.ok) {
          const { avatarUrl } = await response.json();
          setAvatar(avatarUrl);
          setSuccess('Cập nhật ảnh đại diện thành công!');
          updateProfile({ ...user, avatar: avatarUrl });
        }
      } catch (err) {
        setError('Không thể cập nhật ảnh đại diện');
      } finally {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({
        fullName: form.fullName,
        school: form.school,
        grade: form.grade
      });
      setSuccess('Cập nhật thông tin thành công!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu mới không khớp!');
      return;
    }
    try {
      await updatePassword(form.currentPassword, form.newPassword);
      setSuccess('Đổi mật khẩu thành công!');
      setForm({ ...form, currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="profile-container">
      <div className={`profile-icon ${userHouse}`} onClick={toggleMenu} title={`${user.username}'s profile`}>
        {getInitials(user.username)}
      </div>
      
      {showMenu && (
        <div className="profile-menu">
          <div className="menu-user-info">
            <span className="menu-username">{user.username}</span>
            <span className="menu-email">{user.email}</span>
            <span className="menu-house">House of {userHouse.charAt(0).toUpperCase() + userHouse.slice(1)}</span>
          </div>
          
          <button onClick={toggleMenu} title="View your wizarding achievements">
            <i className="material-icons">emoji_events</i>
            Achievements
          </button>
          
          <button onClick={toggleMenu} title="View your spell history">
            <i className="material-icons">history</i>
            Spell History
          </button>
          
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
