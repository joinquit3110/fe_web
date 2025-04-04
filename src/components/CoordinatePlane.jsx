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

  // Rest of drawing code remains the same
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
  // Canvas and state for positioning
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(CANVAS_CONFIG.width);
  const [height, setHeight] = useState(CANVAS_CONFIG.height);
  const [zoom, setZoom] = useState(CANVAS_CONFIG.defaultZoom);
  const [origin, setOrigin] = useState({ x: width / 2, y: height / 2 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [points, setPoints] = useState([]);
  const [pointMode, setPointMode] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [activeInequality, setActiveInequality] = useState(null);
  const [solutionButtons, setSolutionButtons] = useState([]);
  const [intersectionPoints, setIntersectionPoints] = useState([]); // Store all valid intersection points
  const [activePoint, setActivePoint] = useState(null); // Currently selected point for input
  const [inputCoords, setInputCoords] = useState({ x: '', y: '' }); // User input coordinates
  const [activeLines, setActiveLines] = useState([]); // State to store lines forming the active point

  const originMemo = useMemo(() => ({
    x: width / 2,
    y: height / 2
  }), [width, height]); // Empty dependency array since values are constants

  const toCanvasCoords = useCallback((x, y) => ({
    x: origin.x + x * zoom,
    y: origin.y - y * zoom
  }), [zoom, origin]);

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
      x: width / 2, 
      y: height / 2
    });
    setIsDragging(false);
    setPointMode(false);
    setQuizMode(false);
    setSelectedPoint(null);
    setActiveInequality(null);
    setPoints([]);
    
    // Add magical reset animation
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = 'rgba(211, 166, 37, 0.2)';
      ctx.beginPath();
      ctx.arc(width/2, height/2, Math.max(width, height), 0, Math.PI * 2);
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
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid and axes
    drawGridAndAxes(ctx, width, height, zoom, origin);
    
    // Draw all inequalities
    inequalities.forEach(ineq => {
      const isHovered = hoveredEq?.label === ineq.label;
      drawInequality(ctx, ineq, isHovered);
    });
    
    // Draw points if any
    points.forEach(point => {
      drawPoint(ctx, point);
    });
  };
  
  // Update the mouse interaction functions to include magical effects
  const handleMouseDown = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Add magical effect on click
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.save();
      ctx.fillStyle = 'rgba(211, 166, 37, 0.1)';
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Original mouse down code
    setIsDragging(true);
    setDragStart({ x, y });
    
    // Handle point mode if active
    if (pointMode) {
      // Convert canvas coordinates to graph coordinates
      const worldX = (x - origin.x) / zoom;
      const worldY = (origin.y - y) / zoom;
      
      handlePointSelection({ x: worldX, y: worldY });
      return;
    }
  };

  // Cập nhật handleCanvasClick để xử lý việc bấm vào điểm đang chọn
  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
  
    // Check for point clicks
    const clickedPoint = intersectionPoints.find(pt => {
      const cpt = toCanvasCoords(pt.x, pt.y);
      const distance = Math.sqrt(
        Math.pow(clickX - cpt.x, 2) + 
        Math.pow(clickY - cpt.y, 2)
      );
      return distance < 8;
    });
  
    if (clickedPoint) {
      // If clicking on currently active point -> deselect
      if (activePoint && 
          Math.abs(clickedPoint.x - activePoint.x) < EPSILON && 
          Math.abs(clickedPoint.y - activePoint.y) < EPSILON) {
        setActivePoint(null);
        setActiveLines([]);
        return;
      }
  
      // Find lines forming this point
      const lines = inequalities.filter(eq => {
        if (!eq.solved) return false;
        return Math.abs(eq.a * clickedPoint.x + eq.b * clickedPoint.y + eq.c) < EPSILON;
      });
  
      // Handle solved and unsolved points differently
      if (clickedPoint.status === POINT_STATUS.SOLVED) {
        // For solved points, only highlight lines and don't change point status
        setActivePoint(clickedPoint);
        setActiveLines(lines);
      } else {
        // For unsolved points, show input fields and change status to active
        setActivePoint(clickedPoint);
        setActiveLines(lines);
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
      return;
    }
  
    // Reset when clicking elsewhere
    setActivePoint(null);
    setActiveLines([]);
    
    // If no point was clicked, handle solution buttons
    if (!activePoint) {
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
          setQuizMessage(isCorrect ? "Correct! Well done!" : "Incorrect, please try again!");
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
          setQuizMessage(isCorrect ? "Correct! Well done!" : "Incorrect, please try again!");
          if (isCorrect) {
            setInequalities(prev =>
              prev.map(it => it.label === eq.label ? 
                { ...it, solved: true } : it)
            );
          }
          return;
        }
      }
    }
  }, [intersectionPoints, toCanvasCoords, activePoint, inequalities, solutionButtons, setActivePoint, setActiveLines, setQuizMessage, setIntersectionPoints, setInequalities]);

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

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
  
    // Convert mouse coordinates to mathematical coordinates
    const mathCoords = {
      x: (mouseX - origin.x) / zoom,
      y: (origin.y - mouseY) / zoom
    };
  
    let foundEq = null;
  
    // Check each inequality
    for (const eq of inequalities) {
      const [p1, p2] = getBoundaryPoints(eq);
      const pt1 = toCanvasCoords(p1.x, p1.y);
      const pt2 = toCanvasCoords(p2.x, p2.y);
  
      // Check if mouse is near line
      const A = mouseX - pt1.x;
      const B = mouseY - pt1.y;
      const C = pt2.x - pt1.x;
      const D = pt2.y - pt1.y;
  
      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      const param = len_sq !== 0 ? dot / len_sq : -1;
  
      let distance;
      if (param < 0) {
        distance = Math.sqrt(A * A + B * B);
      } else if (param > 1) {
        distance = Math.sqrt((mouseX - pt2.x) * (mouseX - pt2.x) + 
                           (mouseY - pt2.y) * (mouseY - pt2.y));
      } else {
        distance = Math.abs(A * D - B * C) / Math.sqrt(len_sq);
      }
  
      // Check if mouse is in solution region or near line
      const isNearLine = distance < 5;
      const isInRegion = eq.solved && isPointInSolutionRegion(mathCoords, eq);
  
      if (isNearLine || isInRegion) {
        foundEq = eq;
        break;
      }
    }
  
    // Update hoveredEq and cursor
    setHoveredEq(foundEq);
    const isOverButton = solutionButtons.some(btn => 
      (mouseX >= btn.btn1.x && mouseX <= btn.btn1.x + btn.btn1.width &&
       mouseY >= btn.btn1.y && mouseY <= btn.btn1.y + btn.btn1.height) ||
      (mouseX >= btn.btn2.x && mouseX <= btn.btn2.x + btn.btn2.width &&
       mouseY >= btn.btn2.y && mouseY <= btn.btn2.y + btn.btn2.height)
    );
    
    canvasRef.current.style.cursor = isOverButton || foundEq ? 'pointer' : 'default';
  }, [inequalities, toCanvasCoords, zoom, origin, solutionButtons, setHoveredEq]);

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

  // Function to draw a point
  const drawPoint = (ctx, point) => {
    const { x, y } = toCanvasCoords(point.x, point.y);
    
    ctx.save();
    
    // Draw point with magical glow effect
    ctx.shadowColor = point.color || '#D3A625';
    ctx.shadowBlur = 10;
    
    ctx.fillStyle = point.color || '#D3A625';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw coordinates if showing
    if (point.showCoords) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`, x, y - 15);
    }
    
    ctx.restore();
  };
  
  // Function to handle point selection
  const handlePointSelection = (point) => {
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
    
    // Set quiz message based on result
    if (satisfiesAll) {
      setQuizMessage(`Correct! Point (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) satisfies all inequalities.`);
    } else {
      setQuizMessage(`Point (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) doesn't satisfy all inequalities.`);
    }
  };

  return (
    <div className="coordinate-plane-container">
      <canvas
        ref={canvasRef}
        width={CANVAS_CONFIG.width}
        height={CANVAS_CONFIG.height}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{
          border: "1px solid #ccc",
          cursor: "default",
          marginLeft: "10px",
          backgroundColor: "#ffffff"
        }}
      />
      {activePoint && (
        <div className="coordinate-input-below">
          <span>(</span>
          <div className="coordinate-box">
            <input 
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