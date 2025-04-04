// Dùng biến toàn cục để lưu hue đã dùng
let usedHues = [];

/**
 * Process an inequality string into a structured object
 * @param {string} input - The inequality string (e.g., "2x + 3y < 6")
 * @returns {object} Processed inequality object with coefficients, operator, and LaTeX
 */
export const processInequality = (input) => {
  try {
    // Chuẩn hóa input
    let normalizedInput = input.trim()
      .replace(/\s+/g, '')
      .replace(/\-\-/g, '+')
      .replace(/\+\-/g, '-')
      .replace(/\-\+/g, '-');

    // Thử xử lý trường hợp một biến
    const singleVarRegex = /^(-?\d*\.?\d*)?([xy])\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?)\s*0$/;
    const singleMatch = normalizedInput.match(singleVarRegex);
    
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
      latex += ` ${operator.replace('<=', '\\leq').replace('>=', '\\geq')} 0`;

      return {
        a: variable === 'x' ? coef : 0,
        b: variable === 'y' ? coef : 0,
        c,
        operator,
        latex,
        color: randomColor(),
        id: generateId()
      };
    }

    // Xử lý trường hợp hai biến
    const regex = /^(-?\d*\.?\d*)?x\s*([+-]\s*\d*\.?\d*)?y\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?)\s*0$/;
    const match = normalizedInput.match(regex);

    if (!match) {
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
    latex += ` ${operator.replace('<=', '\\leq').replace('>=', '\\geq')} 0`;

    return {
      a,
      b,
      c,
      operator,
      latex,
      color: randomColor(),
      id: generateId()
    };
  } catch (error) {
    console.error("Error processing inequality:", error);
    return null;
  }
};

/**
 * Generate a unique ID for the inequality
 * @returns {string} Unique ID
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Generate a random color avoiding duplicate hues
 * @returns {string} HSL color string
 */
function randomColor() {
  // Nếu dùng quá 360 màu => reset
  if (usedHues.length >= 360) {
    usedHues = [];
  }
  let hue;
  do {
    hue = Math.floor(Math.random() * 360);
  } while (usedHues.includes(hue));
  usedHues.push(hue);
  return `hsl(${hue}, 70%, 50%)`;
} 