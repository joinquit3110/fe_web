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
  const { login } = useAuth();
  const navigate = useNavigate();

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
        
        // Store admin user in localStorage
        localStorage.setItem('user', JSON.stringify(adminUser));
        localStorage.setItem('token', `admin-token-${Date.now()}`);
        localStorage.setItem('isAuthenticated', 'true');
        
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
      
      // Get user house for animation
      if (userData && userData.house) {
        setUserHouse(userData.house.toLowerCase());
        setLoginSuccess(true);
      } else {
        navigate('/dashboard');
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
            width="250px"
            height="auto"
            className="house-logo-animation"
            sx={{
              aspectRatio: '1/1',
              maxWidth: '700px',
              maxHeight: '700px',
              objectFit: 'contain',
            }}
          />
        </Box>
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
      
      {/* Hogwarts logo animation */}
      <Box
        position="absolute"
        top="50px"
        left="50%"
        transform="translateX(-50%)"
        width="180px"
        height="auto"
        className="hogwarts-logo-container"
        textAlign="center"
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Image
          src={hogwartsLogoImg}
          alt="Hogwarts Logo"
          className="hogwarts-logo-animation"
          sx={{
            aspectRatio: '1/1',
            maxWidth: '700px',
            maxHeight: '700px',
            objectFit: 'contain',
            margin: '0 auto'
          }}
        />
      </Box>
      
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
        
        <VStack spacing={6} align="center" className="control-panel-content">
          <Heading as="h1" size="xl" className="hogwarts-title" textAlign="center">
            Hogwarts
          </Heading>
          
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
      
      {/* CSS for Logo animations */}
      <style jsx global>{`
        .hogwarts-logo-animation {
          animation: logo-float 4s ease-in-out infinite;
          filter: drop-shadow(0 0 15px rgba(211, 166, 37, 0.7));
        }
        
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
      `}</style>
    </Box>
  );
};

export default Login;
