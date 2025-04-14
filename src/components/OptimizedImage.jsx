import React, { useState, useEffect } from 'react';
import { Box, Skeleton } from '@chakra-ui/react';

const OptimizedImage = ({ src, alt, width, height, ...props }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImageSrc(src);
      setLoading(false);
    };
    
    img.onerror = () => {
      setError(true);
      setLoading(false);
    };
  }, [src]);

  if (loading) {
    return <Skeleton width={width} height={height} />;
  }

  if (error) {
    return (
      <Box
        width={width}
        height={height}
        bg="gray.200"
        display="flex"
        alignItems="center"
        justifyContent="center"
        {...props}
      >
        Image not found
      </Box>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      style={{
        objectFit: 'cover',
        ...props.style
      }}
      {...props}
    />
  );
};

export default React.memo(OptimizedImage);