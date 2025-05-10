import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  FormControl, 
  FormLabel, 
  Input, 
  VStack, 
  Heading, 
  Text, 
  InputGroup, 
  InputRightElement,
  IconButton,
  Alert,
  AlertIcon,
  Link,
  useColorModeValue,
  Flex,
  Image
} from '@chakra-ui/react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/HarryPotter.css';
import '../styles/LoginHogwarts.css';
// Import house logo images
import gryffindorImg from '../asset/Gryffindor.png';
import slytherinImg from '../asset/Slytherin.png';
import ravenclawImg from '../asset/Ravenclaw.png';
import hufflepuffImg from '../asset/Hufflepuff.png';
import hogwartsLogoImg from '../asset/Hogwarts logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [userHouse, setUserHouse] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // When component mounts, check localStorage to automatically fill username and password if saved
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedUsername) {
      setEmail(savedUsername);
      setRememberMe(true);
      
      // If password is saved, fill it in as well
      if (savedPassword) {
        setPassword(savedPassword);
      }
    }
  }, []);

  // Add stars to the background
  useEffect(() => {
    const createStars = () => {
      const starsContainer = document.createElement('div');
      starsContainer.className = 'stars';
      
      // Create small stars
      const smallStars = document.createElement('div');
      smallStars.className = 'small-stars';
      
      // Create medium stars
      const mediumStars = document.createElement('div');
      mediumStars.className = 'medium-stars';
      
      // Generate random positions for stars
      for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 3}s`;
        
        if (i < 70) {
          smallStars.appendChild(star.cloneNode());
        } else {
          mediumStars.appendChild(star.cloneNode());
        }
      }
      
      starsContainer.appendChild(smallStars);
      starsContainer.appendChild(mediumStars);
      
      // Add moon
      const moonWrapper = document.createElement('div');
      moonWrapper.className = 'moon-wrapper';
      
      const moonlight1 = document.createElement('div');
      moonlight1.className = 'moonlight moonlight-1';
      
      const moonlight2 = document.createElement('div');
      moonlight2.className = 'moonlight moonlight-2';
      
      const moonlight3 = document.createElement('div');
      moonlight3.className = 'moonlight moonlight-3';
      
      const moonlight4 = document.createElement('div');
      moonlight4.className = 'moonlight moonlight-4';
      
      const moon = document.createElement('div');
      moon.className = 'moon';
      
      moonlight4.appendChild(moon);
      moonlight3.appendChild(moonlight4);
      moonlight2.appendChild(moonlight3);
      moonlight1.appendChild(moonlight2);
      moonWrapper.appendChild(moonlight1);
      
      document.body.appendChild(starsContainer);
      document.body.appendChild(moonWrapper);
      
      return () => {
        document.body.removeChild(starsContainer);
        document.body.removeChild(moonWrapper);
      };
    };
    
    const cleanup = createStars();
    return cleanup;
  }, []);

  // Effect for house logo transition after login
  useEffect(() => {
    if (loginSuccess && userHouse) {
      // Delay navigation to allow house animation to be displayed
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 2500); // Show logo for 2.5 seconds before navigating
      return () => clearTimeout(timer);
    }
  }, [loginSuccess, userHouse, navigate]);

  const handleTogglePassword = () => setShowPassword(!showPassword);
  
  const handleEnrollClick = () => {
    // Redirect to registration page - use register path instead of signup
    navigate('/register');
    
    // For debugging
    console.log('Enrollment button clicked. Navigating to /register');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Save username and password if remember me is selected
    if (rememberMe) {
      localStorage.setItem('rememberedUsername', email);
      localStorage.setItem('rememberedPassword', password);
    } else {
      localStorage.removeItem('rememberedUsername');
      localStorage.removeItem('rememberedPassword');
    }
    
    try {
      // Check for admin credentials
      const adminUsers = ['hungpro', 'vipro'];
      const adminPassword = '3110';
      
      if (adminUsers.includes(email) && password === adminPassword) {
        console.log('Admin login detected');
        
        // Create a fake admin user object
        const adminUser = {
          id: `admin-${email}`,
          username: email,
          email: `${email}@hogwarts.admin.edu`,
          fullName: `Admin ${email.charAt(0).toUpperCase() + email.slice(1)}`,
          isAdmin: true,
          role: 'admin',
          house: 'admin'
        };
        
        // Store admin user in localStorage with proper event triggering
        localStorage.setItem('user', JSON.stringify(adminUser));
        localStorage.setItem('token', `admin-token-${Date.now()}`);
        
        // Set isAuthenticated last to ensure all data is ready
        localStorage.setItem('isAuthenticated', 'true');
        
        // Trigger a custom event for other contexts to detect the authentication change
        window.dispatchEvent(new Event('authStateChanged'));
        
        // Set admin house for animation
        setUserHouse('admin');
        setLoginSuccess(true);
        return;
      }
      
      // Regular user flow
      // Use the credentials object format expected by the API
      const userData = await login({
        username: email, // Server expects username
        password: password
      });
      
      // Explicitly trigger authentication state change event
      window.dispatchEvent(new Event('authStateChanged'));
      
      // Get user house for animation
      if (userData && userData.house) {
        setUserHouse(userData.house.toLowerCase());
        setLoginSuccess(true);
      } else {
        // Brief timeout to allow contexts to update before navigation
        setTimeout(() => {
          navigate('/dashboard');
        }, 300);
      }
    } catch (error) {
      console.error('Login form error:', error);
      
      // Enhanced error handling for CORS issues
      if (error.message === 'Failed to fetch') {
        setError('Unable to connect to Hogwarts authentication system. Please try again later.');
      } else {
        setError(error.message || 'Login failed. Please check your credentials.');
      }
      setIsLoading(false);
    }
  };

  // Get house logo based on house name
  const getHouseLogo = (house) => {
    if (!house) return null;
    
    const houseName = house.toLowerCase();
    switch (houseName) {
      case 'gryffindor':
        return gryffindorImg;
      case 'slytherin':
        return slytherinImg;
      case 'ravenclaw':
        return ravenclawImg;
      case 'hufflepuff':
        return hufflepuffImg;
      default:
        return hogwartsLogoImg;
    }
  };

  const getHouseColor = (house) => {
    if (!house) return 'white';
    
    const houseName = house.toLowerCase();
    switch (houseName) {
      case 'gryffindor':
        return '#D61A1F';
      case 'slytherin':
        return '#1A472A';
      case 'ravenclaw':
        return '#0E1A64';
      case 'hufflepuff':
        return '#ECB939';
      default:
        return 'white';
    }
  };

  // If login is successful and we have a house, show the house logo animation
  if (loginSuccess && userHouse) {
    return (
      <Box 
        width="100%" 
        height="100vh"
        className="hogwarts-app"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
          className="house-logo-container"
        >
          <Image
            src={getHouseLogo(userHouse)}
            alt={`${userHouse} house`}
            width="280px"
            height="auto"
            className="house-logo-animation"
            sx={{
              aspectRatio: '1/1',
              maxWidth: '700px',
              maxHeight: '700px',
              objectFit: 'contain',
            }}
          />
          
          {/* House particles animation - now around the house logo */}
          <div className="house-particles-container">
            {[...Array(50)].map((_, i) => (
              <div 
                key={i}
                className="house-particle"
                style={{
                  '--size': `${Math.random() * 10 + 4}px`,
                  '--x': `${Math.random() * 200 - 100}%`,
                  '--y': `${Math.random() * 200 - 100}%`,
                  '--delay': `${Math.random() * 3}s`,
                  '--duration': `${Math.random() * 3 + 3}s`,
                  '--opacity': Math.random() * 0.8 + 0.4,
                  backgroundColor: getHouseColor(userHouse),
                  boxShadow: `0 0 15px 3px ${getHouseColor(userHouse)}`,
                  zIndex: Math.floor(Math.random() * 10)
                }}
              />
            ))}
          </div>
        </Box>

        {/* CSS for house logo animations */}
        <style jsx>{`
          .house-logo-animation {
            animation: appear 0.7s ease-out, pulse 2s ease-in-out infinite;
            filter: drop-shadow(0 0 35px rgba(255, 255, 255, 0.9));
          }
          
          @keyframes appear {
            0% { transform: scale(0); opacity: 0; }
            70% { transform: scale(1.2); opacity: 0.9; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.8)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 40px rgba(255, 255, 255, 1)); }
          }
          
          .house-logo-container {
            background: radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(14,26,64,0.9) 100%);
            animation: fade-in 0.5s ease-out;
          }
          
          @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          
          .house-particles-container {
            position: absolute;
            width: 500px;
            height: 500px;
            pointer-events: none;
          }
          
          .house-particle {
            position: absolute;
            top: 50%;
            left: 50%;
            width: var(--size);
            height: var(--size);
            opacity: 0;
            border-radius: 50%;
            box-shadow: 0 0 10px 2px currentColor;
            animation: particle-float var(--duration) ease-in-out infinite;
            animation-delay: var(--delay);
            z-index: 10;
          }
          
          @keyframes particle-float {
            0% {
              transform: translate(0, 0);
              opacity: 0;
            }
            25% {
              opacity: var(--opacity);
              transform: translate(calc(var(--x) * 0.3), calc(var(--y) * 0.3));
            }
            50% {
              opacity: var(--opacity);
              transform: translate(calc(var(--x) * 0.6), calc(var(--y) * 0.6));
            }
            75% {
              opacity: var(--opacity);
              transform: translate(calc(var(--x) * 0.9), calc(var(--y) * 0.9));
            }
            100% {
              transform: translate(var(--x), var(--y));
              opacity: 0;
            }
          }
        `}</style>
      </Box>
    );
  }

  return (
    <Box 
      width="100%" 
      minHeight="100vh"
      className="hogwarts-app"
      display="flex"
      alignItems="center"
      justifyContent="center"
      padding={4}
      position="relative"
    >
      {/* Floating magical elements */}
      <Box className="floating-element wand" position="absolute" top="15%" left="10%" />
      <Box className="floating-element spellbook" position="absolute" bottom="15%" right="10%" />
      <Box className="floating-element potion" position="absolute" top="20%" right="15%" />
      
      <Box 
        p={8} 
        maxWidth="450px" 
        borderRadius="lg"
        className="wizard-panel"
        width="100%"
        position="relative"
      >
        <Box className="panel-decoration left" />
        <Box className="panel-decoration right" />
        
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          mb={2}
          className="hogwarts-header magic-title-block"
          position="relative"
        >
          <Image
            src={hogwartsLogoImg}
            alt="Hogwarts Logo"
            width="120px"
            height="120px"
            mb={3}
            loading="eager"
            priority={true}
            className="hogwarts-logo animated-logo"
            style={{ 
              filter: 'drop-shadow(0 0 16px #f0c75e)',
              animation: 'float-logo 3s infinite ease-in-out',
              objectFit: 'contain'
            }}
            onLoad={() => {
              // Remove placeholder when image is loaded
              const placeholderEl = document.querySelector('.hogwarts-logo-placeholder');
              if (placeholderEl) {
                placeholderEl.style.display = 'none';
              }
              // Mark logo as loaded to avoid preload errors
              document.querySelector('link[rel="preload"][as="image"]')?.remove();
            }}
          />
          {/* Placeholder for logo while loading */}
          <Box 
            className="hogwarts-logo-placeholder"
            width="120px"
            height="120px"
            position="absolute"
            top="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="#f0c75e"
            fontFamily="'MedievalSharp', serif"
            fontSize="24px"
            fontWeight="bold"
            textAlign="center"
            sx={{
              animation: 'pulse-placeholder 2s infinite'
            }}
          >
            H
          </Box>
          <Box position="relative" display="flex" alignItems="center" justifyContent="center">
            <Heading
              as="h1"
              size="xl"
              className="hogwarts-title magic-title"
              textAlign="center"
              fontFamily="'MedievalSharp', 'Cinzel', serif"
              fontWeight="bold"
              letterSpacing={2}
              color="#F0C75E"
              style={{
                textShadow: '0 0 18px #f0c75e, 0 2px 8px #0e1a40',
                position: 'relative',
                zIndex: 2
              }}
            >
              Hogwarts
            </Heading>
          </Box>
        </Box>
        
        <VStack spacing={6} align="center" className="control-panel-content">
          <Heading as="h2" size="lg" className="highlight" textAlign="center">
            Welcome, Wizard
          </Heading>
          
          <Text fontSize="lg" className="message-content" textAlign="center">
            Enter your credentials to continue your magical journey
          </Text>
          
          {error && (
            <Box className="message-box error" width="100%">
              <Text className="message-content">{error}</Text>
            </Box>
          )}
          
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <VStack spacing={5} align="flex-start" width="100%">
              <FormControl isRequired>
                <FormLabel className="wizard-input-label">Wizard Name</FormLabel>
                <InputGroup>
                  <Input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your wizard name"
                    className="inequality-input-field"
                    color="var(--text-primary)"
                    _placeholder={{ color: 'var(--text-secondary)', opacity: 0.7 }}
                    borderColor="var(--panel-border)"
                    background="var(--input-bg)"
                    autoComplete="username"
                  />
                </InputGroup>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel className="wizard-input-label">Secret Spell</FormLabel>
                <InputGroup>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your secret spell"
                    className="inequality-input-field"
                    color="var(--text-primary)"
                    _placeholder={{ color: 'var(--text-secondary)', opacity: 0.7 }}
                    borderColor="var(--panel-border)"
                    background="var(--input-bg)"
                    autoComplete="current-password"
                  />
                  <InputRightElement>
                    <IconButton
                      size="sm"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      icon={<Text fontSize="xs" color="var(--text-secondary)">{showPassword ? 'Hide' : 'Show'}</Text>}
                      onClick={handleTogglePassword}
                      variant="ghost"
                      _hover={{ bg: 'transparent', color: 'var(--light-accent)' }}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              
              {/* Checkbox Remember Me - Enhanced styling */}
              <FormControl 
                display="flex" 
                alignItems="center"
                bg="rgba(14, 26, 64, 0.4)"
                p={2}
                borderRadius="md"
                mt={1}
              >
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ 
                    marginRight: 8,
                    accentColor: 'var(--hogwarts-secondary)',
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer'
                  }}
                />
                <label 
                  htmlFor="rememberMe" 
                  style={{ 
                    color: 'var(--text-primary)', 
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: "'Cormorant Garamond', serif",
                    letterSpacing: '0.5px'
                  }}
                >
                  Remember my wizard credentials
                </label>
              </FormControl>
              
              <Box position="relative" width="100%">
                <Button
                  width="100%"
                  type="submit"
                  className="spellcast-button"
                  isLoading={isLoading}
                  loadingText="Casting Spell..."
                  mt={2}
                >
                  Alohomora
                </Button>
                
                {/* Spell particles */}
                <Box className="spell-particles-container">
                  {[...Array(15)].map((_, i) => (
                    <Box 
                      key={i}
                      className="spell-particle"
                      style={{
                        left: `${50}%`,
                        top: `${50}%`,
                        '--x': `${Math.random() * 200 - 100}px`,
                        '--y': `${Math.random() * -200 - 50}px`,
                        animationDelay: `${Math.random() * 0.5}s`
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </VStack>
          </form>
          
          <Text className="hogwarts-text" alignSelf="center" mt={4}>
            First year at Hogwarts?{' '}
            <Button 
              className="enroll-button" 
              variant="link" 
              onClick={handleEnrollClick}
              _hover={{ textDecoration: 'none' }}
            >
              Enroll Now
            </Button>
          </Text>
        </VStack>
      </Box>
      
      {/* CSS for house logo animations */}
      <style jsx global>{`
        @keyframes logo-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        
        .house-logo-container {
          background: radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(14,26,64,0.9) 100%);
          animation: fade-in 0.5s ease-out;
        }
        
        .house-logo-animation {
          animation: appear 0.5s ease-out, pulse 2s infinite;
          filter: drop-shadow(0 0 20px rgba(255,255,255,0.8));
        }
        
        @keyframes appear {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.2); opacity: 0.9; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { filter: drop-shadow(0 0 15px rgba(255,255,255,0.7)); }
          50% { filter: drop-shadow(0 0 30px rgba(255,255,255,0.9)); }
        }
        
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        .house-particles-container {
          position: absolute;
          width: 350px;
          height: 350px;
          pointer-events: none;
        }

        .house-particle {
          position: absolute;
          width: var(--size);
          height: var(--size);
          background-color: white;
          border-radius: 50%;
          animation: particle-float var(--duration) ease-in-out var(--delay) infinite;
        }

        @keyframes particle-float {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(var(--x), var(--y));
            opacity: 0;
          }
        }

        .magic-title-block { margin-bottom: 18px; }
        .magic-title { font-size: 2.1rem !important; }
        .magic-glow { animation: magic-glow 2.2s infinite alternate; }
        @keyframes magic-glow {
          0% { text-shadow: 0 0 18px #f0c75e, 0 2px 8px #0e1a40; }
          50% { text-shadow: 0 0 32px #fffbe6, 0 2px 12px #f0c75e; }
          100% { text-shadow: 0 0 18px #f0c75e, 0 2px 8px #0e1a40; }
        }
        .magic-underline { animation: panel-fade-in 1.2s; }
      `}</style>
    </Box>
  );
};

export default Login;
