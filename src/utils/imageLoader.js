const imageLoader = {
  loadImage: (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      
      img.src = src;
    });
  },

  preloadImages: async (images) => {
    try {
      const promises = images.map(src => imageLoader.loadImage(src));
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Failed to preload images:', error);
      return false;
    }
  }
};

export default imageLoader;