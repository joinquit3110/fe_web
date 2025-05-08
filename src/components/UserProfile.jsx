import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdmin } from '../contexts/AdminContext';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import '../styles/ProfileUI.css';
import { useMagicPoints } from '../context/MagicPointsContext';
import { useSocket } from '../context/SocketContext';
import { Box, Text } from '@chakra-ui/react';

const API_URL = "https://be-web-6c4k.onrender.com/api";

const UserProfile = ({ user: propUser }) => {
  const { user: contextUser, logout, updateProfile, updatePassword } = useAuth();
  const { isAdmin } = useAdmin();
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const user = propUser || contextUser;

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
  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState({
    unit: '%',
    width: 100,
    aspect: 1
  });
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const previewCanvasRef = useRef(null);
  const imageRef = useRef(null);

  // Define all useCallback hooks at the top level
  const onLoad = useCallback((img) => {
    if (!img) return false;
    imageRef.current = img;

    const width = img.width * 0.8;
    const height = img.height * 0.8;
    const x = (img.width - width) / 2;
    const y = (img.height - height) / 2;

    setCrop({
      unit: 'px',
      width,
      height,
      x,
      y,
      aspect: 1
    });

    return false;
  }, []);

  const onCropComplete = useCallback((crop, percentCrop) => {
    setCompletedCrop(crop);
    if (imageRef.current && crop.width && crop.height) {
      generateCroppedImage(imageRef.current, crop);
    }
  }, []);

  const generateCroppedImage = useCallback((image, crop) => {
    if (!crop || !image) return;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext('2d');

    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          return;
        }

        if (croppedImageUrl) {
          URL.revokeObjectURL(croppedImageUrl);
        }

        const croppedUrl = URL.createObjectURL(blob);
        setCroppedImageUrl(croppedUrl);
      },
      'image/jpeg',
      0.95
    );
  }, [croppedImageUrl]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
      }
    };
  }, [imagePreview, croppedImageUrl]);

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
  }, [user, form]);

  if (!user) return null;

  const toggleMenu = () => {
    setShowMenu(!showMenu);
    setError('');
    setSuccess('');
    if (!showMenu) {
      setShowCrop(false);
      setCroppedImageUrl(null);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'W';
  };

  const getHouseClass = (username) => {
    if (user && user.house) {
      return user.house.toLowerCase();
    }

    if (!username) return 'gryffindor';

    const sum = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const houses = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
    return houses[sum % houses.length];
  };

  const userHouse = getHouseClass(user.username);

  const handleAvatarClick = () => {
    if (showCrop) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setShowCrop(true);
    }
  };

  const uploadCroppedAvatar = async () => {
    if (!croppedImageUrl) {
      setError("Please crop the image first");
      return;
    }

    try {
      setSuccess('Uploading image...');

      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();

      const reader = new FileReader();

      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(new Error("Failed to convert image to base64"));
        };
      });

      reader.readAsDataURL(blob);
      const base64Image = await base64Promise;

      const base64Data = base64Image.split(',')[1];

      if (!base64Data) {
        throw new Error("Failed to process image data");
      }

      const imgbbApiKey = '2a641ab1b775ca9624cce32873427f43';
      const imgbbUrl = `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`;

      const formData = new URLSearchParams();
      formData.append('image', base64Data);

      const imgbbResponse = await fetch(imgbbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      });

      if (!imgbbResponse.ok) {
        const errorText = await imgbbResponse.text();
        console.error('ImgBB API error:', errorText);
        throw new Error(`ImgBB upload failed: ${imgbbResponse.status}`);
      }

      const imgbbData = await imgbbResponse.json();

      if (!imgbbData.success) {
        console.error('ImgBB data error:', imgbbData);
        throw new Error('ImgBB upload failed');
      }

      const avatarUrl = imgbbData.data.url;
      console.log('Image uploaded successfully to:', avatarUrl);

      const token = localStorage.getItem('token') || localStorage.getItem('authToken');

      if (!token) {
        throw new Error('Authentication required');
      }

      await updateProfile({ avatar: avatarUrl });

      setAvatar(avatarUrl);
      setSuccess('Avatar updated successfully!');
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError(`Failed to update avatar: ${err.message}`);
    } finally {
      setShowCrop(false);
      setImagePreview(null);
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
        setCroppedImageUrl(null);
      }
    }
  };

  const cancelCrop = () => {
    setShowCrop(false);
    setImagePreview(null);
    if (croppedImageUrl) {
      URL.revokeObjectURL(croppedImageUrl);
      setCroppedImageUrl(null);
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

  const getHouseColors = () => {
    const houses = {
      gryffindor: { bg: '#740001', text: '#FFC500', border: '#ae0001' },
      slytherin: { bg: '#1A472A', text: '#AAAAAA', border: '#2a623d' },
      ravenclaw: { bg: '#0E1A40', text: '#946B2D', border: '#222f5b' },
      hufflepuff: { bg: '#ECB939', text: '#000000', border: '#f0c75e' },
      muggle: { bg: '#6B6B6B', text: '#FFFFFF', border: '#888888' },
      admin: { bg: '#4B0082', text: '#FFFFFF', border: '#800080' }
    };

    return houses[userHouse] || houses.gryffindor;
  };

  const colors = getHouseColors();

  const { isConnected, connectionQuality } = useSocket();
  const { isOfflineMode, toggleOfflineMode } = useMagicPoints();
  
  // Determine status color and message
  let statusColor, statusMessage, icon;
  
  if (isOfflineMode) {
    statusColor = "orange.500";
    statusMessage = "Offline Mode";
    icon = "⚠️";
  } else if (!isConnected) {
    statusColor = "red.500";
    statusMessage = "Disconnected";
    icon = "❌";
  } else if (connectionQuality === 'poor') {
    statusColor = "yellow.500";
    statusMessage = "Poor Connection";
    icon = "⚡";
  } else {
    statusColor = "green.500";
    statusMessage = "Connected";
    icon = "✓";
  }

  // Add a ConnectionStatus component
  const ConnectionStatus = () => (
    <Box 
      position="absolute"
      top="5px"
      right="5px"
      px={2}
      py={1}
      borderRadius="md"
      bg={`${statusColor}30`}
      color={statusColor}
      fontWeight="bold"
      fontSize="xs"
      display="flex"
      alignItems="center"
      cursor={isOfflineMode ? "pointer" : "default"}
      onClick={isOfflineMode ? () => toggleOfflineMode(false) : undefined}
      title={isOfflineMode ? "Click to try reconnecting" : statusMessage}
      _hover={isOfflineMode ? { bg: `${statusColor}50` } : {}}
    >
      <Text mr={1}>{icon}</Text>
      <Text>{statusMessage}</Text>
    </Box>
  );

  return (
    <div className="profile-container-fixed">
      <div
        ref={buttonRef}
        className={`profile-avatar-button ${userHouse}`}
        onClick={toggleMenu}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={user.username}
            className="profile-avatar-img"
          />
        ) : (
          <span className="profile-avatar-initials">
            {getInitials(user.fullName || user.username)}
          </span>
        )}

        <div className={`profile-house-badge ${userHouse}`}>
          {userHouse.slice(0, 1).toUpperCase()}
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className={`profile-menu ${userHouse}`}
          style={{
            '--house-bg': colors.bg,
            '--house-text': colors.text,
            '--house-border': colors.border,
          }}
        >
          <div className="profile-menu-close" onClick={toggleMenu}>
            <i className="material-icons">close</i>
          </div>

          {showCrop ? (
            <div className="profile-crop-container">
              <h3 className="profile-section-title">Crop Avatar</h3>
              <div className="profile-crop-preview">
                <ReactCrop
                  src={imagePreview}
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={onCropComplete}
                  onImageLoaded={onLoad}
                  circularCrop
                >
                  <img
                    src={imagePreview}
                    alt="Avatar preview"
                    style={{ maxWidth: '100%' }}
                  />
                </ReactCrop>
              </div>

              {croppedImageUrl && (
                <div className="profile-crop-result">
                  <p className="profile-section-subtitle">Preview:</p>
                  <div className="profile-avatar-preview">
                    <img 
                      src={croppedImageUrl} 
                      alt="Cropped preview" 
                      className="profile-preview-img"
                    />
                  </div>
                </div>
              )}

              <div className="profile-button-group">
                <button
                  className="profile-button profile-button-success"
                  onClick={uploadCroppedAvatar}
                  disabled={!croppedImageUrl}
                >
                  <i className="material-icons">save</i> Save
                </button>
                <button
                  className="profile-button profile-button-danger"
                  onClick={cancelCrop}
                >
                  <i className="material-icons">close</i> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-header">
                <div className="profile-avatar-large-container">
                  <div
                    className={`profile-avatar-large ${userHouse}`}
                    onClick={handleAvatarClick}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={user.username}
                        className="profile-avatar-large-img"
                      />
                    ) : (
                      <span className="profile-avatar-large-initials">
                        {getInitials(user.fullName || user.username)}
                      </span>
                    )}
                    <div className="profile-avatar-edit-icon">
                      <i className="material-icons">photo_camera</i>
                    </div>
                  </div>
                </div>

                <div className="profile-user-info">
                  <h3 className="profile-username">{user.username}</h3>
                  <div className={`profile-house-badge-large ${userHouse}`}>
                    {userHouse.toUpperCase()}
                  </div>
                  {user.email && (
                    <div className="profile-email">{user.email}</div>
                  )}
                </div>
              </div>

              <div className="profile-divider"></div>

              <div className="profile-tabs">
                <button
                  className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  Profile
                </button>
                <button
                  className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
                  onClick={() => setActiveTab('password')}
                >
                  Password
                </button>
              </div>

              <div className="profile-tab-content">
                {error && <div className="profile-error-message">{error}</div>}
                {success && <div className="profile-success-message">{success}</div>}

                {activeTab === 'profile' && (
                  <form onSubmit={handleProfileUpdate} className="profile-form">
                    <div className="profile-form-group">
                      <label className="profile-form-label">Full Name</label>
                      <input
                        className="profile-form-input"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleInputChange}
                        placeholder="Your magical name"
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">School</label>
                      <input
                        className="profile-form-input"
                        name="school"
                        value={form.school}
                        onChange={handleInputChange}
                        placeholder="Your magical school"
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">Grade/Class</label>
                      <input
                        className="profile-form-input"
                        name="grade"
                        value={form.grade}
                        onChange={handleInputChange}
                        placeholder="Your grade or class"
                      />
                    </div>

                    <button
                      type="submit"
                      className={`profile-button profile-button-${userHouse}`}
                    >
                      <i className="material-icons">save</i> Save Profile
                    </button>
                  </form>
                )}

                {activeTab === 'password' && (
                  <form onSubmit={handlePasswordChange} className="profile-form">
                    <div className="profile-form-group">
                      <label className="profile-form-label">Current Password</label>
                      <input
                        className="profile-form-input"
                        name="currentPassword"
                        type="password"
                        value={form.currentPassword}
                        onChange={handleInputChange}
                        placeholder="Your current password"
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">New Password</label>
                      <input
                        className="profile-form-input"
                        name="newPassword"
                        type="password"
                        value={form.newPassword}
                        onChange={handleInputChange}
                        placeholder="Your new password"
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">Confirm Password</label>
                      <input
                        className="profile-form-input"
                        name="confirmPassword"
                        type="password"
                        value={form.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirm new password"
                      />
                    </div>

                    <button
                      type="submit"
                      className={`profile-button profile-button-${userHouse}`}
                    >
                      <i className="material-icons">vpn_key</i> Change Password
                    </button>
                  </form>
                )}
              </div>

              <div className="profile-divider"></div>

              <button
                className="profile-button profile-button-danger"
                onClick={handleLogout}
              >
                <i className="material-icons">logout</i> Leave Hogwarts
              </button>
            </>
          )}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
        accept="image/*"
      />

      <ConnectionStatus />
    </div>
  );
};

export default UserProfile;
