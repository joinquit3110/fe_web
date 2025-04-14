
import React from 'react';
import { Box, Container } from '@chakra-ui/react';

export const BackgroundWrapper = ({ children }) => {
  return (
    <Box
      className="hogwarts-app"
      minHeight="100vh"
      width="100%"
      position="relative"
      overflow="hidden"
      backgroundImage="url('/assets/images/hogwarts-bg.jpg')"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundAttachment="fixed"
    >
      {/* Improved overlay */}
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="rgba(14, 26, 64, 0.92)"
        backdropFilter="blur(3px)"
        zIndex={0}
      />
      
      {/* Optimized magical elements */}
      <Box className="floating-element wand" display={["none", "none", "block"]} />
      <Box className="floating-element spellbook" display={["none", "none", "block"]} />
      <Box className="floating-element potion" display={["none", "none", "block"]} />
      
      {/* Improved content container */}
      <Container
        maxW="container.xl"
        position="relative"
        zIndex={1}
        px={[4, 6, 8]}
        py={[6, 8, 10]}
        height="100%"
        display="flex"
        flexDirection="column"
      >
        {children}
      </Container>
    </Box>
  );
};
