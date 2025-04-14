import React, { useState, useEffect, useRef } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import PropTypes from 'prop-types';

/**
 * VirtualList Component
 * 
 * A high-performance list component that only renders items that are visible in the viewport
 * - Significantly improves performance for long lists
 * - Reduces DOM size and memory usage
 * - Maintains smooth scrolling even with thousands of items
 * 
 * @param {Object} props - Component props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Function to render each item
 * @param {number} props.itemHeight - Height of each item in pixels
 * @param {number} props.height - Height of the virtual list container
 * @param {number} props.overscan - Number of items to render outside of view (buffer)
 * @param {Object} props.containerProps - Additional props for the container
 */
const VirtualList = ({
  items = [],
  renderItem,
  itemHeight = 50,
  height = 400,
  overscan = 3,
  containerStyle = {},
  containerClassName = '',
  onItemsInViewChange,
  ...rest
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleItems, setVisibleItems] = useState([]);
  
  // Calculate which items are currently visible
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Calculate the start and end indices of visible items
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + height) / itemHeight) + overscan
    );
    
    // Create an array of visible items with their positions
    const visibleItemsArray = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visibleItemsArray.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute',
          top: i * itemHeight,
          width: '100%',
          height: itemHeight
        }
      });
    }
    
    setVisibleItems(visibleItemsArray);
    
    // Call the callback with the indices of items in view
    if (onItemsInViewChange) {
      onItemsInViewChange({ startIndex, endIndex });
    }
  }, [scrollTop, items, itemHeight, height, overscan, onItemsInViewChange]);
  
  // Handle scroll events
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };
  
  return (
    <Box
      ref={containerRef}
      height={`${height}px`}
      overflowY="auto"
      position="relative"
      className={`virtual-list-container ${containerClassName}`}
      style={{
        scrollbarWidth: 'thin',
        ...containerStyle
      }}
      onScroll={handleScroll}
      {...rest}
    >
      {/* Spacer to ensure proper scrollbar size */}
      <Box height={`${items.length * itemHeight}px`} position="relative">
        {/* Only render items that are visible or within overscan */}
        {visibleItems.map(({ index, item, style }) => (
          <Box key={index} style={style}>
            {renderItem({ item, index })}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

VirtualList.propTypes = {
  items: PropTypes.array.isRequired,
  renderItem: PropTypes.func.isRequired,
  itemHeight: PropTypes.number,
  height: PropTypes.number,
  overscan: PropTypes.number,
  containerStyle: PropTypes.object,
  containerClassName: PropTypes.string,
  onItemsInViewChange: PropTypes.func
};

export default VirtualList;