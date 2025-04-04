import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { computeIntersection } from "../utils/geometry";
import { parseInequality } from "../utils/parser";

// Constants
const CANVAS_CONFIG = {
  width: 600,
  height: 600,
  minZoom: 20,
  defaultZoom: 40
};

const BUTTON_CONFIG = {
  width: 60,
  height: 30,
  offset: 40
};

const EPSILON = 1e-9;

// Add at the top with other constants
const POINT_STATUS = {
  UNSOLVED: 'unsolved',    // Black, not attempted
  ACTIVE: 'active',        // Yellow, currently being input
  PARTIAL: 'partial',      // Red, partially correct
  SOLVED: 'solved'         // Green, fully correct and showing coordinates
};

// Utility functions
const fValue = (eq, point) => eq.a * point.x + eq.b * point.y + eq.c;

// Update pointInInequality function
const checkPointInInequality = (eq, point) => {
  const val = eq.a * point.x + eq.b * point.y + eq.c;
  const isGreaterType = eq.operator === ">" || eq.operator === ">=";
  
  // Points on the boundary line are always accepted
  if (Math.abs(val) < EPSILON) return true;
  
  // Check if the point satisfies the inequality
  return isGreaterType ? val >= -EPSILON : val <= EPSILON;
};

const isPointOnLine = (eq, point) => Math.abs(fValue(eq, point)) < EPSILON;

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

// Update drawGridAndAxes function
const drawGridAndAxes = (ctx, width, height, zoom, origin) => {
  // Draw magical grid background
  ctx.fillStyle = 'rgba(14, 26, 64, 0.05)';
  ctx.fillRect(0, 0, width, height);
  
  // Draw grid
  ctx.strokeStyle = "rgba(211, 166, 37, 0.2)";
  ctx.lineWidth = 0.5;

  // Calculate units to draw
  const unitsX = Math.ceil(width / (2 * zoom));
  const unitsY = Math.ceil(height / (2 * zoom));

  // Draw grid lines vertically
  for (let i = -unitsX; i <= unitsX; i++) {
    const x = origin.x + i * zoom;
    if (x >= 0 && x <= width) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  // Draw grid lines horizontally
  for (let i = -unitsY; i <= unitsY; i++) {
    const y = origin.y + i * zoom;
    if (y >= 0 && y <= height) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Draw axes with Harry Potter theme colors
  ctx.strokeStyle = "#D3A625"; // Gryffindor Gold
  ctx.lineWidth = 2;
  
  // X-axis
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(width, origin.y);
  ctx.stroke();

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(origin.x, height);
  ctx.lineTo(origin.x, 0);
  ctx.stroke();

  // Draw arrows at the very edges
  const arrowSize = 10;

  // X-axis arrow (at the right edge)
  ctx.beginPath();
  ctx.moveTo(width, origin.y);  // Tip at the very edge
  ctx.lineTo(width - arrowSize, origin.y - arrowSize);
  ctx.lineTo(width - arrowSize, origin.y + arrowSize);
  ctx.fillStyle = "#D3A625"; // Gryffindor Gold
  ctx.fill();
  ctx.closePath();

  // Y-axis arrow (at the top edge)
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);  // Tip at the very edge
  ctx.lineTo(origin.x - arrowSize, arrowSize);
  ctx.lineTo(origin.x + arrowSize, arrowSize);
  ctx.fill();
  ctx.closePath();

  // Draw labels
  ctx.font = "bold italic 18px 'STIX Two Math', 'Times New Roman', serif";
  ctx.fillStyle = "#D3A625"; // Gryffindor Gold
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // O label
  ctx.fillText("O", origin.x - 15, origin.y + 15);

  // X label - same distance from axis as Y label
  ctx.fillText("x", width - 20, origin.y - 20);

  // Y label - same distance from axis as X label
  ctx.fillText("y", origin.x + 20, 20);

  // Draw numbers on axes
  ctx.font = '14px "Cinzel", serif';
  ctx.fillStyle = '#D3A625'; // Gryffindor Gold
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // X-axis numbers
  for (let i = -Math.floor(width/(2*zoom)); i <= Math.floor(width/(2*zoom)); i++) {
    if (i === 0) continue; // Skip zero
    const x = origin.x + i * zoom;
    if (x >= 0 && x <= width) {
      ctx.fillText(i.toString(), x, origin.y + 5);
    }
  }

  // Y-axis numbers
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = -Math.floor(height/(2*zoom)); i <= Math.floor(height/(2*zoom)); i++) {
    if (i === 0) continue; // Skip zero
    const y = origin.y - i * zoom;
    if (y >= 0 && y <= height) {
      ctx.fillText(i.toString(), origin.x - 5, y);
    }
  }
};

// Sửa lại hàm fillHalfPlane
const fillHalfPlane = (ctx, eq, fillColor, toCanvasCoords, alpha = 0.3) => {
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
    // For > and >=
    fillDir = {
      x: (val > 0) === isGreaterType ? normalX : -normalX,
      y: (val > 0) === isGreaterType ? normalY : -normalY
    };
  }
  
  // Create a region to fill by extending far in the direction of the inequality
  const big = 10000;
  const farPoint = {
    x: mid.x + fillDir.x * big,
    y: mid.y + fillDir.y * big
  };
  
  const hexToRgba = (hex, a = alpha) => {
    let r = 0, g = 0, b = 0;
    
    // Parse hex color code
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };
  
  // Convert the boundary points to canvas coordinates for drawing
  const canvasP1 = toCanvasCoords(p1);
  const canvasP2 = toCanvasCoords(p2);
  const canvasMid = toCanvasCoords(mid);
  const canvasFar = toCanvasCoords(farPoint);
  
  // Draw a filled triangle to represent the half-plane
  ctx.beginPath();
  ctx.moveTo(canvasP1.x, canvasP1.y);
  ctx.lineTo(canvasP2.x, canvasP2.y);
  ctx.lineTo(canvasFar.x, canvasFar.y);
  ctx.closePath();
  
  // Fill with a lighter version of the line color
  ctx.fillStyle = hexToRgba(fillColor);
  ctx.fill();
};

// Define a simple color function for backward compatibility
const getRandomColor = () => {
  const colors = [
    '#740001', // Gryffindor Red
    '#D3A625', // Gryffindor Gold
    '#1A472A', // Slytherin Green
    '#0E1A40', // Ravenclaw Blue
    '#ECB939', // Hufflepuff Yellow
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Main component
const CoordinatePlane = forwardRef(({ inequalities, setInequalities, setQuizMessage, hoveredEq, setHoveredEq }, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_CONFIG.width);
  const [canvasHeight, setCanvasHeight] = useState(CANVAS_CONFIG.height);
  const [zoom, setZoom] = useState(CANVAS_CONFIG.defaultZoom);
  const [origin, setOrigin] = useState({ x: CANVAS_CONFIG.width / 2, y: CANVAS_CONFIG.height / 2 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [parsedInequalities, setParsedInequalities] = useState([]);
  const [intersectionPoints, setIntersectionPoints] = useState([]);
  const [hoveredIntersection, setHoveredIntersection] = useState(null);
  const [isPointMode, setIsPointMode] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [activeInequality, setActiveInequality] = useState(null);
  const [solutionButtons, setSolutionButtons] = useState([]);
  const [activePoint, setActivePoint] = useState(null);
  const [inputCoords, setInputCoords] = useState({ x: '', y: '' });
  const [activeLines, setActiveLines] = useState([]);
  const [points, setPoints] = useState([]);

  const originMemo = useMemo(() => ({
    x: canvasWidth / 2,
    y: canvasHeight / 2
  }), [canvasWidth, canvasHeight]);

  // Function to convert mathematical coordinates to canvas coordinates
  const toCanvasCoords = useCallback((x, y) => ({
    x: origin.x + x * zoom,
    y: origin.y - y * zoom
  }), [zoom, origin]);

  // Function to convert canvas coordinates to mathematical coordinates
  const toMathCoords = useCallback((x, y) => ({
    x: (x - origin.x) / zoom,
    y: (origin.y - y) / zoom,
  }), [origin, zoom]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const isMobile = window.innerWidth < 768;
        
        // For mobile, use full width minus padding
        const newWidth = isMobile ? 
          containerWidth - 20 : // 10px padding on each side
          Math.min(containerWidth, CANVAS_CONFIG.width);
          
        // Keep aspect ratio as 1:1
        setCanvasWidth(newWidth);
        setCanvasHeight(newWidth);
        
        // Update origin accordingly
        setOrigin({ 
          x: newWidth / 2, 
          y: newWidth / 2 
        });
      }
    };
    
    // Initial size
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    setDragging(true);
    setLastPos({ x: touch.clientX, y: touch.clientY });
    
    // Handle point mode if active
    if (isPointMode) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Convert canvas coordinates to graph coordinates
      const worldX = (x - origin.x) / zoom;
      const worldY = (origin.y - y) / zoom;
      
      handlePointSelection({ x: worldX, y: worldY });
    }
  }, [isPointMode, origin, zoom]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastPos.x;
    const deltaY = touch.clientY - lastPos.y;
    
    setOrigin(prevOrigin => ({
      x: prevOrigin.x + deltaX,
      y: prevOrigin.y + deltaY
    }));
    
    setLastPos({ x: touch.clientX, y: touch.clientY });
  }, [dragging, lastPos]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // Function to draw a point with hover effect
  const drawPoint = useCallback((ctx, x, y, mathX, mathY, size = 6, color = '#D3A625', isHovered = false, showCoordinates = false) => {
    // Draw glow effect if hovered
    if (isHovered) {
      ctx.shadowColor = 'rgba(211, 166, 37, 0.8)';
      ctx.shadowBlur = 15;
    }
    
    // Draw the point
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#0E1A40';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Show coordinates if needed
    if (showCoordinates) {
      ctx.font = '14px "Cinzel", serif';
      ctx.fillStyle = '#D3A625';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      
      // Format coordinates to 2 decimal places if needed
      const formatCoord = (num) => {
        if (Number.isInteger(num)) return num.toString();
        return num.toFixed(2);
      };
      
      ctx.fillText(
        `(${formatCoord(mathX)}, ${formatCoord(mathY)})`, 
        x + 10, 
        y - 10
      );
    }
  }, []);

  // Function to handle point selection
  const handlePointSelection = useCallback((point) => {
    setSelectedPoint(point);
    
    // Check if the point satisfies all inequalities
    if (parsedInequalities.length > 0) {
      const allSatisfied = parsedInequalities.every(eq => 
        checkPointInInequality(eq, point)
      );
      
      if (allSatisfied) {
        setQuizMessage("Correct! This point satisfies all inequalities.");
      } else {
        setQuizMessage("Incorrect. This point does not satisfy all inequalities.");
      }
    }
    
    // Also check against the full inequalities array for backward compatibility
    if (inequalities.length > 0) {
      // Check if this point satisfies all the inequalities
      const satisfiesAll = inequalities.every(ineq => 
        checkPointInInequality(ineq, point)
      );
      
      // Add the point with appropriate color
      const newPoint = {
        x: point.x,
        y: point.y,
        color: satisfiesAll ? '#2E7D32' : '#AA3333',
        showCoords: true
      };
      
      setPoints(prev => [...prev, newPoint]);
    }
  }, [parsedInequalities, setSelectedPoint, setQuizMessage, inequalities]);

  // Sửa lại phần vẽ trong drawInequality
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

      // Draw buttons with styling
      ctx.font = "14px Arial";
      ctx.lineWidth = 1;

      // Draw Miền 1 button
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = eq.color;
      ctx.beginPath();
      ctx.rect(btn1.x, btn1.y, btn1.width, btn1.height);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = eq.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Miền 1', btn1.x + btn1.width/2, btn1.y + btn1.height/2);

      // Draw Miền 2 button
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = eq.color;
      ctx.beginPath();
      ctx.rect(btn2.x, btn2.y, btn2.width, btn2.height);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = eq.color;
      ctx.fillText('Miền 2', btn2.x + btn2.width/2, btn2.y + btn2.height/2);

      // Update button drawing calls:
      drawButton(ctx, btn1.x, btn1.y, btn1.width, btn1.height, 'Miền 1', eq.color);
      drawButton(ctx, btn2.x, btn2.y, btn2.width, btn2.height, 'Miền 2', eq.color);

      return { eq, btn1, btn2 };
    }

    return null;
  }, [toCanvasCoords, hoveredEq]);

  // Sửa lại hàm checkDuplicateInequality
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
      // Normalize to y = mx + k
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

  // Reset view function - properly defined within component
  const resetView = () => {
    setZoom(CANVAS_CONFIG.defaultZoom);
    setOrigin({
      x: canvasWidth / 2, 
      y: canvasHeight / 2
    });
    setDragging(false);
    setIsPointMode(false);
    setSelectedPoint(null);
    setActiveInequality(null);
    setParsedInequalities([]);
    
    // Add magical reset animation
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = 'rgba(211, 166, 37, 0.2)';
      ctx.beginPath();
      ctx.arc(canvasWidth/2, canvasHeight/2, Math.max(canvasWidth, canvasHeight), 0, Math.PI * 2);
      ctx.fill();
      
      setTimeout(() => {
        drawEverything();
      }, 200);
    }
  };
  
  // Drawing function to call after reset
  const drawEverything = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid and axes
    drawGridAndAxes(ctx, canvasWidth, canvasHeight, zoom, origin);
    
    // Draw all inequalities
    parsedInequalities.forEach(ineq => {
      const isHovered = hoveredEq?.label === ineq.label;
      drawInequality(ctx, ineq, isHovered);
    });
    
    // Draw points if any
    intersectionPoints.forEach(point => {
      drawPoint(ctx, point.x, point.y, point.x, point.y, 6, point.color, point.status === POINT_STATUS.ACTIVE || point.status === POINT_STATUS.SOLVED);
    });
  };
  
  // Define proper mouse event handlers
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragging(true);
    setLastPos({ x, y });
    
    // Handle point mode if active
    if (isPointMode) {
      const worldX = (x - origin.x) / zoom;
      const worldY = (origin.y - y) / zoom;
      handlePointSelection({ x: worldX, y: worldY });
    }
  }, [origin, zoom, isPointMode, handlePointSelection]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Pan the view
    setOrigin(prev => ({
      x: prev.x + (x - lastPos.x),
      y: prev.y + (y - lastPos.y)
    }));
    
    setLastPos({ x, y });
    
    // Check for hovering over intersection points
    const hoveredPoint = intersectionPoints.find(pt => {
      const cpt = toCanvasCoords(pt.x, pt.y);
      const distance = Math.sqrt(
        Math.pow(x - cpt.x, 2) + 
        Math.pow(y - cpt.y, 2)
      );
      return distance < 8;
    });
    
    setHoveredIntersection(hoveredPoint);
  }, [dragging, lastPos, intersectionPoints, toCanvasCoords]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert canvas coordinates to graph coordinates
    const worldX = (x - origin.x) / zoom;
    const worldY = (origin.y - y) / zoom;
    
    // Handle point selection
    if (isPointMode) {
      handlePointSelection({ x: worldX, y: worldY });
    }
  }, [origin, zoom, isPointMode, handlePointSelection]);

  // Sửa lại phần redraw để kiểm tra trùng
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Clear canvas and draw background
    ctx.clearRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);
    
    // Draw grid and axes
    drawGridAndAxes(ctx, CANVAS_CONFIG.width, CANVAS_CONFIG.height, zoom, origin);
    
    // Draw solved inequality regions
    inequalities.forEach(eq => {
      if (eq.solved) {
        fillHalfPlane(ctx, eq, eq.color, toCanvasCoords);
      }
    });
    
    drawGridAndAxes(ctx, CANVAS_CONFIG.width, CANVAS_CONFIG.height, zoom, origin);
    
    // Draw boundaries with enhanced highlight
    inequalities.forEach(eq => {
      if (!eq) return;
      const isActive = activeLines.some(line => line.label === eq.label);
      const isHighlighted = isActive || (hoveredEq && hoveredEq.label === eq.label);
      
      // Draw glow effect for active lines
      if (isActive) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.3)'; // Orange glow
        ctx.lineWidth = 8;
        const [p1, p2] = getBoundaryPoints(eq);
        const cp1 = toCanvasCoords(p1.x, p1.y);
        const cp2 = toCanvasCoords(p2.x, p2.y);
        ctx.moveTo(cp1.x, cp1.y);
        ctx.lineTo(cp2.x, cp2.y);
        ctx.stroke();
      }
      
      // Draw main line
      ctx.beginPath();
      ctx.strokeStyle = isActive ? '#ff6d00' : (isHighlighted ? '#0077cc' : '#666');
      ctx.lineWidth = isActive ? 4 : (isHighlighted ? 2 : 1);
      
      const [p1, p2] = getBoundaryPoints(eq);
      const cp1 = toCanvasCoords(p1.x, p1.y);
      const cp2 = toCanvasCoords(p2.x, p2.y);
      
      ctx.moveTo(cp1.x, cp1.y);
      ctx.lineTo(cp2.x, cp2.y);
      ctx.stroke();

      // Draw endpoints for active lines
      if (isActive) {
        ctx.beginPath();
        ctx.fillStyle = '#ff6d00';
        ctx.arc(cp1.x, cp1.y, 3, 0, 2 * Math.PI);
        ctx.arc(cp2.x, cp2.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    
    // Draw boundaries and buttons
    const buttons = inequalities.map(eq => {
      if (!eq) return null;
      return drawInequality(ctx, eq);
    }).filter(Boolean);
    
    setSolutionButtons(buttons);

    // Draw intersection points with enhanced visibility
    intersectionPoints.forEach(pt => {
      const cpt = toCanvasCoords(pt.x, pt.y);
      
      // Draw glow effect for active point
      if (pt.status === POINT_STATUS.ACTIVE) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 109, 0, 0.3)';
        ctx.arc(cpt.x, cpt.y, 8, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Draw glow effect for solved points
      if (pt.status === POINT_STATUS.SOLVED) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(46, 125, 50, 0.2)'; // Light green glow
        ctx.arc(cpt.x, cpt.y, 12, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Draw main point
      ctx.beginPath();
      ctx.arc(cpt.x, cpt.y, 4, 0, 2 * Math.PI);
      
      switch (pt.status) {
        case POINT_STATUS.SOLVED:
          // Draw point
          ctx.fillStyle = '#2e7d32'; // Darker green
          ctx.fill();
          
          // Draw coordinates without background
          ctx.font = "bold 14px 'STIX Two Math', 'Times New Roman', serif";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          const text = `(${pt.correct.x.toFixed(1)}, ${pt.correct.y.toFixed(1)})`;
          ctx.fillStyle = '#1b5e20'; // Darker green for text
          ctx.fillText(text, cpt.x + 8, cpt.y - 8);
          break;
        case POINT_STATUS.ACTIVE:
          ctx.fillStyle = '#ff6d00'; // Deeper orange
          ctx.fill();
          break;
        case POINT_STATUS.PARTIAL:
          ctx.fillStyle = '#c62828'; // Darker red
          ctx.fill();
          break;
        default:
          ctx.fillStyle = '#000';
          ctx.fill();
      }
    });
  }, [inequalities, zoom, drawInequality, toCanvasCoords, intersectionPoints, origin, activeLines, hoveredEq]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleWheel = useCallback((e) => {
    if (e.target === canvasRef.current) {
      e.preventDefault(); // Prevent scroll only when on canvas
      setZoom(prev => Math.max(CANVAS_CONFIG.minZoom, prev + (e.deltaY > 0 ? -2 : 2)));
    }
  }, []);

  useEffect(() => {
    // Add wheel event listener to canvas only
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handlePointClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
  
    // Check if click is near any intersection point
    const clickedPoint = intersectionPoints.find(pt => {
      const canvasPoint = toCanvasCoords(pt.x, pt.y);
      const distance = Math.sqrt(
        Math.pow(clickX - canvasPoint.x, 2) + 
        Math.pow(clickY - canvasPoint.y, 2)
      );
      return distance < 8;
    });
  
    // If clicking on currently active point, deselect it
    if (clickedPoint && activePoint && 
        Math.abs(clickedPoint.x - activePoint.x) < EPSILON && 
        Math.abs(clickedPoint.y - activePoint.y) < EPSILON) {
      setActivePoint(null);
      setInputCoords({ x: '', y: '' });
      // Restore previous status
      setIntersectionPoints(points => points.map(pt => {
        if (Math.abs(pt.x - clickedPoint.x) < EPSILON && 
            Math.abs(pt.y - clickedPoint.y) < EPSILON) {
          // If point was partially correct, keep that status
          return { 
            ...pt, 
            status: pt.status === POINT_STATUS.ACTIVE ? POINT_STATUS.UNSOLVED : pt.status 
          };
        }
        return pt;
      }));
      return;
    }
  
    // Handle new point selection
    if (clickedPoint && clickedPoint.status !== POINT_STATUS.SOLVED) {
      setActivePoint(clickedPoint);
      setInputCoords({ x: '', y: '' });
      setQuizMessage('Please enter the coordinates of the point:');
      
      setIntersectionPoints(points => points.map(pt => {
        if (Math.abs(pt.x - clickedPoint.x) < EPSILON && 
            Math.abs(pt.y - clickedPoint.y) < EPSILON) {
          return { ...pt, status: POINT_STATUS.ACTIVE };
        }
        return pt;
      }));
    }
  }, [intersectionPoints, toCanvasCoords, setActivePoint, setInputCoords, setQuizMessage, activePoint]);

  const isPointInSolutionRegion = (point, inequality) => {
    if (!inequality.solved) return false;

    const val = inequality.a * point.x + inequality.b * point.y + inequality.c;
    const isGreaterType = inequality.operator === ">" || inequality.operator === ">=";
    
    if (Math.abs(val) < EPSILON) return true;
    
    if (isGreaterType) {
      return val > -EPSILON;
    } else {
      return val < EPSILON;
    }
  };

  // Cập nhật hàm findValidIntersections
  const findValidIntersections = useCallback(() => {
    const newPoints = [];
    console.log('Finding intersections...'); // Debug log
    
    inequalities.forEach((eq1, i) => {
      if (!eq1.solved) return;
      
      inequalities.slice(i + 1).forEach(eq2 => {
        if (!eq2.solved) return;
        
        const pt = computeIntersection(eq1, eq2);
        if (pt) {
          console.log('Found intersection:', pt); // Debug log
          
          // Kiểm tra điểm có nằm trong vùng không phải nghiệm của bất phương trình khác không
          const isInNonSolutionRegion = inequalities.some(eq3 => {
            if (eq3 === eq1 || eq3 === eq2 || !eq3.solved) return false;
            const isInSolution = checkPointInInequality(eq3, pt);
            console.log('Checking eq3:', eq3.label, 'isInSolution:', isInSolution); // Debug log
            return !isInSolution; // true nếu điểm nằm trong vùng KHÔNG phải nghiệm
          });
  
          console.log('isInNonSolutionRegion:', isInNonSolutionRegion); // Debug log
  
          if (!isInNonSolutionRegion) {
            const existingPoint = intersectionPoints.find(ip => 
              Math.abs(ip.x - pt.x) < EPSILON && Math.abs(ip.y - pt.y) < EPSILON
            );
  
            if (existingPoint) {
              newPoints.push(existingPoint);
            } else {
              newPoints.push({
                x: pt.x,
                y: pt.y,
                status: POINT_STATUS.UNSOLVED,
                correct: { x: pt.x, y: pt.y }
              });
            }
          }
        }
      });
    });
  
    console.log('Final intersection points:', newPoints); // Debug log
    setIntersectionPoints(newPoints);
  }, [inequalities]); // Bỏ intersectionPoints khỏi dependencies

  const handleCheckCoordinates = useCallback(() => {
    if (!activePoint) return;
    
    if (inputCoords.x === '' || inputCoords.y === '') {
      setQuizMessage('Please enter both x and y coordinates!');
      return;
    }
  
    const xCorrect = Number(inputCoords.x).toFixed(1) === activePoint.correct.x.toFixed(1);
    const yCorrect = Number(inputCoords.y).toFixed(1) === activePoint.correct.y.toFixed(1);
  
    setIntersectionPoints(points => points.map(pt => {
      if (Math.abs(pt.x - activePoint.x) < EPSILON && 
          Math.abs(pt.y - activePoint.y) < EPSILON) {
        return {
          ...pt,
          status: xCorrect && yCorrect ? POINT_STATUS.SOLVED : POINT_STATUS.PARTIAL
        };
      }
      return pt;
    }));
  
    if (xCorrect && yCorrect) {
      setQuizMessage('Correct! Well done!');
      setActivePoint(null);
    } else {
      setQuizMessage(
        `${xCorrect ? 'x correct' : 'x incorrect'}${yCorrect ? ', y correct' : ', y incorrect'}`
      );
    }
  }, [activePoint, inputCoords, setQuizMessage]);

  useEffect(() => {
    findValidIntersections();
  }, [inequalities, findValidIntersections]);

  // Check if point is in a non-solution region of another inequality
  const isPointInOtherNonSolutionRegion = (point, currentInequalityIndex) => {
    // Find an inequality where this point is not in the solution region
    for (let i = 0; i < inequalities.length; i++) {
      if (i === currentInequalityIndex) continue; // Skip current inequality
      const isInSolution = checkPointInInequality(inequalities[i], point);
      return !isInSolution; // true if point is in a non-solution region
    }
    return false;
  };

  // Update useImperativeHandle with the handleAddInequality function
  useImperativeHandle(ref, () => ({
    handleAddInequality: (inputText) => {
      const result = parseInequality(inputText);
      if (!result) {
        setQuizMessage("Incorrect spell format. Try examples like: x+y<0, 2x-3y+1≥0, x>-2");
        return false;
      }
      
      if (inequalities.some(ineq => ineq.label === result.label)) {
        return 'EXISTS';
      }
      
      // Add inequality to list
      setInequalities(prev => [...prev, result]);
      
      // Clear any previous message
      setQuizMessage('');
      return true;
    },
    resetView: resetView
  }));

  // Draw button function (moved outside of component)
  return (
    <div 
      className="coordinate-plane-wrapper"
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCanvasClick}
        style={{ touchAction: 'none' }}
      />
      {activePoint && (
        <div className="coordinate-input-below">
          <span>(</span>
          <div className="coordinate-box">
            <input 
              type="number"
              step="0.1"
              inputMode="decimal"
              value={inputCoords.x}
              onChange={e => setInputCoords(prev => ({ ...prev, x: e.target.value }))}
              className={
                inputCoords.x === '' ? '' :
                Number(inputCoords.x).toFixed(1) === activePoint.correct.x.toFixed(1) 
                  ? 'correct' 
                  : 'incorrect'
              }
            />
          </div>
          <span>;</span>
          <div className="coordinate-box">
            <input 
              type="number"
              step="0.1"
              inputMode="decimal"
              value={inputCoords.y}
              onChange={e => setInputCoords(prev => ({ ...prev, y: e.target.value }))}
              className={
                inputCoords.y === '' ? '' :
                Number(inputCoords.y).toFixed(1) === activePoint.correct.y.toFixed(1) 
                  ? 'correct' 
                  : 'incorrect'
              }
            />
          </div>
          <span>)</span>
          <button onClick={handleCheckCoordinates}>Check</button>
        </div>
      )}
    </div>
  );
});

// Add this function before the CoordinatePlane component
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

  // Add hover effect preparation
  return {
    isHovered: false,
    draw: (isHovered) => {
      if (isHovered) {
        ctx.fillStyle = `rgba(${color.match(/\d+/g).join(',')}, 0.1)`;
        ctx.fill();
      }
    }
  };
};

export default CoordinatePlane;