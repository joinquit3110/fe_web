import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = "https://be-web-6c4k.onrender.com/api";

const UserProfile = () => {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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
          setSuccess('Avatar updated successfully!');
          updateProfile({ ...user, avatar: avatarUrl });
        }
      } catch (err) {
        setError('Could not update avatar');
      } finally {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

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
      setError(err.message);
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
      setError(err.message);
    }
  };

  return (
    <div className="user-profile">
      <div className="user-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="avatar-container">
          {avatar || imagePreview ? (
            <img 
              src={imagePreview || avatar} 
              alt="avatar" 
              className="user-avatar"
              onError={() => setAvatar(null)} 
            />
          ) : (
            <div className="wizard-avatar">
              <i className="material-icons avatar-icon">account_circle</i>
            </div>
          )}
        </div>
        <span className="username">{user?.username}</span>
      </div>

      {isOpen && (
        <div className="profile-dropdown wizard-parchment">
          <div className="profile-header">
            <h3>Wizard Information</h3>
            <div className="magical-decoration wand"></div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <i className="material-icons">close</i>
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="avatar-upload-container">
            <div 
              className="avatar-upload wizard-frame" 
              onClick={handleAvatarClick}
              style={{
                backgroundImage: imagePreview || avatar ? `url(${imagePreview || avatar})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {!imagePreview && !avatar && (
                <div className="avatar-placeholder">
                  <i className="material-icons">add_a_photo</i>
                  <span>Upload Photo</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleAvatarChange}
                capture="environment"
              />
              <div className="avatar-overlay">
                <i className="material-icons">photo_camera</i>
              </div>
            </div>
            <small className="upload-hint">Click to change your wizard portrait</small>
          </div>

          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({...form, fullName: e.target.value})}
                className="wizard-input"
              />
            </div>
            <div className="form-group">
              <label>Wizarding School</label>
              <input
                type="text"
                value={form.school}
                onChange={(e) => setForm({...form, school: e.target.value})}
                className="wizard-input"
              />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm({...form, grade: e.target.value})}
                className="wizard-input"
              />
            </div>
            <button type="submit" className="update-btn hogwarts-btn">Update Information</button>
          </form>

          <form onSubmit={handlePasswordChange} className="password-form">
            <h4>Change Your Secret Spell (Password)</h4>
            <div className="magical-decoration book"></div>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm({...form, currentPassword: e.target.value})}
                className="wizard-input"
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({...form, newPassword: e.target.value})}
                className="wizard-input"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
                className="wizard-input"
              />
            </div>
            <button type="submit" className="change-password-btn hogwarts-btn">Change Password</button>
          </form>

          <button onClick={logout} className="logout-btn">
            <i className="material-icons">logout</i>
            Leave Hogwarts
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
