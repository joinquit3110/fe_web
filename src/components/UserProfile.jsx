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
    <div className="profile-container" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
      <div 
        className={`profile-icon ${userHouse}`} 
        onClick={toggleMenu}
      >
        {avatar ? (
          <img 
            src={avatar} 
            alt={user.username} 
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
          />
        ) : (
          getInitials(user.fullName || user.username)
        )}
      </div>
      
      {/* Hover card with basic user info */}
      <div className="profile-hover-card">
        <div className="profile-card-header">
          <h3>{user.username}</h3>
          <span className={`house-badge ${userHouse} mini`}>
            {userHouse.toUpperCase()}
          </span>
        </div>
        <div className="profile-card-details">
          {user.fullName ? (
            <p><i className="material-icons">person</i> {user.fullName}</p>
          ) : null}
          {user.school ? (
            <p><i className="material-icons">school</i> {user.school}</p>
          ) : null}
          {user.grade ? (
            <p><i className="material-icons">grade</i> {user.grade}</p>
          ) : null}
          {!user.fullName && !user.school && !user.grade && (
            <p className="no-details">Click to update profile</p>
          )}
        </div>
      </div>
      
      {/* Profile menu */}
      {showMenu && (
        <div className="profile-menu" style={{ 
          maxHeight: 'calc(100vh - 80px)', 
          overflowY: 'auto',
          paddingRight: '10px',
          msOverflowStyle: 'none',  /* IE và Edge */
          scrollbarWidth: 'thin',   /* Firefox */
          scrollbarColor: 'rgba(211, 166, 37, 0.5) transparent'
        }}>
          {/* Custom scrollbar for Webkit browsers */}
          <style jsx>{`
            .profile-menu::-webkit-scrollbar {
              width: 6px;
            }
            .profile-menu::-webkit-scrollbar-track {
              background: transparent;
            }
            .profile-menu::-webkit-scrollbar-thumb {
              background-color: rgba(211, 166, 37, 0.5);
              border-radius: 6px;
            }
          `}</style>

          {/* File input for avatar (hidden) */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleAvatarChange}
            accept="image/*"
          />
          
          {/* Avatar cropping UI */}
          {showCrop && (
            <div className="crop-tool">
              <h3>Crop Your Avatar</h3>
              <div className="crop-container">
                <ReactCrop 
                  src={imagePreview} 
                  crop={crop} 
                  onChange={newCrop => setCrop(newCrop)}
                  onComplete={onCropComplete}
                  circularCrop
                >
                  <img ref={imageRef} src={imagePreview} alt="Avatar preview" style={{ maxWidth: '100%' }} />
                </ReactCrop>
              </div>
              <div className="crop-actions">
                <button onClick={uploadCroppedAvatar} className="crop-save">
                  <i className="material-icons">save</i> Save Avatar
                </button>
                <button onClick={cancelCrop} className="crop-cancel">
                  <i className="material-icons">cancel</i> Cancel
                </button>
              </div>
            </div>
          )}
          
          {!showCrop && (
            <>
              {/* User avatar section */}
              <div 
                className="user-avatar"
                onClick={handleAvatarClick}
                style={{ 
                  cursor: 'pointer',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: avatar ? 'transparent' : `var(--${userHouse}-primary)`,
                  color: avatar ? 'transparent' : `var(--${userHouse}-text)`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '32px',
                  margin: '0 auto 15px',
                  border: '2px solid var(--secondary-color)',
                  boxShadow: '0 0 15px rgba(211, 166, 37, 0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt={user.username} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  getInitials(user.fullName || user.username)
                )}
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  right: '0',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 0',
                  textAlign: 'center'
                }}>
                  CHANGE
                </div>
              </div>
              
              {/* User info section */}
              <div className="menu-user-info">
                <h3 style={{ 
                  margin: '0 0 5px', 
                  fontSize: '18px', 
                  textAlign: 'center',
                  color: 'var(--text-primary)',
                  fontFamily: "'Cinzel', serif"
                }}>
                  {user.username}
                </h3>
                <p className="profile-email">{user.email}</p>
              </div>
              
              {/* House assignment */}
              <div className="profile-house">
                <span>HOUSE:</span>
                {isAdmin ? (
                  <select 
                    className="house-dropdown"
                    value={user.house || 'unassigned'}
                    onChange={e => {
                      const newHouse = e.target.value;
                      updateProfile({ house: newHouse });
                    }}
                  >
                    <option value="unassigned">UNASSIGNED</option>
                    <option value="gryffindor">GRYFFINDOR</option>
                    <option value="hufflepuff">HUFFLEPUFF</option>
                    <option value="ravenclaw">RAVENCLAW</option>
                    <option value="slytherin">SLYTHERIN</option>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
