import React, { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import '../styles/App.css';

// Constants
const CANVAS_CONFIG = {
  width: 500,
  height: 500,
  minZoom: 20,
  defaultZoom: 40
};

const BUTTON_CONFIG = {
  width: 60,
  height: 30,
  offset: 40
};

const EPSILON = 1e-9;

// Utility functions
const fValue = (eq, point) => eq.a * point.x + eq.b * point.y + eq.c;

const checkPointInInequality = (eq, point) => {
  const val = eq.a * point.x + eq.b * point.y + eq.c;
  const isGreaterType = eq.operator === ">" || eq.operator === ">=";
  
  // Points on the line are always accepted
  if (Math.abs(val) < EPSILON) return true;
  
  // Check if point satisfies the inequality
  return isGreaterType ? val >= -EPSILON : val <= EPSILON;
};

const getBoundaryPoints = eq => {
  const big = 10000;
  if (Math.abs(eq.b) < EPSILON) {
    const x = -eq.c / eq.a;
    return [{ x, y: -big }, { x, y: big }];
  }
  return [
    { x: -big, y: -(eq.c + eq.a * (-big)) / eq.b },
    { x: big, y: -(eq.c + eq.a * big) / eq.b }
  ];
};

// Function to draw buttons
const drawButton = (ctx, x, y, width, height, text, color) => {
  // Create gradient background
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.85)');

  // Draw button background
  ctx.fillStyle = gradient;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fill();
  ctx.stroke();

  // Add subtle inner shadow
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x, y + height - 4, width, 4);
  ctx.restore();

  // Draw text with shadow
  ctx.font = "bold 14px Arial";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillText(text, x + width/2 + 1, y + height/2 + 1);
  
  // Main text
  ctx.fillStyle = color;
  ctx.fillText(text, x + width/2, y + height/2);
};

// Fill function for the half-plane
const fillHalfPlane = (ctx, eq, fillColor, toCanvasCoords, alpha = 0.2) => {
  const [p1, p2] = getBoundaryPoints(eq);
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  
  // Calculate vectors
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  const normalX = -dy / length;
  const normalY = dx / length;
  
  const testPoint = { 
    x: mid.x + normalX, 
    y: mid.y + normalY 
  };
  
  const val = eq.a * testPoint.x + eq.b * testPoint.y + eq.c;
  const isGreaterType = eq.operator === ">" || eq.operator === ">=";
  
  let fillDir;
  if (eq.operator === '<' || eq.operator === '<=') {
    // Keep existing logic for < and <=
    fillDir = {
      x: (val > 0) !== isGreaterType ? normalX : -normalX,
      y: (val > 0) !== isGreaterType ? normalY : -normalY
    };
  } else {
    // Logic for > and >=
    if (Math.abs(eq.a) > EPSILON && Math.abs(eq.b) > EPSILON) {
      // Case with both x and y terms: invert the fill direction
      fillDir = {
        x: (val > 0) !== isGreaterType ? normalX : -normalX,
        y: (val > 0) !== isGreaterType ? normalY : -normalY
      };
    } else {
      // Case with only x or y: keep original logic
      fillDir = {
        x: (val > 0) !== isGreaterType ? normalX : -normalX,
        y: (val > 0) !== isGreaterType ? normalY : -normalY
      };
    }
  }

  // Rest of drawing code
  const big = 10000;
  const ext1 = { 
    x: p1.x + fillDir.x * big, 
    y: p1.y + fillDir.y * big 
  };
  const ext2 = { 
    x: p2.x + fillDir.x * big, 
    y: p2.y + fillDir.y * big 
  };

  // Draw the filled region
  ctx.save();
  const hexToRgba = (hex, a = alpha) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${a})` 
      : hex;
  };
  
  ctx.fillStyle = hexToRgba(fillColor);
  ctx.beginPath();
  
  const points = [
    toCanvasCoords(p1.x, p1.y),
    toCanvasCoords(p2.x, p2.y),
    toCanvasCoords(ext2.x, ext2.y),
    toCanvasCoords(ext1.x, ext1.y)
  ];
  
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const CoordinatePlane = forwardRef(({ 
  inequalities, 
  setInequalities, 
  setQuizMessage,
  hoveredEq,
  setHoveredEq,
  isMobile 
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(CANVAS_CONFIG.defaultZoom);
  const [solutionButtons, setSolutionButtons] = useState([]);
  const [touchDistance, setTouchDistance] = useState(null);

  // Define center point
  const origin = useMemo(() => ({
    x: CANVAS_CONFIG.width / 2,
    y: CANVAS_CONFIG.height / 2
  }), []);

  // Coordinate conversion functions
  const toCanvasCoords = useCallback((x, y) => ({
    x: origin.x + x * zoom,
    y: origin.y - y * zoom
  }), [zoom, origin]);

  const toMathCoords = useCallback((x, y) => ({
    x: (x - origin.x) / zoom,
    y: (origin.y - y) / zoom
  }), [zoom, origin]);

  // Check for duplicate inequalities
  const checkDuplicateInequality = useCallback((newEq, existingEq) => {
    if (!existingEq) return false;
    
    // Normalize coefficients
    const normalize = (coef) => Math.abs(coef) < EPSILON ? 0 : coef;
    const a1 = normalize(existingEq.a);
    const b1 = normalize(existingEq.b);
    const c1 = normalize(existingEq.c);
    const a2 = normalize(newEq.a);
    const b2 = normalize(newEq.b);
    const c2 = normalize(newEq.c);
  
    // If both are vertical lines
    if (Math.abs(b1) < EPSILON && Math.abs(b2) < EPSILON) {
      return Math.abs(a1/a2 - c1/c2) < EPSILON && existingEq.operator === newEq.operator;
    }
  
    // General case
    if (Math.abs(b1) >= EPSILON) {
      // Normalize to y = mx + k form
      const m1 = -a1/b1;
      const k1 = -c1/b1;
      const m2 = -a2/b2;
      const k2 = -c2/b2;
      
      return Math.abs(m1 - m2) < EPSILON && 
             Math.abs(k1 - k2) < EPSILON && 
             existingEq.operator === newEq.operator;
    }
  
    return false;
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleAddInequality: (newInequality) => {
      // Check for duplicate inequality
      const duplicateEq = inequalities.find(eq => 
        checkDuplicateInequality(newInequality, eq)
      );
      
      if (duplicateEq) {
        setQuizMessage(`Bất phương trình ${newInequality.label} trùng với ${duplicateEq.label}!`);
        return false;
      }
      
      setInequalities(prev => [...prev, newInequality]);
      setQuizMessage(''); // Clear previous message
      return true;
    }
  }), [inequalities, checkDuplicateInequality, setQuizMessage, setInequalities]);

  // Draw inequality with solution selection buttons
  const drawInequality = useCallback((ctx, eq) => {
    if (!eq) return null;

    const isHighlighted = hoveredEq && hoveredEq.label === eq.label;
    const lineWidth = isHighlighted ? 4 : 2;
    const alpha = isHighlighted ? 0.4 : 0.2;

    const [p1, p2] = getBoundaryPoints(eq);
    const pt1Canvas = toCanvasCoords(p1.x, p1.y);
    const pt2Canvas = toCanvasCoords(p2.x, p2.y);

    // Draw filled region if solved
    if (eq.solved) {
      fillHalfPlane(ctx, eq, eq.color, toCanvasCoords, alpha);
    }

    // Draw boundary line with highlight effect
    ctx.strokeStyle = eq.color;
    ctx.lineWidth = lineWidth;
    if (isHighlighted) {
      ctx.shadowColor = eq.color;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(pt1Canvas.x, pt1Canvas.y);
    ctx.lineTo(pt2Canvas.x, pt2Canvas.y);
    ctx.stroke();
    
    if (isHighlighted) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Draw label
    ctx.font = "bold italic 14px 'STIX Two Math', 'Times New Roman', serif";
    ctx.fillStyle = eq.color;
    ctx.fillText(eq.label, pt2Canvas.x + 5, pt2Canvas.y - 5);

    // Only draw buttons if NOT solved
    if (!eq.solved) {
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate offset for buttons
      const perpX = -dy / length;
      const perpY = dx / length;
      const offset = 3;
      
      // Calculate button positions
      const pos1 = toCanvasCoords(
        mid.x - perpX * offset,
        mid.y - perpY * offset
      );
      const pos2 = toCanvasCoords(
        mid.x + perpX * offset,
        mid.y + perpY * offset
      );

      // Determine solution region
      const testPoint = { 
        x: mid.x + perpX * offset, 
        y: mid.y + perpY * offset 
      };
      const isBtn1Solution = checkPointInInequality(eq, testPoint);
      
      // Create buttons with reversed solution values for > and >=
      let btn1 = {
        x: pos1.x - BUTTON_CONFIG.width / 2,
        y: pos1.y - BUTTON_CONFIG.height / 2,
        width: BUTTON_CONFIG.width,
        height: BUTTON_CONFIG.height,
        sol: eq.operator === '>' || eq.operator === '>=' ? !isBtn1Solution : isBtn1Solution
      };
      let btn2 = {
        x: pos2.x - BUTTON_CONFIG.width / 2,
        y: pos2.y - BUTTON_CONFIG.height / 2,
        width: BUTTON_CONFIG.width,
        height: BUTTON_CONFIG.height,
        sol: eq.operator === '>' || eq.operator === '>=' ? isBtn1Solution : !isBtn1Solution
      };

      // Swap positions only for < and <= (keep existing behavior)
      if (eq.operator === '<' || eq.operator === '<=') {
        const tempX = btn1.x;
        const tempY = btn1.y;
        btn1.x = btn2.x;
        btn1.y = btn2.y;
        btn2.x = tempX;
        btn2.y = tempY;
      }

      // Draw buttons
      drawButton(ctx, btn1.x, btn1.y, btn1.width, btn1.height, 'Miền 1', eq.color);
      drawButton(ctx, btn2.x, btn2.y, btn2.width, btn2.height, 'Miền 2', eq.color);

      return { eq, btn1, btn2 };
    }

    return null;
  }, [toCanvasCoords, hoveredEq]);

  // Draw grid with enhanced axis labels
  const drawGridAndAxes = useCallback((ctx, width, height) => {
    // Calculate grid offset based on center (no panning)
    const offsetX = origin.x;
    const offsetY = origin.y;
    
    // Draw grid
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 0.5;

    // Calculate units to draw
    const unitsX = Math.ceil(width / (2 * zoom));
    const unitsY = Math.ceil(height / (2 * zoom));

    // Draw vertical grid lines
    for (let i = -unitsX; i <= unitsX; i++) {
      const x = offsetX + i * zoom;
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw horizontal grid lines
    for (let i = -unitsY; i <= unitsY; i++) {
      const y = offsetY + i * zoom;
      if (y >= 0 && y <= height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, offsetY);
    ctx.lineTo(width, offsetY);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(offsetX, height);
    ctx.lineTo(offsetX, 0);
    ctx.stroke();

    // Draw arrows at edges
    const arrowSize = 10;

    // X-axis arrow
    ctx.beginPath();
    ctx.moveTo(width, offsetY);
    ctx.lineTo(width - arrowSize, offsetY - arrowSize);
    ctx.lineTo(width - arrowSize, offsetY + arrowSize);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.closePath();

    // Y-axis arrow
    ctx.beginPath();
    ctx.moveTo(offsetX, 0);
    ctx.lineTo(offsetX - arrowSize, arrowSize);
    ctx.lineTo(offsetX + arrowSize, arrowSize);
    ctx.fill();
    ctx.closePath();

    // Draw labels
    ctx.font = "bold italic 20px 'Times New Roman', serif";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // O label
    ctx.fillText("O", offsetX - 15, offsetY + 15);

    // X label
    ctx.fillText("x", width - 20, offsetY - 20);

    // Y label
    ctx.fillText("y", offsetX + 20, 20);

    // Draw axis numbers
    ctx.font = '16px Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X-axis numbers
    for (let i = -Math.floor(width/(2*zoom)); i <= Math.floor(width/(2*zoom)); i++) {
      if (i === 0) continue; // Skip zero
      const x = offsetX + i * zoom;
      if (x >= 0 && x <= width) {
        ctx.fillText(i.toString(), x, offsetY + 5);
      }
    }

    // Y-axis numbers
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = -Math.floor(height/(2*zoom)); i <= Math.floor(height/(2*zoom)); i++) {
      if (i === 0) continue; // Skip zero
      const y = offsetY - i * zoom;
      if (y >= 0 && y <= height) {
        // Add white background for better visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(offsetX - 35, y - 10, 30, 20);
        
        // Draw text on top
        ctx.fillStyle = '#000';
        ctx.fillText(i.toString(), offsetX - 10, y);
      }
    }
  }, [origin, zoom]);

  // Main render function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas and draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid and axes
    drawGridAndAxes(ctx, canvas.width, canvas.height);
    
    // Draw solved inequality regions
    inequalities.forEach(eq => {
      if (eq.solved) {
        fillHalfPlane(ctx, eq, eq.color, toCanvasCoords);
      }
    });
    
    // Draw boundaries and buttons
    const buttons = inequalities.map(eq => {
      return drawInequality(ctx, eq);
    }).filter(Boolean);
    
    setSolutionButtons(buttons);
  }, [inequalities, drawGridAndAxes, drawInequality, toCanvasCoords]);

  // Resize canvas when component mounts
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        // Set fixed dimensions for the canvas
        canvasRef.current.width = CANVAS_CONFIG.width;
        canvasRef.current.height = CANVAS_CONFIG.height;
        renderCanvas();
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [renderCanvas]);

  // Update canvas when dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, inequalities, hoveredEq, zoom]);

  // Handle mouse events - now only for hover effects and button clicks
  const handleMouseMove = useCallback((e) => {
    // Handle hover effects
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if mouse is over any solution button
    const isOverButton = solutionButtons.some(btn => 
      (mouseX >= btn.btn1.x && mouseX <= btn.btn1.x + btn.btn1.width &&
       mouseY >= btn.btn1.y && mouseY <= btn.btn1.y + btn.btn1.height) ||
      (mouseX >= btn.btn2.x && mouseX <= btn.btn2.x + btn.btn2.width &&
       mouseY >= btn.btn2.y && mouseY <= btn.btn2.y + btn.btn2.height)
    );
    
    // Check if mouse is near any inequality line
    const mathCoords = toMathCoords(mouseX, mouseY);
    let foundEq = null;
    
    for (const eq of inequalities) {
      // Calculate distance to line
      const fVal = Math.abs(eq.a * mathCoords.x + eq.b * mathCoords.y + eq.c);
      const norm = Math.sqrt(eq.a * eq.a + eq.b * eq.b);
      const distance = fVal / norm;
      
      // Check if mouse is close to line
      if (distance * zoom < 10) {
        foundEq = eq;
        break;
      }
    }
    
    setHoveredEq(foundEq);
    canvasRef.current.style.cursor = isOverButton || foundEq ? 'pointer' : 'default';
  }, [solutionButtons, inequalities, toMathCoords, zoom, setHoveredEq]);

  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Check solution buttons click
    for (const btn of solutionButtons) {
      const { eq } = btn;
      
      // Check Miền 1
      if (
        clickX >= btn.btn1.x &&
        clickX <= btn.btn1.x + btn.btn1.width &&
        clickY >= btn.btn1.y &&
        clickY <= btn.btn1.y + btn.btn1.height
      ) {
        const isCorrect = btn.btn1.sol;
        setQuizMessage(isCorrect ? "Chính xác!" : "Sai, mời chọn lại!");
        if (isCorrect) {
          setInequalities(prev =>
            prev.map(it => it.label === eq.label ? 
              { ...it, solved: true } : it)
          );
        }
        return;
      }
  
      // Check Miền 2
      if (
        clickX >= btn.btn2.x &&
        clickX <= btn.btn2.x + btn.btn2.width &&
        clickY >= btn.btn2.y &&
        clickY <= btn.btn2.y + btn.btn2.height
      ) {
        const isCorrect = btn.btn2.sol;
        setQuizMessage(isCorrect ? "Chính xác!" : "Sai, mời chọn lại!");
        if (isCorrect) {
          setInequalities(prev =>
            prev.map(it => it.label === eq.label ? 
              { ...it, solved: true } : it)
          );
        }
        return;
      }
    }
  }, [solutionButtons, setQuizMessage, setInequalities]);

  // Keep wheel event for zooming
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom factor
    setZoom(prevZoom => {
      return Math.max(CANVAS_CONFIG.minZoom, Math.min(100, prevZoom * delta));
    });
  }, []);

  // Handle touch events for mobile (only for zooming, no panning)
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch to zoom - calculate initial distance
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setTouchDistance(Math.sqrt(dx * dx + dy * dy));
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchDistance) {
      e.preventDefault(); // Prevent scrolling only during pinch zoom
      
      // Pinch to zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      
      // Apply scaling
      const scaleFactor = newDistance / touchDistance;
      setZoom(prevZoom => {
        return Math.max(CANVAS_CONFIG.minZoom, Math.min(100, prevZoom * scaleFactor));
      });
      
      setTouchDistance(newDistance);
    }
  }, [touchDistance]);

  const handleTouchEnd = useCallback(() => {
    setTouchDistance(null);
  }, []);

  const resetView = useCallback(() => {
    setZoom(CANVAS_CONFIG.defaultZoom);
  }, []);

  return (
    <div className="coordinate-plane-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="coordinate-plane-canvas"
      />
      <button onClick={resetView} className="reset-view-button" title="Đặt lại kích thước">
        <i className="material-icons">refresh</i>
      </button>
      {isMobile && (
        <div className="mobile-control-hint">
          Hai ngón tay để zoom
        </div>
      )}
    </div>
  );
});

export default CoordinatePlane; 