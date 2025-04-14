
import React, { memo } from 'react';
import { Box, Container } from '@chakra-ui/react';

const BackgroundWrapper = memo(({ children }) => {
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
      sx={{
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bg: 'rgba(14, 26, 64, 0.92)',
          backdropFilter: 'blur(3px)',
          zIndex: 0,
          transition: 'all 0.3s ease',
        }
      }}
    >
      <Container
        maxW="container.xl"
        position="relative"
        zIndex={1}
        px={{ base: 4, md: 6, lg: 8 }}
        py={{ base: 6, md: 8, lg: 10 }}
        height="100%"
        display="flex"
        flexDirection="column"
      >
        {children}
      </Container>
    </Box>
  );
});

BackgroundWrapper.displayName = 'BackgroundWrapper';

export default BackgroundWrapper;
