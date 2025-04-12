import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';  // Make sure path is consistent
import { useAdmin } from '../contexts/AdminContext';  // Import the admin context
import ReactCrop from 'react-image-crop'; // Add image cropping library
import 'react-image-crop/dist/ReactCrop.css'; // Import cropping styles

const API_URL = "https://be-web-6c4k.onrender.com/api";

const UserProfile = ({ user: propUser }) => {
  const { user: contextUser, logout, updateProfile, updatePassword } = useAuth();
  const { isAdmin } = useAdmin(); // Get admin status
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Use the prop user if provided, otherwise fall back to the context user
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
  const imageRef = useRef(null);
  
  // Log user data for debugging
  useEffect(() => {
    if (user) {
      console.log('User data loaded:', {
        username: user.username,
        fullName: user.fullName,
        school: user.school,
        grade: user.grade,
        house: user.house
      });
    }
  }, [user]);

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
  }, [user]);

  if (!user) return null;
  
  const toggleMenu = () => {
    setShowMenu(!showMenu);
    // Reset error and success messages when toggling menu
    setError('');
    setSuccess('');
    if (!showMenu) {
      // Close crop mode when opening the menu
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

  // Get house from user data instead of generating randomly
  const getHouseClass = (username) => {
    // If user has a house property, use it
    if (user && user.house) {
      return user.house.toLowerCase(); // Ensure lowercase to match CSS classes
    }
    
    // Fallback if no house information in user data
    // Keep old logic as a backup plan
    if (!username) return 'gryffindor';
    
    const sum = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const houses = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
    return houses[sum % houses.length];
  };

  const userHouse = getHouseClass(user.username);

  const handleAvatarClick = () => {
    if (showCrop) return; // Don't open file dialog if in crop mode
    fileInputRef.current?.click();
  };

  // Handle initial file selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setShowCrop(true);
    }
  };

  // When crop is complete
  const onCropComplete = (crop) => {
    if (imageRef.current && crop.width && crop.height) {
      getCroppedImg(imageRef.current, crop);
    }
  };

  // Create cropped image
  const getCroppedImg = (image, crop) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

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

    canvas.toBlob(blob => {
      if (!blob) return;
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
      }
      const croppedUrl = URL.createObjectURL(blob);
      setCroppedImageUrl(croppedUrl);
    }, 'image/jpeg', 0.95);
  };

  // Upload cropped avatar
  const uploadCroppedAvatar = async () => {
    if (!croppedImageUrl) return;
    
    try {
      // Convert the cropped image URL to a blob
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      
      // Show uploading notification
      setSuccess('Uploading image...');
      
      // Create FormData for upload
      const formData = new FormData();
      formData.append('image', blob, 'avatar.jpg');
      
      // Use ImgBB as alternative image hosting service
      const imgbbApiKey = '2a641ab1b775ca9624cce32873427f43'; // Free API key for demo
      const imgbbUrl = `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`;
      
      console.log('[AVATAR] Uploading image to ImgBB...');
      
      // Upload image to ImgBB
      const imgbbResponse = await fetch(imgbbUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!imgbbResponse.ok) {
        throw new Error(`ImgBB upload failed: ${imgbbResponse.status}`);
      }
      
      const imgbbData = await imgbbResponse.json();
      
      if (!imgbbData.success) {
        throw new Error('ImgBB upload failed');
      }
      
      // Get image URL from ImgBB
      const avatarUrl = imgbbData.data.url;
      console.log('[AVATAR] Image uploaded successfully:', avatarUrl);
      
      // Get token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Update avatar URL in user profile
      await updateProfile({ avatar: avatarUrl });
      
      // Update UI
      setAvatar(avatarUrl);
      setSuccess('Avatar updated successfully!');
    } catch (err) {
      console.error('[AVATAR] Error:', err);
      setError(`Failed to update avatar: ${err.message}`);
    } finally {
      // Clean up
      setShowCrop(false);
      setImagePreview(null);
      setCroppedImageUrl(null);
    }
  };

  // Cancel avatar cropping
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

  return (
    <div className="profile-container">
      <div className={`profile-icon ${userHouse}`} onClick={isAdmin ? null : toggleMenu} title={`${user.username}'s profile`}>
        {avatar ? (
          <img src={avatar} alt={user.username} className="avatar-img" />
        ) : (
          getInitials(user.fullName || user.username)
        )}
        
        {/* Add card to display info on hover */}
        <div className="profile-hover-card">
          <div className="profile-card-header">
            <span className={`house-badge mini ${userHouse}`}>{userHouse.toUpperCase()}</span>
            <h3>{user.fullName || user.username}</h3>
          </div>
          <div className="profile-card-details">
            <p><i className="material-icons">account_circle</i> {user.username}</p>
            {user.school && <p><i className="material-icons">school</i> {user.school}</p>}
            {user.grade && <p><i className="material-icons">class</i> {user.grade}</p>}
            {!(user.school || user.grade) && 
              <p className="no-details">Click to update your personal information</p>
            }
          </div>
        </div>
      </div>
      
      {showMenu && !isAdmin && (
        <div className="profile-menu">
          <div className="menu-header">
            <div className="avatar-section">
              <div 
                className={`avatar-wrapper ${userHouse}`} 
                onClick={handleAvatarClick}
                title="Change avatar"
              >
                {avatar ? (
                  <img src={avatar} alt={user.username} className="avatar-img" />
                ) : (
                  getInitials(user.fullName || user.username)
                )}
                <div className="avatar-edit">
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
              <span className="menu-username">{user.fullName || user.username}</span>
              <span className="menu-user-details">@{user.username}</span>
              <div className="menu-user-additional">
                {user.school && <span className="menu-school"><i className="material-icons">school</i> {user.school}</span>}
                {user.grade && <span className="menu-grade"><i className="material-icons">class</i> Grade: {user.grade}</span>}
                {!(user.school || user.grade) && 
                  <span className="no-details">Complete your profile information</span>
                }
              </div>
            </div>
          </div>
          
          {showCrop && (
            <div className="crop-container">
              {imagePreview && (
                <ReactCrop
                  src={imagePreview}
                  crop={crop}
                  onChange={newCrop => setCrop(newCrop)}
                  onComplete={onCropComplete}
                  circularCrop
                  className="crop-tool"
                >
                  <img ref={imageRef} src={imagePreview} alt="Upload preview" />
                </ReactCrop>
              )}
              <div className="crop-actions">
                <button 
                  className="crop-button save"
                  onClick={uploadCroppedAvatar} 
                  disabled={!croppedImageUrl}
                >
                  Save
                </button>
                <button 
                  className="crop-button cancel"
                  onClick={cancelCrop}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          <div className="profile-house">
            <span className="house-label">HOUSE OF</span> 
            {isAdmin ? (
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
                <option value="gryffindor">GRYFFINDOR</option>
                <option value="slytherin">SLYTHERIN</option>
                <option value="ravenclaw">RAVENCLAW</option>
                <option value="hufflepuff">HUFFLEPUFF</option>
                <option value="muggle">MUGGLE</option>
              </select>
            ) : (
              <span className={`house-badge ${userHouse}`}>
                {userHouse.toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="menu-tabs">
            <button 
              className={activeTab === 'profile' ? 'active' : ''} 
              onClick={() => setActiveTab('profile')}
            >
              PROFILE
            </button>
            <button 
              className={activeTab === 'password' ? 'active' : ''} 
              onClick={() => setActiveTab('password')}
            >
              PASSWORD
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
                  placeholder="Your class"
                />
              </div>
              
              <button type="submit" className="update-profile-btn">
                UPDATE PROFILE
              </button>
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
              
              <button type="submit" className="change-password-btn">
                CHANGE PASSWORD
              </button>
            </form>
          )}
          
          <button className="logout-button" onClick={handleLogout}>
            <i className="material-icons">exit_to_app</i> LEAVE HOGWARTS
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
