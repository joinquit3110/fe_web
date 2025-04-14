import React, { useState, useEffect } from 'react';
import { Box, Flex, Button, Slide, useDisclosure } from '@chakra-ui/react';

const MobileMenu = ({ user, onLogout }) => {
  const { isOpen, onToggle } = useDisclosure();
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Swipe handling
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      onToggle(); // Close menu on swipe left
    }
  };

  // Close menu on route change
  useEffect(() => {
    return () => {
      if (isOpen) onToggle();
    };
  }, [location]);

  return (
    <>
      <Button
        display={{ base: 'block', md: 'none' }}
        position="fixed"
        top="1rem"
        right="1rem"
        zIndex="1000"
        onClick={onToggle}
        className="interactive-element"
      >
        <span className="menu-icon"></span>
      </Button>

      <Slide
        direction="right"
        in={isOpen}
        style={{ zIndex: 999 }}
      >
        <Box
          position="fixed"
          top="0"
          right="0"
          height="100vh"
          width="80vw"
          maxWidth="300px"
          bg="rgba(14, 26, 64, 0.95)"
          backdropFilter="blur(10px)"
          boxShadow="-4px 0 15px rgba(0, 0, 0, 0.3)"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          transition="transform 0.2s ease-out"
        >
          <Flex
            direction="column"
            height="100%"
            padding="4"
            spacing="4"
          >
            {/* Menu content */}
          </Flex>
        </Box>
      </Slide>
    </>
  );
};

export default React.memo(MobileMenu);