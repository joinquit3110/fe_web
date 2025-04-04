// Array of colors for inequalities
const COLORS = [
  '#4e31aa', '#2c3e50', '#e74c3c', '#27ae60', 
  '#f39c12', '#8e44ad', '#16a085', '#d35400', 
  '#2980b9', '#c0392b', '#1abc9c', '#f1c40f'
];

// Track used colors to avoid duplicates
let colorIndex = 0;

/**
 * Process an inequality string into a structured object
 * @param {string} input - The inequality string (e.g., "2x + 3y < 6")
 * @returns {object} Processed inequality object with coefficients, operator, and LaTeX
 */
export const processInequality = (input) => {
  try {
    // Normalize the input
    let normalizedInput = input.trim()
      .replace(/\s+/g, '')
      .replace(/\-\-/g, '+')
      .replace(/\+\-/g, '-')
      .replace(/\-\+/g, '-');
    
    // Try to match pattern: x + 1 > 0
    const simplePattern = /^([+-]?\d*\.?\d*)?x([+-]\d*\.?\d*)?([<>]=?|=)([+-]?\d*\.?\d*)$/;
    let match = normalizedInput.match(simplePattern);
    
    if (match) {
      // Extract coefficients and operator from match
      const [, aStr = '1', bStr = '0', op, rightSide] = match;
      
      // Parse coefficients
      let a = parseCoefficient(aStr, 'x');
      let b = parseCoefficient(bStr);
      let c = -parseFloat(rightSide) || 0; // Move to left side
      
      // Get the appropriate operator
      const operator = getOperator(op);
      
      // Generate LaTeX representation
      const latex = generateLatex(a, b, c, operator);
      
      // Get a color for this inequality
      const color = getNextColor();
      
      // Return the processed inequality
      return {
        a,
        b,
        c,
        operator,
        latex,
        color,
        id: generateId()
      };
    }
    
    // Try single variable pattern x [op] c
    const singleVarPattern = /^([+-]?\d*\.?\d*)?x([<>]=?|=)([+-]?\d*\.?\d*)$/;
    match = normalizedInput.match(singleVarPattern);
    
    if (match) {
      const [, coeffStr = '1', op, rightSide] = match;
      
      // Parse coefficient
      let a = parseCoefficient(coeffStr, 'x');
      let c = -parseFloat(rightSide) || 0; // Move to left side
      
      // Get the appropriate operator
      const operator = getOperator(op);
      
      // Generate LaTeX representation
      const latex = generateLatex(a, 0, c, operator);
      
      // Get a color for this inequality
      const color = getNextColor();
      
      // Return the processed inequality
      return {
        a,
        b: 0,
        c,
        operator,
        latex,
        color,
        id: generateId()
      };
    }
    
    // If no patterns match, return null
    return null;
  } catch (error) {
    console.error("Error processing inequality:", error);
    return null;
  }
};

/**
 * Parse a coefficient from a string
 * @param {string} str - The coefficient string
 * @param {string} variable - Optional variable name for special handling
 * @returns {number} The parsed coefficient
 */
function parseCoefficient(str, variable = '') {
  if (!str) return 0;
  
  // Handle special cases
  if (str === '+') return 1;
  if (str === '-') return -1;
  
  // Remove the variable if present
  if (variable) {
    str = str.replace(new RegExp(variable, 'g'), '');
  }
  
  // Handle coefficients like "+", "-"
  if (str === '+') return 1;
  if (str === '-') return -1;
  if (str === '') return 1;
  
  // Parse the numerical value
  return parseFloat(str);
}

/**
 * Convert a comparison operator to a standardized form
 * @param {string} op - The operator string
 * @returns {string} Standardized operator
 */
function getOperator(op) {
  switch (op) {
    case '<': return '<';
    case '>': return '>';
    case '<=': return '<=';
    case '>=': return '>=';
    case '=': return '=';
    default: return '=';
  }
}

/**
 * Generate a LaTeX representation of the inequality
 * @param {number} a - Coefficient of x
 * @param {number} b - Coefficient of y
 * @param {number} c - Constant term
 * @param {string} operator - Comparison operator
 * @returns {string} LaTeX string
 */
function generateLatex(a, b, c, operator) {
  const terms = [];
  
  // Add x term if present
  if (Math.abs(a) > 1e-9) {
    if (Math.abs(a) === 1) {
      terms.push(a < 0 ? "-x" : "x");
    } else {
      terms.push(`${a}x`);
    }
  }
  
  // Add y term if present
  if (Math.abs(b) > 1e-9) {
    if (Math.abs(b) === 1) {
      terms.push(b < 0 ? "-y" : (terms.length > 0 ? "+y" : "y"));
    } else {
      terms.push(b < 0 ? `${b}y` : (terms.length > 0 ? `+${b}y` : `${b}y`));
    }
  }
  
  // Add constant term if present
  if (Math.abs(c) > 1e-9 || terms.length === 0) {
    terms.push(c < 0 ? `${c}` : (terms.length > 0 ? `+${c}` : `${c}`));
  }
  
  // Join terms and add operator
  return `${terms.join('')} ${operator} 0`;
}

/**
 * Get the next color from the color array
 * @returns {string} Hex color code
 */
function getNextColor() {
  const color = COLORS[colorIndex];
  colorIndex = (colorIndex + 1) % COLORS.length;
  return color;
}

/**
 * Generate a unique ID for the inequality
 * @returns {string} Unique ID
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9);
} 