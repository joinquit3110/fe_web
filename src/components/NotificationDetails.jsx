import React, { memo } from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';

// Helper function to standardize criteria text
const standardizeCriteria = (criteria) => {
  if (!criteria) return '';
  return criteria
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to standardize level text
const standardizeLevel = (level) => {
  if (!level) return '';
  return level
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Separate details component
const NotificationDetails = memo(({ notification }) => {
  // Log details for debugging
  console.log('[NOTIFICATION_DETAILS] Data:', {
    criteria: notification.criteria,
    level: notification.level,
    reason: notification.reason
  });
  
  // Check if we have criteria and level data
  const hasCriteria = notification.criteria && notification.criteria.trim() !== '';
  const hasLevel = notification.level && notification.level.trim() !== '';
  
  // Determine if this is a house assessment notification
  const isAssessment = hasCriteria || hasLevel;
  
  const hasReason = notification.reason && 
                    notification.reason !== 'System update' && 
                    notification.reason !== 'House points update' &&
                    notification.reason !== 'Point update';

  // If no details to show, don't render anything
  if (!hasReason && !isAssessment) return null;

  return (
    <Box 
      borderRadius="md"
      overflow="hidden"
      className="details-scroll"
      border="1px solid rgba(255,255,255,0.3)"
      boxShadow="0 5px 15px rgba(0,0,0,0.2)"
      mb={3}
    >
      {/* Reason section */}
      {hasReason && (
        <Box 
          p={4}
          borderBottom={isAssessment ? "1px solid rgba(255,255,255,0.2)" : "none"}
          bg="rgba(0,0,0,0.18)"
          position="relative"
          _hover={{bg: "rgba(0,0,0,0.25)"}}
          transition="all 0.2s"
        >
          <Flex alignItems="flex-start">
            <Box 
              width="32px" 
              height="32px" 
              borderRadius="50%" 
              bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
              border="2px solid rgba(255,255,255,0.4)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mr={3}
              mt="2px"
              boxShadow="0 2px 5px rgba(0,0,0,0.2)"
            >
              <Text fontSize="lg" fontWeight="bold" color="#f0c75e">📝</Text>
            </Box>
            <Box flex="1">
              <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Reason</Text>
              <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{notification.reason}</Text>
            </Box>
          </Flex>
        </Box>
      )}
      
      {/* Criteria section - Show if criteria exists */}
      {hasCriteria && (
        <Box 
          p={4}
          borderBottom={hasLevel ? "1px solid rgba(255,255,255,0.2)" : "none"}
          bg="rgba(0,0,0,0.15)"
          position="relative"
          _hover={{bg: "rgba(0,0,0,0.2)"}}
          transition="all 0.2s"
        >
          <Flex alignItems="flex-start">
            <Box 
              width="32px" 
              height="32px" 
              borderRadius="50%" 
              bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
              border="2px solid rgba(255,255,255,0.4)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mr={3}
              mt="2px"
              boxShadow="0 2px 5px rgba(0,0,0,0.2)"
            >
              <Text fontSize="lg" fontWeight="bold" color="#f0c75e">🎯</Text>
            </Box>
            <Box flex="1">
              <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Criteria</Text>
              <Text fontSize="md" fontWeight="medium" lineHeight="1.4">{standardizeCriteria(notification.criteria)}</Text>
            </Box>
          </Flex>
        </Box>
      )}
      
      {/* Level section - Show if level exists */}
      {hasLevel && (
        <Box 
          p={4}
          bg="rgba(0,0,0,0.2)"
          position="relative"
          _hover={{bg: "rgba(0,0,0,0.25)"}}
          transition="all 0.2s"
        >
          <Flex alignItems="flex-start">
            <Box 
              width="32px" 
              height="32px" 
              borderRadius="50%" 
              bg={notification.type === 'success' ? "rgba(46, 204, 113, 0.3)" : "rgba(231, 76, 60, 0.3)"} 
              border="2px solid rgba(255,255,255,0.4)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mr={3}
              mt="2px"
              boxShadow="0 2px 5px rgba(0,0,0,0.2)"
            >
              <Text fontSize="lg" fontWeight="bold" color="#f0c75e">📈</Text>
            </Box>
            <Box flex="1">
              <Text fontSize="sm" fontWeight="bold" mb="4px" letterSpacing="1px" textTransform="uppercase">Level</Text>
              <Text 
                fontSize="md" 
                fontWeight="medium" 
                lineHeight="1.4"
                p={2}
                bg={
                  notification.level.toLowerCase().includes('excellent') ? 'rgba(46, 204, 113, 0.2)' :
                  notification.level.toLowerCase().includes('good') ? 'rgba(52, 152, 219, 0.2)' :
                  notification.level.toLowerCase().includes('satisfactory') ? 'rgba(241, 196, 15, 0.2)' :
                  notification.level.toLowerCase().includes('poor') ? 'rgba(231, 76, 60, 0.2)' :
                  'rgba(0,0,0,0.1)'
                }
                borderRadius="md"
                display="inline-block"
              >
                {standardizeLevel(notification.level)}
              </Text>
            </Box>
          </Flex>
        </Box>
      )}
    </Box>
  );
});

export default NotificationDetails; 