import React, { useState } from 'react';
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
  useColorModeValue
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, LockIcon, EmailIcon } from '@chakra-ui/icons';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BackgroundWrapper } from './BackgroundWrapper';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleTogglePassword = () => setShowPassword(!showPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Send login credentials without additional JSON.stringify
      const response = await login(email, password);
      
      if (response && response.token) {
        // Store the token correctly
        localStorage.setItem('token', response.token);
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Navigate after successful login
        navigate('/dashboard');
      } else {
        throw new Error('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const bgColor = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <BackgroundWrapper>
      <Box 
        p={8} 
        maxWidth="400px" 
        borderWidth={1} 
        borderRadius="lg" 
        boxShadow="lg"
        bg={bgColor}
        borderColor={borderColor}
        mx="auto"
        mt={12}
      >
        <VStack spacing={4} align="flex-start">
          <Heading as="h2" size="xl">Welcome to Hogwarts</Heading>
          <Text>Sign in to continue your magical journey</Text>
          
          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <VStack spacing={4} align="flex-start" width="100%">
              <FormControl isRequired>
                <FormLabel>Email or Username</FormLabel>
                <InputGroup>
                  <Input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email or username"
                    leftIcon={<EmailIcon />}
                  />
                </InputGroup>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <InputGroup>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    leftIcon={<LockIcon />}
                  />
                  <InputRightElement>
                    <IconButton
                      size="sm"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      onClick={handleTogglePassword}
                      variant="ghost"
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              
              <Button
                width="100%"
                type="submit"
                colorScheme="blue"
                isLoading={isLoading}
                leftIcon={<LockIcon />}
              >
                Enter Hogwarts
              </Button>
            </VStack>
          </form>
          
          <Text alignSelf="center">
            First year at Hogwarts?{' '}
            <Link as={RouterLink} to="/register" color="blue.500">
              Enroll Now
            </Link>
          </Text>
        </VStack>
      </Box>
    </BackgroundWrapper>
  );
};

export default Login;
