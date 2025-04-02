// Dùng biến toàn cục (hoặc closure) để lưu hue đã dùng
let usedHues = [];

export const parseInequality = (input) => {
  // Chuẩn hóa input
  input = input.replace(/\s+/g, '')
               .replace(/\-\-/g, '+')
               .replace(/\+\-/g, '-')
               .replace(/\-\+/g, '-');

  const regex = /^(-?\d*\.?\d*)?x\s*([+-]\s*\d*\.?\d*)?y\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?)\s*0$/;
  const match = input.match(regex);

  if (!match) {
    // Thử xử lý trường hợp một biến
    const singleVarRegex = /^(-?\d*\.?\d*)?([xy])\s*([+-]\s*\d*\.?\d*)?\s*([<>]=?)\s*0$/;
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
      latex += ` ${operator.replace('<=', '\\leq').replace('>=', '\\geq')} 0`;

      return {
        a: variable === 'x' ? coef : 0,
        b: variable === 'y' ? coef : 0,
        c,
        operator,
        latex
      };
    }
    
    return { error: 'Định dạng không hợp lệ!' };
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

  return { a, b, c, operator, latex };
};

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

// Hàm randomColor() tránh trùng hue
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
