import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = "https://be-hung.onrender.com/api";

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
            <i className="material-icons avatar-icon">account_circle</i>
          )}
        </div>
        <span className="username">{user?.username}</span>
      </div>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-header">
            <h3>Thông tin tài khoản</h3>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <i className="material-icons">close</i>
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="avatar-upload-container">
            <div 
              className="avatar-upload" 
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
                  <span>Tải ảnh lên</span>
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
            <small className="upload-hint">Bấm để thay đổi ảnh đại diện</small>
          </div>

          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-group">
              <label>Họ và tên</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({...form, fullName: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Trường</label>
              <input
                type="text"
                value={form.school}
                onChange={(e) => setForm({...form, school: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Lớp</label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm({...form, grade: e.target.value})}
              />
            </div>
            <button type="submit" className="update-btn">Cập nhật thông tin</button>
          </form>

          <form onSubmit={handlePasswordChange} className="password-form">
            <h4>Đổi mật khẩu</h4>
            <div className="form-group">
              <label>Mật khẩu hiện tại</label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm({...form, currentPassword: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu mới</label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({...form, newPassword: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
              />
            </div>
            <button type="submit" className="change-password-btn">Đổi mật khẩu</button>
          </form>

          <button onClick={logout} className="logout-btn">
            <i className="material-icons">logout</i>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
