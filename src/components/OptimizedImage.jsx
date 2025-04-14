import React, { useState, useEffect } from 'react';
import { Box, Skeleton } from '@chakra-ui/react';
import PropTypes from 'prop-types';

/**
 * OptimizedImage Component
 * 
 * A modern image component with built-in performance optimizations:
 * - Lazy loading for improved page load performance
 * - WebP format detection and fallback
 * - Responsive image loading with srcset
 * - Blur-up loading effect
 * - Built-in error handling
 * 
 * @param {Object} props - Component props
 * @param {string} props.src - Primary image source
 * @param {string} props.webpSrc - WebP version of the image (optional)
 * @param {string} props.alt - Alt text for the image
 * @param {Object} props.sizes - Responsive sizes configuration
 * @param {string} props.fallbackSrc - Fallback image if main image fails to load
 * @param {string} props.placeholderColor - Background color while loading
 * @param {Object} props.imgProps - Additional props for the img element
 */
const OptimizedImage = ({
  src,
  webpSrc,
  alt,
  sizes = {
    sm: { w: '100%' },
    md: { w: '100%' },
    lg: { w: '100%' }
  },
  fallbackSrc = '',
  placeholderColor = 'rgba(14, 26, 64, 0.3)',
  objectFit = 'cover',
  aspectRatio,
  imgProps = {},
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [supportsWebP, setSupportsWebP] = useState(false);
  
  // Detect WebP support
  useEffect(() => {
    const checkWebPSupport = async () => {
      try {
        const webPCheck = document.createElement('canvas').toDataURL('image/webp');
        setSupportsWebP(webPCheck.startsWith('data:image/webp'));
      } catch (e) {
        setSupportsWebP(false);
      }
    };
    
    checkWebPSupport();
  }, []);
  
  // Generate srcset for responsive images
  const generateSrcSet = (imageSrc) => {
    if (!imageSrc) return '';
    
    // Extract the file name and extension
    const lastDotIndex = imageSrc.lastIndexOf('.');
    if (lastDotIndex === -1) return imageSrc;
    
    const basePath = imageSrc.substring(0, lastDotIndex);
    const extension = imageSrc.substring(lastDotIndex);
    
    // Generate srcset with different sizes
    return `${basePath}-600w${extension} 600w, 
            ${basePath}-900w${extension} 900w,
            ${basePath}-1200w${extension} 1200w,
            ${imageSrc} 1800w`;
  };
  
  const handleLoad = () => {
    setIsLoaded(true);
  };
  
  const handleError = () => {
    setError(true);
    if (fallbackSrc) {
      console.warn(`Image failed to load: ${src}. Using fallback.`);
    } else {
      console.error(`Image failed to load: ${src}. No fallback provided.`);
    }
  };
  
  // Determine the best image source
  const bestSrc = error ? fallbackSrc : (supportsWebP && webpSrc ? webpSrc : src);
  const srcSet = generateSrcSet(bestSrc);
  
  return (
    <Box
      position="relative"
      overflow="hidden"
      {...(aspectRatio && {
        _before: {
          content: '""',
          display: 'block',
          paddingTop: aspectRatio
        }
      })}
      {...rest}
    >
      {!isLoaded && (
        <Skeleton 
          position={aspectRatio ? 'absolute' : 'relative'}
          top="0"
          left="0"
          width="100%"
          height={aspectRatio ? '100%' : '100%'}
          startColor={placeholderColor}
          endColor="rgba(14, 26, 64, 0.5)"
          className="optimize-gpu"
        />
      )}
      
      <img
        src={bestSrc}
        srcSet={srcSet}
        sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: aspectRatio ? '100%' : 'auto',
          objectFit,
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
          position: aspectRatio ? 'absolute' : 'relative',
          top: 0,
          left: 0
        }}
        {...imgProps}
      />
    </Box>
  );
};

OptimizedImage.propTypes = {
  src: PropTypes.string.isRequired,
  webpSrc: PropTypes.string,
  alt: PropTypes.string.isRequired,
  sizes: PropTypes.object,
  fallbackSrc: PropTypes.string,
  placeholderColor: PropTypes.string,
  objectFit: PropTypes.string,
  aspectRatio: PropTypes.string,
  imgProps: PropTypes.object
};

export default OptimizedImage;