import React from 'react';
import { Box, Spinner, Text } from '@chakra-ui/react';

const LoadingIndicator = ({ message = 'Loading...' }) => (
  <Box
    position="fixed"
    top="50%"
    left="50%"
    transform="translate(-50%, -50%)"
    zIndex="9999"
    textAlign="center"
    className="loading-indicator"
  >
    <Spinner
      thickness="4px"
      speed="0.65s"
      emptyColor="gray.200"
      color="var(--secondary-color)"
      size="xl"
    />
    <Text
      mt="3"
      fontSize="var(--font-size-md)"
      color="var(--text-color)"
    >
      {message}
    </Text>
  </Box>
);

export default React.memo(LoadingIndicator);