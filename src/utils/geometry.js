/**
 * Calculate the intersection point of two lines
 * @param {Object} line1 - First line {a, b, c} in form ax + by + c = 0
 * @param {Object} line2 - Second line {a, b, c} in form ax + by + c = 0
 * @returns {Object|null} Intersection point {x, y} or null if lines are parallel
 */
export const computeIntersection = (line1, line2) => {
  const { a: a1, b: b1, c: c1 } = line1;
  const { a: a2, b: b2, c: c2 } = line2;

  // Check if lines are parallel
  const determinant = a1 * b2 - a2 * b1;
  if (Math.abs(determinant) < 1e-10) {
    return null; // Lines are parallel or coincident
  }

  // Calculate intersection point
  const x = (b1 * c2 - b2 * c1) / determinant;
  const y = (a2 * c1 - a1 * c2) / determinant;

  return { x, y };
};

/**
 * Check if a point is in a half-plane defined by an inequality
 * @param {Object} point - Point {x, y}
 * @param {Object} inequality - Inequality {a, b, c, operator}
 * @returns {boolean} True if point is in the solution region
 */
export const isPointInRegion = (point, inequality) => {
  const { a, b, c, operator } = inequality;
  const value = a * point.x + b * point.y + c;

  switch (operator) {
    case '<': return value < 0;
    case '<=': return value <= 0;
    case '>': return value > 0;
    case '>=': return value >= 0;
    default: return false;
  }
};

/**
 * Find all valid intersection points of inequalities
 * @param {Array} inequalities - Array of inequality objects
 * @returns {Array} Array of valid intersection points
 */
export const findValidIntersections = (inequalities) => {
  const points = [];
  const n = inequalities.length;

  // Check all pairs of inequalities
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const point = computeIntersection(inequalities[i], inequalities[j]);
      
      if (point) {
        // Check if point satisfies all other inequalities
        const isValid = inequalities.every((ineq, index) => 
          index === i || index === j || isPointInRegion(point, ineq)
        );

        if (isValid) {
          points.push(point);
        }
      }
    }
  }

  return points;
};

/**
 * Calculate the distance between two points
 * @param {Object} p1 - First point {x, y}
 * @param {Object} p2 - Second point {x, y}
 * @returns {number} Distance between points
 */
export const distance = (p1, p2) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Find the closest point to a given point
 * @param {Object} point - Reference point {x, y}
 * @param {Array} points - Array of points to check
 * @returns {Object} Closest point and its distance
 */
export const findClosestPoint = (point, points) => {
  let closest = null;
  let minDist = Infinity;

  for (const p of points) {
    const dist = distance(point, p);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  }

  return { point: closest, distance: minDist };
};

/**
 * Convert canvas coordinates to world coordinates
 * @param {Object} canvasPoint - Point in canvas coordinates {x, y}
 * @param {Object} config - Canvas configuration
 * @param {number} zoom - Current zoom level
 * @returns {Object} Point in world coordinates
 */
export const canvasToWorld = (canvasPoint, config, zoom) => {
  const { width, height } = config;
  const centerX = width / 2;
  const centerY = height / 2;
  const scaledGridSize = config.gridSize * zoom;

  return {
    x: (canvasPoint.x - centerX) / scaledGridSize,
    y: -(canvasPoint.y - centerY) / scaledGridSize
  };
};

/**
 * Convert world coordinates to canvas coordinates
 * @param {Object} worldPoint - Point in world coordinates {x, y}
 * @param {Object} config - Canvas configuration
 * @param {number} zoom - Current zoom level
 * @returns {Object} Point in canvas coordinates
 */
export const worldToCanvas = (worldPoint, config, zoom) => {
  const { width, height } = config;
  const centerX = width / 2;
  const centerY = height / 2;
  const scaledGridSize = config.gridSize * zoom;

  return {
    x: centerX + worldPoint.x * scaledGridSize,
    y: centerY - worldPoint.y * scaledGridSize
  };
};
