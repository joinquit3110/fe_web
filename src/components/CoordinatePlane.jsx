import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { computeIntersection } from "../utils/geometry";
import { parseInequality, resetLabelCounter } from "../utils/parser";

// Constants
const CANVAS_CONFIG = {
  width: 800,
  height: 800,
  minZoom: 20,
  defaultZoom: 25
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
  // Draw white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Draw grid
  ctx.strokeStyle = "rgba(14, 26, 64, 0.1)";
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

// Update fillHalfPlane function to correctly handle all types of inequalities
const fillHalfPlane = (ctx, eq, fillColor, toCanvasCoords, alpha = 0.3) => {
  // Always fill solution domains even when not explicitly marked as solved
  const [p1, p2] = getBoundaryPoints(eq);
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  
  // Calculate vectors
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  const normalX = -dy / length;
  const normalY = dx / length;
  
  // Test points on both sides of the line
  const testPoint1 = { 
    x: mid.x + normalX, 
    y: mid.y + normalY 
  };
  
  const testPoint2 = { 
    x: mid.x - normalX, 
    y: mid.y - normalY 
  };
  
  // Determine which test point satisfies the inequality
  const test1Satisfies = checkPointInInequality(eq, testPoint1);
  const test2Satisfies = checkPointInInequality(eq, testPoint2);
  
  // For equality, we don't fill any region
  if (eq.operator === '=' && !eq.solutionType) {
    return;
  }
  
  // For solution region, we need to know which side was selected by the user
  let fillDir;
  
  if (eq.solutionType === 'btn1') {
    // If Region 1 is the solution (regardless of whether it actually satisfies the inequality)
    fillDir = {
      x: -normalX,
      y: -normalY
    };
  } else if (eq.solutionType === 'btn2') {
    // If Region 2 is the solution (regardless of whether it actually satisfies the inequality)
    fillDir = {
      x: normalX,
      y: normalY
    };
  } else {
    // If no user selection, use the mathematical solution (determined which testPoint satisfies)
    fillDir = {
      x: test1Satisfies ? normalX : -normalX,
      y: test1Satisfies ? normalY : -normalY
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
  const canvasP1 = toCanvasCoords(p1.x, p1.y);
  const canvasP2 = toCanvasCoords(p2.x, p2.y);
  const canvasFar = toCanvasCoords(farPoint.x, farPoint.y);
  
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

// Define a variety of colors for inequality boundaries
const INEQUALITY_COLORS = [
  "#D3263A", // Gryffindor Red
  "#1A612E", // Slytherin Green
  "#0E1A40", // Ravenclaw Blue
  "#F0C75E", // Hufflepuff Yellow
  "#9C27B0", // Purple
  "#2196F3", // Blue
  "#FF9800", // Orange
  "#009688", // Teal
  "#795548", // Brown
  "#607D8B"  // Blue Gray
];

// Function to get a color for an inequality based on index
const getColorForInequality = (index) => {
  return INEQUALITY_COLORS[index % INEQUALITY_COLORS.length];
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
  const [labelCounter, setLabelCounter] = useState(1); // Counter for inequality labels

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
        const parentHeight = containerRef.current.parentElement.clientHeight;
        const isMobile = window.innerWidth < 768;
        
        // For all devices, maximize the available space
        const newWidth = Math.min(containerWidth, parentHeight);
        
        // Keep aspect ratio as 1:1 for a square graph
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

  // Update drawing inequality function to show solution domain selection buttons
  const drawInequality = useCallback((ctx, ineq, isHovered = false) => {
    if (!ineq) return null;
    
    // Always fill solution domains with the inequality's color
    fillHalfPlane(ctx, ineq, ineq.color || getColorForInequality(0), toCanvasCoords, 0.25);
    
    // Draw boundary line with the inequality's color
    const [p1, p2] = getBoundaryPoints(ineq);
    const cp1 = toCanvasCoords(p1.x, p1.y);
    const cp2 = toCanvasCoords(p2.x, p2.y);
    
    // Set line style
    ctx.beginPath();
    ctx.strokeStyle = isHovered ? '#0077cc' : (ineq.color || getColorForInequality(0));
    ctx.lineWidth = isHovered ? 3 : 2;
    
    // For strict inequalities (<, >), use dashed line
    if (ineq.operator === '<' || ineq.operator === '>') {
      ctx.setLineDash([5, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.moveTo(cp1.x, cp1.y);
    ctx.lineTo(cp2.x, cp2.y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line style
    
    // Draw label near the middle of the visible line
    const midX = (cp1.x + cp2.x) / 2;
    const midY = (cp1.y + cp2.y) / 2;
    
    // Draw the inequality label
    ctx.font = "bold italic 16px 'STIX Two Math', 'Times New Roman', serif";
    ctx.fillStyle = ineq.color || getColorForInequality(0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(ineq.label, midX, midY - 20);
    
    // If inequality isn't solved (no selected solution domain), add solution buttons
    if (!ineq.solved) {
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

      // Test points to determine which region is the solution
      const testPoint1 = { 
        x: mid.x - perpX * offset, 
        y: mid.y - perpY * offset 
      };
      
      const testPoint2 = { 
        x: mid.x + perpX * offset, 
        y: mid.y + perpY * offset 
      };
      
      // Check which point satisfies the inequality
      const point1Satisfies = checkPointInInequality(ineq, testPoint1);
      const point2Satisfies = checkPointInInequality(ineq, testPoint2);
      
      // Create buttons with solution status
      const btn1 = {
        x: pos1.x - 30,
        y: pos1.y - 15,
        width: 60,
        height: 30,
        sol: point1Satisfies
      };
      
      const btn2 = {
        x: pos2.x - 30,
        y: pos2.y - 15,
        width: 60,
        height: 30,
        sol: point2Satisfies
      };
      
      // Draw buttons
      ctx.fillStyle = 'rgba(10, 14, 35, 0.8)';
      ctx.strokeStyle = ineq.color;
      
      // Button 1
      ctx.beginPath();
      ctx.roundRect(btn1.x, btn1.y, btn1.width, btn1.height, 5);
      ctx.fill();
      ctx.stroke();
      
      // Button 2
      ctx.beginPath();
      ctx.roundRect(btn2.x, btn2.y, btn2.width, btn2.height, 5);
      ctx.fill();
      ctx.stroke();
      
      // Button text
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Region 1', btn1.x + btn1.width/2, btn1.y + btn1.height/2);
      ctx.fillText('Region 2', btn2.x + btn2.width/2, btn2.y + btn2.height/2);
      
      // Calculate contains function for hit testing
      btn1.contains = (x, y) => (
        x >= btn1.x && x <= btn1.x + btn1.width && 
        y >= btn1.y && y <= btn1.y + btn1.height
      );
      
      btn2.contains = (x, y) => (
        x >= btn2.x && x <= btn2.x + btn2.width && 
        y >= btn2.y && y <= btn2.y + btn2.height
      );
      
      return { eq: ineq, btn1, btn2 };
    }
    
    return null;
  }, [toCanvasCoords, fillHalfPlane]);

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
    setLabelCounter(1);
    
    // Reset the label counter in parser.js
    resetLabelCounter();
    
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
  
  // Ensure solution domains are filled by default
  const FILL_SOLUTIONS = true;

  // In the handleMouseDown, handleMouseMove and handleMouseUp functions, disable panning
  const handleMouseDown = (e) => {
    // Prevent panning action by not setting startPan and isPanning
    // Only keep solution domain clicking functionality
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointClick(x, y);
  };

  const handleMouseMove = (e) => {
    // Do nothing, panning disabled
  };

  const handleMouseUp = (e) => {
    // Do nothing, panning disabled
  };

  const handleMouseLeave = useCallback(() => {
    setDragging(false);
  }, []);

  // Update handleCanvasClick to handle solution region buttons
  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a solution button
    const clickedButton = solutionButtons.find(btn => {
      return (btn.btn1.contains && btn.btn1.contains(x, y)) || 
             (btn.btn2.contains && btn.btn2.contains(x, y));
    });
    
    if (clickedButton) {
      const buttonType = 
        (clickedButton.btn1.contains && clickedButton.btn1.contains(x, y)) ? 
          { button: clickedButton.btn1, type: 'btn1', isSolution: clickedButton.btn1.sol } : 
          { button: clickedButton.btn2, type: 'btn2', isSolution: clickedButton.btn2.sol };
      
      // Mark the inequality as solved with the selected solution
      setInequalities(prev => prev.map(ineq => {
        if (ineq.label === clickedButton.eq.label) {
          return { 
            ...ineq, 
            solved: true, 
            solutionType: buttonType.type,
            isCorrect: buttonType.isSolution
          };
        }
        return ineq;
      }));
      
      // Show message based on whether the selected region is correct
      if (buttonType.isSolution) {
        setQuizMessage(`Correct! You've selected the right solution region for ${clickedButton.eq.label}.`);
      } else {
        setQuizMessage(`Incorrect! The region you selected for ${clickedButton.eq.label} is not the solution.`);
      }
      return;
    }
    
    // Convert canvas coordinates to graph coordinates
    const worldX = (x - origin.x) / zoom;
    const worldY = (origin.y - y) / zoom;
    
    // Handle point selection
    if (isPointMode) {
      handlePointSelection({ x: worldX, y: worldY });
    }
  }, [origin, zoom, isPointMode, handlePointSelection, solutionButtons, setInequalities, setQuizMessage]);

  // Update fillNonSolutionRegion to properly indicate incorrect region
  const fillNonSolutionRegion = useCallback((ctx, eq, toCanvasCoords) => {
    if (!eq.solved) return;
    
    const [p1, p2] = getBoundaryPoints(eq);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    
    // Calculate vectors
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const normalX = -dy / length;
    const normalY = dx / length;
    
    // Test points on both sides of the line
    const testPoint1 = { 
      x: mid.x + normalX, 
      y: mid.y + normalY 
    };
    
    const testPoint2 = { 
      x: mid.x - normalX, 
      y: mid.y - normalY 
    };
    
    // Determine which test point satisfies the inequality
    const test1Satisfies = checkPointInInequality(eq, testPoint1);
    const test2Satisfies = checkPointInInequality(eq, testPoint2);
    
    // For equality, we still need to mark the non-solution region
    let fillDir;
    
    if (eq.solutionType === 'btn1') {
      // If Region 1 was selected, non-solution is Region 2
      fillDir = {
        x: normalX,
        y: normalY
      };
    } else {
      // If Region 2 was selected, non-solution is Region 1
      fillDir = {
        x: -normalX,
        y: -normalY
      };
    }
    
    // Create a region to fill by extending far in the direction of the non-solution region
    const big = 10000;
    const farPoint = {
      x: mid.x + fillDir.x * big,
      y: mid.y + fillDir.y * big
    };
    
    // Convert to canvas coordinates
    const canvasP1 = toCanvasCoords(p1);
    const canvasP2 = toCanvasCoords(p2);
    const canvasFar = toCanvasCoords(farPoint);
    
    // Create a path for the non-solution region
    ctx.beginPath();
    ctx.moveTo(canvasP1.x, canvasP1.y);
    ctx.lineTo(canvasP2.x, canvasP2.y);
    ctx.lineTo(canvasFar.x, canvasFar.y);
    ctx.closePath();
    
    // Fill with a reddish color to indicate non-solution region
    ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
    ctx.fill();
  }, []);

  // Update the redraw function to handle solution domain selection
  const redraw = useCallback(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid and axes
    drawGridAndAxes(ctx, canvasWidth, canvasHeight, zoom, origin);
    
    // Draw inequalities and collect solution buttons
    let buttons = [];
    inequalities.forEach(eq => {
      if (!eq) return;
      const isHighlighted = hoveredEq && hoveredEq.label === eq.label;
      const btnData = drawInequality(ctx, eq, isHighlighted);
      if (btnData) buttons.push(btnData);
    });
    
    // Update solution buttons for click handling
    setSolutionButtons(buttons);
    
    // Draw intersection points
    intersectionPoints.forEach(pt => {
      const cpt = toCanvasCoords(pt.x, pt.y);
      
      // Draw point glow based on status
      if (pt.status === POINT_STATUS.ACTIVE) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 109, 0, 0.3)';
        ctx.arc(cpt.x, cpt.y, 8, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      if (pt.status === POINT_STATUS.SOLVED) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(46, 125, 50, 0.2)';
        ctx.arc(cpt.x, cpt.y, 12, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Draw main point
      ctx.beginPath();
      ctx.arc(cpt.x, cpt.y, 4, 0, 2 * Math.PI);
      
      switch (pt.status) {
        case POINT_STATUS.SOLVED:
          ctx.fillStyle = '#2e7d32';
          ctx.fill();
          
          ctx.font = "bold 14px 'STIX Two Math', 'Times New Roman', serif";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          const text = `(${pt.correct.x.toFixed(1)}, ${pt.correct.y.toFixed(1)})`;
          ctx.fillStyle = '#1b5e20';
          ctx.fillText(text, cpt.x + 8, cpt.y - 8);
          break;
        case POINT_STATUS.ACTIVE:
          ctx.fillStyle = '#ff6d00';
          ctx.fill();
          break;
        case POINT_STATUS.PARTIAL:
          ctx.fillStyle = '#c62828';
          ctx.fill();
          break;
        default:
          ctx.fillStyle = '#000';
          ctx.fill();
      }
    });
    
    // Draw selected point if any
    if (selectedPoint) {
      const canvasPoint = toCanvasCoords(selectedPoint.x, selectedPoint.y);
      ctx.beginPath();
      ctx.arc(canvasPoint.x, canvasPoint.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(211, 166, 37, 0.7)';
      ctx.fill();
      ctx.strokeStyle = '#D3A625';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw coordinates
      ctx.font = "bold 14px 'Cinzel', serif";
      ctx.fillStyle = '#D3A625';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`(${selectedPoint.x.toFixed(1)}, ${selectedPoint.y.toFixed(1)})`, 
                  canvasPoint.x, canvasPoint.y - 15);
    }
  }, [inequalities, zoom, drawInequality, toCanvasCoords, canvasWidth, canvasHeight, 
      intersectionPoints, origin, hoveredEq, selectedPoint, setSolutionButtons]);

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

  // Update useImperativeHandle to use sequential inequality labels
  useImperativeHandle(ref, () => ({
    handleAddInequality: (inputText) => {
      const result = parseInequality(inputText);
      if (!result) {
        setQuizMessage("Incorrect spell format. Try examples like: x+y<0, 2x-3y+1≥0, x>-2");
        return false;
      }
      
      // Check if inequality already exists
      if (inequalities.some(ineq => 
        Math.abs(ineq.a - result.a) < EPSILON && 
        Math.abs(ineq.b - result.b) < EPSILON && 
        Math.abs(ineq.c - result.c) < EPSILON &&
        ineq.operator === result.operator
      )) {
        return 'EXISTS';
      }
      
      // Find the highest index currently in use
      let maxIndex = 0;
      inequalities.forEach(ineq => {
        if (ineq && ineq.label) {
          // Extract the number from labels like "d1", "d2", etc.
          const match = ineq.label.match(/d(\d+)/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxIndex) maxIndex = num;
          }
        }
      });
      
      // Create a new inequality with the next sequential label
      const newIneq = {
        ...result,
        label: `d${maxIndex + 1}`,
        color: getColorForInequality(maxIndex)
      };
      
      // Add inequality to list
      setInequalities(prev => [...prev, newIneq]);
      
      // Clear any previous message
      setQuizMessage('');
      return true;
    },
    resetView: () => {
      resetView();
      setInequalities([]);
    }
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
      
      {/* Reset View Button */}
      <button 
        className="reset-view-button"
        onClick={resetView}
        title="Reset View"
      >
        <i className="material-icons">restart_alt</i>
        Reset View
      </button>
      
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
  // Create gradient background with magical effect
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, 'rgba(14, 26, 64, 0.8)');
  gradient.addColorStop(1, 'rgba(14, 26, 64, 0.9)');

  // Draw button background with rounded corners
  ctx.fillStyle = gradient;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();

  // Draw text with glow effect
  ctx.font = "bold 14px 'Cinzel', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x + width/2, y + height/2);
  
  // Reset shadow
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  return {
    x, y, width, height,
    contains: (px, py) => px >= x && px <= x + width && py >= y && py <= y + height,
    draw: (isHovered) => {
      if (isHovered) {
        // Draw hover effect
        ctx.fillStyle = `rgba(211, 166, 37, 0.3)`;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 8);
        ctx.fill();
      }
    }
  };
};

export default CoordinatePlane;