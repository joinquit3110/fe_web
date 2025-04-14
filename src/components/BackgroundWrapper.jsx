import React from 'react';
import { Box } from '@chakra-ui/react';

export const BackgroundWrapper = ({ children }) => {
  return (
    <Box
      width="100%"
      minHeight="100vh"
      backgroundImage="url('/assets/images/hogwarts-bg.jpg')"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      py={8}
    >
      {/* Dark overlay */}
      <Box
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        bg="rgba(0, 0, 0, 0.6)"
        zIndex={0}
      />
      
      {/* Content */}
      <Box
        position="relative"
        zIndex={1}
        width="100%"
      >
        {children}
      </Box>
    </Box>
  );
};
