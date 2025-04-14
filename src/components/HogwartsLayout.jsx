import React from 'react';
import { Box, Flex, useBreakpointValue } from '@chakra-ui/react';
import PropTypes from 'prop-types';

/**
 * HogwartsLayout - A specialized responsive layout component for the Harry Potter themed app
 * This component provides a responsive grid layout with appropriate styling for the Hogwarts theme
 */
const HogwartsLayout = ({ children, contentType = 'default' }) => {
  // Use Chakra's breakpoint system to detect viewport size
  const isMobile = useBreakpointValue({ base: true, md: false });
  const isTablet = useBreakpointValue({ base: false, md: true, lg: false });
  const isDesktop = useBreakpointValue({ base: false, md: false, lg: true });
  
  // Define grid templates based on content type and screen size
  const getGridTemplate = () => {
    // For activity pages with coordinate plane and inequality list
    if (contentType === 'activity') {
      return {
        // Mobile: Stack everything vertically
        base: {
          columns: '1fr',
          areas: `"control"
                  "message"
                  "coordinate"
                  "inequalities"`,
          gap: 3
        },
        // Tablet: Side-by-side with inequalities at bottom
        md: {
          columns: 'minmax(300px, 1fr) minmax(400px, 2fr)',
          areas: `"control coordinate"
                  "message coordinate"
                  "inequalities inequalities"`,
          gap: 4
        },
        // Desktop: Three-column layout
        lg: {
          columns: 'minmax(300px, 1fr) minmax(500px, 2fr) minmax(300px, 1fr)',
          areas: `"control coordinate inequalities"
                  "message coordinate inequalities"`,
          gap: 5
        }
      };
    }
    
    // Default layout for other content
    return {
      base: {
        columns: '1fr',
        areas: `"main"`,
        gap: 3
      },
      md: {
        columns: '1fr 1fr',
        areas: `"main main"`,
        gap: 4
      },
      lg: {
        columns: '1fr 1fr 1fr',
        areas: `"main main main"`,
        gap: 5
      }
    };
  };
  
  const gridTemplate = getGridTemplate();
  
  return (
    <Box
      className="hogwarts-layout"
      width="100%"
      maxWidth="1400px"
      margin="0 auto"
      px={{ base: 2, md: 4, lg: 5 }}
      position="relative"
      zIndex={1}
    >
      {/* This layout uses CSS Grid for optimal responsive behavior */}
      <Box
        display="grid"
        gridTemplateColumns={isMobile ? gridTemplate.base.columns : (isTablet ? gridTemplate.md.columns : gridTemplate.lg.columns)}
        gridTemplateAreas={isMobile ? gridTemplate.base.areas : (isTablet ? gridTemplate.md.areas : gridTemplate.lg.areas)}
        gap={isMobile ? gridTemplate.base.gap : (isTablet ? gridTemplate.md.gap : gridTemplate.lg.gap)}
        w="100%"
        className="hogwarts-content hardware-accelerated"
      >
        {children}
      </Box>
    </Box>
  );
};

HogwartsLayout.propTypes = {
  children: PropTypes.node.isRequired,
  contentType: PropTypes.oneOf(['default', 'activity', 'admin'])
};

/**
 * GridArea - Component that places its children in a specific grid area
 */
export const GridArea = ({ children, area, className, ...rest }) => {
  return (
    <Box
      gridArea={area}
      className={`hogwarts-area ${className || ''}`}
      {...rest}
    >
      {children}
    </Box>
  );
};

GridArea.propTypes = {
  children: PropTypes.node.isRequired,
  area: PropTypes.string.isRequired,
  className: PropTypes.string
};

export default HogwartsLayout;