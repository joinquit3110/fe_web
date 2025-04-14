
import React from 'react';
import { Box } from '@chakra-ui/react';

export const BackgroundWrapper = ({ children }) => {
  return (
    <Box
      className="hogwarts-app"
      width="100%"
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      py={8}
      backgroundImage="url('/assets/images/hogwarts-bg.jpg')"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
    >
      {/* Dark overlay with magical particles */}
      <Box
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        bg="rgba(14, 26, 64, 0.85)"
        zIndex={0}
      />
      
      {/* Floating magical elements */}
      <Box className="floating-element wand" />
      <Box className="floating-element spellbook" />
      <Box className="floating-element potion" />
      
      {/* Content */}
      <Box
        position="relative"
        zIndex={1}
        width="100%"
        maxWidth="1400px"
        margin="0 auto"
        padding={["10px", "20px"]}
      >
        {children}
      </Box>
    </Box>
  );
};
