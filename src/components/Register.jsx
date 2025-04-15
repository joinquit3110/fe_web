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
  Flex
} from '@chakra-ui/react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/HarryPotter.css';
import '../styles/LoginHogwarts.css';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Add stars to the background (same as in Login component)
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

  const handleTogglePassword = () => setShowPassword(!showPassword);
  const handleToggleConfirmPassword = () => setShowConfirmPassword(!showConfirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Password validation
    if (password !== confirmPassword) {
      setError('Your spells do not match! Please make sure your secret spells are identical.');
      return;
    }

    if (password.length < 6) {
      setError('Your secret spell is too weak! It must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Use the register function from AuthContext
      await register({
        username,
        email,
        password
      });
      
      // Redirect to login page after successful registration
      navigate('/');
    } catch (error) {
      console.error('Registration form error:', error);
      
      // Enhanced error handling
      if (error.message === 'Failed to fetch') {
        setError('Unable to connect to Hogwarts registration system. Please try again later or contact a professor for assistance.');
      } else {
        setError(error.message || 'Registration failed. Please check your information and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
        
        <VStack spacing={6} align="center" className="control-panel-content">
          <Heading as="h1" size="xl" className="hogwarts-title" textAlign="center">
            Hogwarts
          </Heading>
          
          <Heading as="h2" size="lg" className="highlight" textAlign="center">
            New Student Enrollment
          </Heading>
          
          <Text fontSize="lg" className="message-content" textAlign="center">
            Fill in your details to begin your magical journey
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
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose your wizard name"
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
                <FormLabel className="wizard-input-label">Owl Mail Address</FormLabel>
                <InputGroup>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your owl mail address"
                    className="inequality-input-field"
                    color="var(--text-primary)"
                    _placeholder={{ color: 'var(--text-secondary)', opacity: 0.7 }}
                    borderColor="var(--panel-border)"
                    background="var(--input-bg)"
                    autoComplete="email"
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
                    placeholder="Create your secret spell"
                    className="inequality-input-field"
                    color="var(--text-primary)"
                    _placeholder={{ color: 'var(--text-secondary)', opacity: 0.7 }}
                    borderColor="var(--panel-border)"
                    background="var(--input-bg)"
                    autoComplete="new-password"
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
              
              <FormControl isRequired>
                <FormLabel className="wizard-input-label">Confirm Secret Spell</FormLabel>
                <InputGroup>
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your secret spell"
                    className="inequality-input-field"
                    color="var(--text-primary)"
                    _placeholder={{ color: 'var(--text-secondary)', opacity: 0.7 }}
                    borderColor="var(--panel-border)"
                    background="var(--input-bg)"
                    autoComplete="new-password"
                  />
                  <InputRightElement>
                    <IconButton
                      size="sm"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      icon={<Text fontSize="xs" color="var(--text-secondary)">{showConfirmPassword ? 'Hide' : 'Show'}</Text>}
                      onClick={handleToggleConfirmPassword}
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
                  loadingText="Enchanting..."
                  mt={2}
                >
                  Enroll at Hogwarts
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
            Already a student at Hogwarts?{' '}
            <Button 
              className="enroll-button" 
              variant="link" 
              onClick={() => navigate('/')}
              _hover={{ textDecoration: 'none' }}
            >
              Return to Login
            </Button>
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default Register; 