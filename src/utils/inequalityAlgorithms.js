/**
 * Enhanced Inequality Algorithms
 * Contains optimized versions of all inequality-related functions
 */

// Hogwarts house colors with improved contrast
const THEME_COLORS = {
  primary: '#0E1A40',      // Ravenclaw Blue (Dark)
  secondary: '#D3A625',    // Gryffindor Gold
  accent1: '#740001',      // Gryffindor Red
  accent2: '#1A472A',      // Slytherin Green
  accent3: '#ECB939',      // Hufflepuff Yellow
  background: '#F5F5F5',   // Light background
  text: '#333333',         // Dark text
  error: '#FF3B30',        // Error red
  success: '#34C759',      // Success green
  warning: '#FFCC00'       // Warning yellow
};

// House-themed inequality colors
const INEQUALITY_COLORS = [
  '#740001', // Gryffindor Red
  '#D3A625', // Gryffindor Gold
  '#1A472A', // Slytherin Green
  '#5D5D5D', // Slytherin Silver (darker for better contrast)
  '#0E1A40', // Ravenclaw Blue
  '#946B2D', // Ravenclaw Bronze
  '#ECB939', // Hufflepuff Yellow
  '#372E29'  // Hufflepuff Black
];

// Track used colors to avoid repeats
let usedColors = [];

// Counter for sequential inequality labels
let nextLabelNumber = 1;

// Constants
const EPSILON = 1e-9;

/**
 * Reset the label counter for inequalities
 */
export const resetLabelCounter = () => {
  nextLabelNumber = 1;
};

/**
 * Get the next sequential label for inequalities
 * @returns {string} LaTeX formatted label
 */
export const getNextLabel = () => {
  return `d_{${nextLabelNumber++}}`;
};

/**
 * Parse an inequality string input into a standardized object
 * @param {string} input - The inequality string to parse
 * @returns {Object|null} - Parsed inequality object or null if invalid
 */
export const parseInequality = (input) => {
  if (!input || typeof input !== 'string') return null;

  // Normalize input: remove spaces, fix double operators
  input = input.replace(/\s+/g, '')
               .replace(/\-\-/g, '+')
               .replace(/\+\-/g, '-')
               .replace(/\-\+/g, '-');

  // Support unicode inequality symbols
  input = input.replace(/≤/g, '<=')
               .replace(/≥/g, '>=')
               .replace(/≠/g, '!=');

  // Try parsing standard form: ax + by + c operator 0
  let result = parseStandardForm(input);
  if (result) return result;
  
  // Try parsing single variable case: ax + c operator 0 or by + c operator 0
  result = parseSingleVariableForm(input);
  if (result) return result;
  
  // Try parsing slope-intercept form: y = mx + b
  result = parseSlopeInterceptForm(input);
  if (result) return result;
  
  return null;
};

/**
 * Parse standard form inequality: ax + by + c operator 0
 * @param {string} input - Inequality string
 * @returns {Object|null} - Parsed inequality or null
 */
function parseStandardForm(input) {
  const regex = /^(-?\d*\.?\d*)?x\s*([+-]\s*\d*\.?\d*)?y\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?|!=|=)\s*0$/;
  const match = input.match(regex);
  
  if (!match) return null;
  
  let [, a = '1', b = '0', c = '0', operator] = match;
  
  // Parse coefficients carefully
  a = a === '-' ? -1 : a === '' ? 1 : parseFloat(a);
  b = b ? (b === '+' ? 1 : b === '-' ? -1 : parseFloat(b.replace(/[+\s]/g, ''))) : 0;
  c = c ? parseFloat(c.replace(/[+\s]/g, '')) : 0;

  // Build LaTeX representation
  const latex = buildStandardFormLatex(a, b, c, operator);

  return createInequalityObject(a, b, c, operator, latex);
}

/**
 * Parse single variable form: ax + c operator 0 or by + c operator 0
 * @param {string} input - Inequality string
 * @returns {Object|null} - Parsed inequality or null
 */
function parseSingleVariableForm(input) {
  const regex = /^(-?\d*\.?\d*)?([xy])\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?|!=|=)\s*0$/;
  const match = input.match(regex);
  
  if (!match) return null;
  
  let [, coef = '1', variable, c = '0', operator] = match;
  
  // Handle edge cases
  coef = coef === '-' ? -1 : coef === '' ? 1 : parseFloat(coef);
  c = c ? parseFloat(c.replace(/[+\s]/g, '')) : 0;
  
  // Build coefficient values
  const a = variable === 'x' ? coef : 0;
  const b = variable === 'y' ? coef : 0;
  
  // Build LaTeX representation
  const latex = buildSingleVariableLatex(coef, variable, c, operator);

  return createInequalityObject(a, b, c, operator, latex);
}

/**
 * Parse slope-intercept form: y = mx + b
 * @param {string} input - Inequality string
 * @returns {Object|null} - Parsed inequality or null
 */
function parseSlopeInterceptForm(input) {
  const regex = /^y\s*=\s*(-?\d*\.?\d*)?x\s*([+-]\s*\d*\.?\d*)?$/;
  const match = input.match(regex);
  
  if (!match) return null;
  
  let [, m = '1', b = '0'] = match;
  
  // Convert to standard form
  m = m === '-' ? -1 : m === '' ? 1 : parseFloat(m);
  b = b ? parseFloat(b.replace(/[+\s]/g, '')) : 0;
  
  // Standard form: -mx + y - b = 0
  const a = -m;
  const c = -b;
  
  // Build LaTeX representation
  const latex = buildSlopeInterceptLatex(m, b);

  return createInequalityObject(a, 1, c, '=', latex);
}

/**
 * Build and return a complete inequality object
 * @param {number} a - x coefficient
 * @param {number} b - y coefficient
 * @param {number} c - constant term
 * @param {string} operator - inequality operator
 * @param {string} latex - LaTeX representation
 * @returns {Object} - Complete inequality object
 */
function createInequalityObject(a, b, c, operator, latex) {
  return {
    a,
    b,
    c,
    operator,
    latex,
    label: getNextLabel(),
    color: getNextColor(),
    solved: true,
    editable: true
  };
}

/**
 * Build LaTeX for standard form inequality
 * @param {number} a - x coefficient
 * @param {number} b - y coefficient
 * @param {number} c - constant term
 * @param {string} operator - inequality operator
 * @returns {string} - LaTeX string
 */
function buildStandardFormLatex(a, b, c, operator) {
  const terms = [];
  
  // Add x term if non-zero
  if (Math.abs(a) > EPSILON) {
    terms.push(Math.abs(a) === 1 ? `${a < 0 ? '-' : ''}x` : `${a}x`);
  }
  
  // Add y term if non-zero
  if (Math.abs(b) > EPSILON) {
    terms.push(Math.abs(b) === 1 ? `${b < 0 ? '-' : '+'}y` : `${b > 0 ? '+' : '-'}${Math.abs(b)}y`);
  }
  
  // Add constant term if non-zero
  if (Math.abs(c) > EPSILON) {
    terms.push(`${c > 0 ? '+' : '-'} ${Math.abs(c)}`);
  }

  // Format the left side
  let leftSide = terms.join(' ').trim();
  
  // Remove leading plus if exists
  if (leftSide.startsWith('+')) {
    leftSide = leftSide.substring(1).trim();
  }
  
  // If empty, it's just 0
  if (leftSide.length === 0) {
    leftSide = '0';
  }
  
  // Add operator with proper LaTeX symbols
  return `${leftSide} ${getLatexOperator(operator)} 0`;
}

/**
 * Build LaTeX for single variable inequality
 * @param {number} coef - coefficient
 * @param {string} variable - variable ('x' or 'y')
 * @param {number} c - constant term
 * @param {string} operator - inequality operator
 * @returns {string} - LaTeX string
 */
function buildSingleVariableLatex(coef, variable, c, operator) {
  let latex = '';
  
  // Add variable term
  if (Math.abs(coef) === 1) {
    latex = `${coef < 0 ? '-' : ''}${variable}`;
  } else {
    latex = `${coef}${variable}`;
  }
  
  // Add constant term if non-zero
  if (Math.abs(c) > EPSILON) {
    latex += ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
  }
  
  // Add operator
  latex += ` ${getLatexOperator(operator)} 0`;
  
  return latex;
}

/**
 * Build LaTeX for slope-intercept form
 * @param {number} m - slope
 * @param {number} b - y-intercept
 * @returns {string} - LaTeX string
 */
function buildSlopeInterceptLatex(m, b) {
  let latex = 'y = ';
  
  // Add slope term
  if (Math.abs(m) === 1) {
    latex += `${m < 0 ? '-' : ''}x`;
  } else {
    latex += `${m}x`;
  }
  
  // Add intercept if non-zero
  if (Math.abs(b) > EPSILON) {
    latex += ` ${b > 0 ? '+' : '-'} ${Math.abs(b)}`;
  }
  
  return latex;
}

/**
 * Convert operator to LaTeX representation
 * @param {string} operator - Inequality operator
 * @returns {string} - LaTeX operator
 */
function getLatexOperator(operator) {
  switch(operator) {
    case '<=': return '\\leq';
    case '>=': return '\\geq';
    case '!=': return '\\neq';
    case '=': return '=';
    default: return operator;
  }
}

/**
 * Get the next color for a new inequality
 * @returns {string} - Hex color code
 */
function getNextColor() {
  // Reset if all colors are used
  if (usedColors.length >= INEQUALITY_COLORS.length) {
    usedColors = [];
  }
  
  // Find an unused color
  let availableColors = INEQUALITY_COLORS.filter(color => !usedColors.includes(color));
  if (availableColors.length === 0) {
    usedColors = [];
    availableColors = [...INEQUALITY_COLORS];
  }
  
  // Pick a random color from available ones
  const randomIndex = Math.floor(Math.random() * availableColors.length);
  const selectedColor = availableColors[randomIndex];
  
  // Remember this color has been used
  usedColors.push(selectedColor);
  
  return selectedColor;
}

/**
 * Calculate the value of equation at a point
 * @param {Object} eq - Inequality object
 * @param {Object} point - Point {x, y}
 * @returns {number} - Value at point
 */
export const calculateValueAtPoint = (eq, point) => {
  if (!eq || !point) return null;
  return eq.a * point.x + eq.b * point.y + eq.c;
};

/**
 * Check if a point satisfies an inequality
 * @param {Object} eq - Inequality object
 * @param {Object} point - Point {x, y}
 * @returns {boolean} - True if the point satisfies the inequality
 */
export const checkPointInInequality = (eq, point) => {
  if (!eq || !point) return false;
  
  const val = calculateValueAtPoint(eq, point);
  
  // For points exactly on the boundary line (within small epsilon)
  if (Math.abs(val) < EPSILON) {
    // For strict inequalities (<, >), points on the line are NOT part of the solution
    if (eq.operator === '<' || eq.operator === '>') {
      return false;
    }
    // For non-strict inequalities (<=, >=, =), points on the line ARE part of the solution
    return true;
  }
  
  // For normal values:
  switch (eq.operator) {
    case '<':
    case '<=':
      return val < 0;
    case '>':
    case '>=':
      return val > 0;
    case '=':
      return false; // Points not exactly on the line are not solutions for equality
    default:
      return val !== 0; // For !=
  }
};

/**
 * Check if a point is on the boundary of an inequality
 * @param {Object} eq - Inequality object
 * @param {Object} point - Point {x, y}
 * @returns {boolean} - True if point is on boundary
 */
export const isPointOnBoundary = (eq, point) => {
  if (!eq || !point) return false;
  return Math.abs(calculateValueAtPoint(eq, point)) < EPSILON;
};

/**
 * Get two boundary points for an inequality (for drawing)
 * @param {Object} eq - Inequality object
 * @param {number} bounds - How far to extend the line
 * @returns {Array} - Array of two points to draw the line through
 */
export const getBoundaryPoints = (eq, bounds = 10000) => {
  if (!eq) return null;
  
  // Handle vertical line (x = constant)
  if (Math.abs(eq.b) < EPSILON) {
    const x = -eq.c / eq.a;
    return [{ x, y: -bounds }, { x, y: bounds }];
  }
  
  // Handle horizontal line (y = constant)
  if (Math.abs(eq.a) < EPSILON) {
    const y = -eq.c / eq.b;
    return [{ x: -bounds, y }, { x: bounds, y }];
  }
  
  // General case: y = -(ax+c)/b
  return [
    { x: -bounds, y: -(eq.c + eq.a * (-bounds)) / eq.b },
    { x: bounds, y: -(eq.c + eq.a * bounds) / eq.b }
  ];
};

/**
 * Calculate the intersection point of two inequalities
 * @param {Object} eq1 - First inequality
 * @param {Object} eq2 - Second inequality
 * @returns {Object|null} - Intersection point {x, y} or null if parallel
 */
export const calculateIntersection = (eq1, eq2) => {
  if (!eq1 || !eq2) return null;
  
  const det = eq1.a * eq2.b - eq2.a * eq1.b;
  if (Math.abs(det) < EPSILON) return null; // Lines are parallel
  
  const x = (eq1.c * eq2.b - eq2.c * eq1.b) / -det;
  const y = (eq1.a * eq2.c - eq2.a * eq1.c) / det;
  
  return { x, y };
};

/**
 * Get the direction vector for filling a half-plane
 * @param {Object} eq - Inequality object
 * @returns {Object} - Direction vector {x, y}
 */
export const getHalfPlaneFillDirection = (eq) => {
  if (!eq) return null;
  
  const [p1, p2] = getBoundaryPoints(eq);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  // Unit normal vector to the line
  const nx = -dy / length;
  const ny = dx / length;
  
  // Test point offset by normal vector
  const testPoint = { 
    x: (p1.x + p2.x) / 2 + nx, 
    y: (p1.y + p2.y) / 2 + ny 
  };
  
  // Check if the test point satisfies the inequality
  const satisfies = checkPointInInequality(eq, testPoint);
  
  // The fill direction is:
  //  - in the direction of the normal if the test point satisfies the inequality
  //  - in the opposite direction if it doesn't
  return { 
    x: satisfies ? nx : -nx, 
    y: satisfies ? ny : -ny 
  };
};

// Export theme colors for consistent styling
export const themeColors = THEME_COLORS; 