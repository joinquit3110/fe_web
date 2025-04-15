/**
 * Checks if a system of linear inequalities has a solution
 * @param {Array} constraints - Array of constraint objects
 * @returns {boolean} - Whether the system has at least one solution
 */
export const systemHasSolution = (constraints) => {
  // Early return if no constraints
  if (!constraints || constraints.length === 0) {
    return true;
  }

  // Check for directly contradictory constraints
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const c1 = constraints[i];
      const c2 = constraints[j];
      
      // Check if constraints involve the same variables and coefficients but contradict
      if (areContradictoryConstraints(c1, c2)) {
        console.log('Found contradictory constraints:', c1, c2);
        return false;
      }
    }
  }

  // For linear programming approach for complex systems
  try {
    // Create a linear program with objective to maximize a dummy variable
    const result = solveWithSimplexMethod(constraints);
    return result.feasible;
  } catch (error) {
    console.error('Error solving linear system:', error);
    return false; // In case of error, conservatively say no solution
  }
};

/**
 * Checks if two constraints contradict each other directly
 * @param {Object} c1 - First constraint
 * @param {Object} c2 - Second constraint
 * @returns {boolean} - Whether the constraints contradict
 */
const areContradictoryConstraints = (c1, c2) => {
  // Case: Same expression but different inequality types that exclude each other
  // e.g., x+1 > 0 and x+1 < 0
  if (c1.expression === c2.expression || 
      areEquivalentExpressions(c1.expression, c2.expression)) {
    
    // Check for direct contradictions
    if ((c1.type === '>' && c2.type === '<') || 
        (c1.type === '<' && c2.type === '>') ||
        (c1.type === '>=' && c2.type === '<') ||
        (c1.type === '<' && c2.type === '>=') ||
        (c1.type === '>=' && c2.type === '<=') ||
        (c1.type === '<=' && c2.type === '>=')) {
      
      // If both constraints have the same RHS (or equivalent), they contradict
      if (c1.rhs === c2.rhs) {
        return true;
      }
      
      // Check if the RHS values make it impossible
      // For example: x > 5 and x < 3 contradict because there's no x that is both > 5 and < 3
      if (c1.type.includes('>') && c2.type.includes('<') && c1.rhs > c2.rhs) {
        return true;
      }
      
      if (c1.type.includes('<') && c2.type.includes('>') && c1.rhs < c2.rhs) {
        return true;
      }
    }
    
    // Check equal constraints with different RHS: x = 5 and x = 6 contradict
    if ((c1.type === '=' && c2.type === '=') && c1.rhs !== c2.rhs) {
      return true;
    }
  }
  
  return false;
};

/**
 * Checks if two expressions are mathematically equivalent
 */
const areEquivalentExpressions = (expr1, expr2) => {
  // Simple normalization and comparison
  // This is a simplified approach - a full computer algebra system would be more robust
  try {
    const normalized1 = normalizeExpression(expr1);
    const normalized2 = normalizeExpression(expr2);
    return normalized1 === normalized2;
  } catch (error) {
    console.error('Error comparing expressions:', error);
    return false;
  }
};

/**
 * Normalize an expression for comparison
 */
const normalizeExpression = (expr) => {
  // Remove spaces and standardize form
  let normalized = expr.replace(/\s+/g, '');
  
  // Handle common forms of the same expression (very basic)
  // e.g., "x+1" and "1+x" would be normalized to the same form
  // This is very simplified and won't handle all cases
  
  return normalized;
};