// Hogwarts house colors
const hogwartsColors = [
  '#740001', // Gryffindor Red
  '#D3A625', // Gryffindor Gold
  '#1A472A', // Slytherin Green
  '#AAAAAA', // Slytherin Silver
  '#0E1A40', // Ravenclaw Blue
  '#946B2D', // Ravenclaw Bronze
  '#ECB939', // Hufflepuff Yellow
  '#372E29'  // Hufflepuff Black
];

// Track used colors to avoid repeats
let usedColors = [];

export const parseInequality = (input) => {
  // Normalize input: remove spaces, fix double operators
  input = input.replace(/\s+/g, '')
               .replace(/\-\-/g, '+')
               .replace(/\+\-/g, '-')
               .replace(/\-\+/g, '-');

  // Support unicode inequality symbols
  input = input.replace(/≤/g, '<=')
               .replace(/≥/g, '>=')
               .replace(/≠/g, '!=');

  // Main regex for standard form ax + by + c operator 0
  const regex = /^(-?\d*\.?\d*)?x\s*([+-]\s*\d*\.?\d*)?y\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?|!=)\s*0$/;
  const match = input.match(regex);

  if (!match) {
    // Try parsing single variable case (x, y)
    const singleVarRegex = /^(-?\d*\.?\d*)?([xy])\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?|!=)\s*0$/;
    const singleMatch = input.match(singleVarRegex);
    
    if (singleMatch) {
      let [, coef = '1', variable, c = '0', operator] = singleMatch;
      
      // Convert to standard form
      coef = coef === '-' ? -1 : coef === '' ? 1 : parseFloat(coef);
      c = c ? parseFloat(c.replace(/[+\s]/g, '')) : 0;
      
      // Build LaTeX string
      let latex = '';
      if (Math.abs(coef) === 1) {
        latex = `${coef < 0 ? '-' : ''}${variable}`;
      } else {
        latex = `${coef}${variable}`;
      }
      if (c !== 0) {
        latex += ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
      }
      latex += ` ${getLatexOperator(operator)} 0`;

      // Create unique label
      const label = `I${Math.floor(Math.random() * 1000)}`;

      return {
        a: variable === 'x' ? coef : 0,
        b: variable === 'y' ? coef : 0,
        c,
        operator,
        latex,
        label,
        color: getNextColor()
      };
    }
    
    // Try parsing y = mx + b form
    const slopeFormRegex = /^y\s*=\s*(-?\d*\.?\d*)?x\s*([+-]\s*\d*\.?\d*)?$/;
    const slopeMatch = input.match(slopeFormRegex);
    
    if (slopeMatch) {
      let [, m = '1', b = '0'] = slopeMatch;
      
      // Convert to standard form
      m = m === '-' ? -1 : m === '' ? 1 : parseFloat(m);
      b = b ? parseFloat(b.replace(/[+\s]/g, '')) : 0;
      
      // Standard form: -mx + y - b = 0
      const a = -m;
      const c = -b;
      
      // Build LaTeX string
      let latex = 'y = ';
      if (Math.abs(m) === 1) {
        latex += `${m < 0 ? '-' : ''}x`;
      } else {
        latex += `${m}x`;
      }
      if (b !== 0) {
        latex += ` ${b > 0 ? '+' : '-'} ${Math.abs(b)}`;
      }

      // Create unique label
      const label = `I${Math.floor(Math.random() * 1000)}`;

      return {
        a,
        b: 1,
        c,
        operator: '=',
        latex,
        label,
        color: getNextColor()
      };
    }
    
    return null;
  }

  // Parse standard form ax + by + c
  let [, a = '1', b = '1', c = '0', operator] = match;
  
  // Parse coefficients
  a = a === '-' ? -1 : a === '' ? 1 : parseFloat(a);
  b = b ? (b === '+' ? 1 : b === '-' ? -1 : parseFloat(b.replace(/[+\s]/g, ''))) : 0;
  c = c ? parseFloat(c.replace(/[+\s]/g, '')) : 0;

  // Build LaTeX string
  const terms = [];
  if (a !== 0) {
    terms.push(Math.abs(a) === 1 ? `${a < 0 ? '-' : ''}x` : `${a}x`);
  }
  if (b !== 0) {
    terms.push(Math.abs(b) === 1 ? `${b < 0 ? '-' : '+'}y` : `${b > 0 ? '+' : '-'}${Math.abs(b)}y`);
  }
  if (c !== 0) {
    terms.push(`${c > 0 ? '+' : '-'} ${Math.abs(c)}`);
  }

  let latex = terms.join(' ').trim();
  // Remove leading plus if exists
  if (latex.startsWith('+')) {
    latex = latex.substring(1).trim();
  }
  
  // Add operator with proper LaTeX symbols
  latex += ` ${getLatexOperator(operator)} 0`;

  // Create unique label
  const label = `I${Math.floor(Math.random() * 1000)}`;

  return { 
    a, 
    b, 
    c, 
    operator, 
    latex,
    label,
    color: getNextColor() 
  };
};

// Function to convert operators to LaTeX
function getLatexOperator(operator) {
  switch(operator) {
    case '<=': return '\\leq';
    case '>=': return '\\geq';
    case '!=': return '\\neq';
    default: return operator;
  }
}

// Function to get the next color from the Hogwarts palette
function getNextColor() {
  // Reset if all colors are used
  if (usedColors.length >= hogwartsColors.length) {
    usedColors = [];
  }
  
  // Find an unused color
  let availableColors = hogwartsColors.filter(color => !usedColors.includes(color));
  if (availableColors.length === 0) {
    usedColors = [];
    availableColors = [...hogwartsColors];
  }
  
  // Pick a random color from available ones
  const randomIndex = Math.floor(Math.random() * availableColors.length);
  const selectedColor = availableColors[randomIndex];
  
  // Remember this color has been used
  usedColors.push(selectedColor);
  
  return selectedColor;
}

function parseLeftSide(expr) {
  let a = 0, b = 0, c = 0;
  expr = expr.replace(/-/g, "+-");
  let terms = expr.split("+").map(t => t.trim()).filter(t => t !== "");
  for (let t of terms) {
    if (t.includes("x")) {
      const coeff = t.replace("x", "");
      const val = parseFloat(coeff);
      if (isNaN(val)) {
        a += (coeff === "-" ? -1 : 1);
      } else {
        a += val;
      }
    } else if (t.includes("y")) {
      const coeff = t.replace("y", "");
      const val = parseFloat(coeff);
      if (isNaN(val)) {
        b += (coeff === "-" ? -1 : 1);
      } else {
        b += val;
      }
    } else {
      const val = parseFloat(t);
      if (!isNaN(val)) {
        c += val;
      }
    }
  }
  return { a, b, c };
}

function buildLatex(a, b, c, latexOp) {
  let terms = [];
  if (Math.abs(a) > 1e-9) {
    terms.push(formatTerm(a, "x", terms.length === 0));
  }
  if (Math.abs(b) > 1e-9) {
    terms.push(formatTerm(b, "y", terms.length === 0));
  }
  if (Math.abs(c) > 1e-9) {
    terms.push(formatConst(c, terms.length === 0));
  }
  if (terms.length === 0) terms.push("0");
  let leftSide = terms[0];
  for (let i = 1; i < terms.length; i++) {
    if (terms[i].startsWith("-")) {
      leftSide += " " + terms[i];
    } else {
      leftSide += " + " + terms[i];
    }
  }
  return `${leftSide} ${latexOp} 0`;
}

function formatTerm(value, varName, isFirst) {
  let sign = "";
  let absVal = Math.abs(value);
  if (value < 0) sign = "-";
  if (Math.abs(absVal - 1) < 1e-9) {
    return sign + varName;
  }
  return sign + absVal + varName;
}

function formatConst(value, isFirst) {
  let sign = "";
  let absVal = Math.abs(value);
  if (value < 0) sign = "-";
  return sign + absVal;
}
