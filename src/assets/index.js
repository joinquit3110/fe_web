// House images
export const HOUSE_IMAGES = {
  GRYFFINDOR: '/assets/images/Gryffindor.png',
  SLYTHERIN: '/assets/images/Slytherin.png',
  RAVENCLAW: '/assets/images/Ravenclaw.png',
  HUFFLEPUFF: '/assets/images/Hufflepuff.png',
  HOGWARTS: '/assets/images/hogwarts-bg.jpg',
  LOGO: '/assets/images/Hogwarts logo.png'
};

// Point images
export const POINT_IMAGES = {
  INCREASE: '/assets/images/IncreasePoint.png',
  DECREASE: '/assets/images/DecreasePoint.png'
};

// Preload configuration
export const PRELOAD_IMAGES = [
  ...Object.values(HOUSE_IMAGES),
  ...Object.values(POINT_IMAGES)
];