import React from 'react';
import { Box, Flex, SimpleGrid } from '@chakra-ui/react';
import PropTypes from 'prop-types';

/**
 * ResponsiveLayout Component
 * 
 * A flexible, responsive layout component that adapts to different screen sizes.
 * Can be used for various layout patterns including:
 * - Single column on mobile
 * - Two or three columns on tablet and desktop
 * - Custom grid layouts with auto-fit
 */
const ResponsiveLayout = ({
  children,
  variant = 'default', // default, sidebar, cards, grid
  columns = { base: 1, md: 2, lg: 3 },
  spacing = { base: 4, md: 6, lg: 8 },
  minChildWidth, // For auto-fit grid
  className = '',
  containerProps = {},
  ...rest
}) => {
  // Different layout patterns
  const getLayoutComponent = () => {
    switch (variant) {
      case 'sidebar':
        // Layout with sidebar
        return (
          <Flex
            direction={{ base: 'column', md: 'row' }}
            gap={spacing}
            className={`responsive-layout sidebar-layout ${className}`}
            {...containerProps}
            {...rest}
          >
            {children}
          </Flex>
        );
        
      case 'cards':
        // Card layout with automatic wrapping
        return (
          <Flex
            wrap="wrap"
            justify="center"
            gap={spacing}
            className={`responsive-layout cards-layout ${className}`}
            {...containerProps}
            {...rest}
          >
            {children}
          </Flex>
        );
        
      case 'grid':
        // Auto-fit grid layout
        return (
          <SimpleGrid
            columns={columns}
            spacing={spacing}
            minChildWidth={minChildWidth}
            className={`responsive-layout grid-layout ${className}`}
            {...containerProps}
            {...rest}
          >
            {children}
          </SimpleGrid>
        );
        
      default:
        // Basic column layout
        return (
          <SimpleGrid
            columns={columns}
            spacing={spacing}
            className={`responsive-layout default-layout ${className}`}
            {...containerProps}
            {...rest}
          >
            {children}
          </SimpleGrid>
        );
    }
  };
  
  return getLayoutComponent();
};

// Child components for different layout types
export const Sidebar = ({ children, width = { base: '100%', md: '280px', lg: '320px' }, ...rest }) => (
  <Box
    width={width}
    flexShrink={0}
    className="sidebar-container"
    {...rest}
  >
    {children}
  </Box>
);

export const Content = ({ children, ...rest }) => (
  <Box
    flex="1"
    className="content-container"
    {...rest}
  >
    {children}
  </Box>
);

export const Card = ({ children, width = { base: '100%', sm: '45%', md: '30%', lg: '22%' }, ...rest }) => (
  <Box
    width={width}
    className="card-container"
    {...rest}
  >
    {children}
  </Box>
);

// PropTypes
ResponsiveLayout.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['default', 'sidebar', 'cards', 'grid']),
  columns: PropTypes.oneOfType([PropTypes.object, PropTypes.number]),
  spacing: PropTypes.oneOfType([PropTypes.object, PropTypes.number]),
  minChildWidth: PropTypes.string,
  className: PropTypes.string,
  containerProps: PropTypes.object
};

Sidebar.propTypes = {
  children: PropTypes.node.isRequired,
  width: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
};

Content.propTypes = {
  children: PropTypes.node.isRequired
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  width: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
};

export default ResponsiveLayout;