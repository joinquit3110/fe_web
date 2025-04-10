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

// Thêm kiểu điểm theo status
const POINT_STYLE = {
  [POINT_STATUS.UNSOLVED]: { color: '#ffffff', borderColor: '#740001', radius: 5 },
  [POINT_STATUS.ACTIVE]: { color: '#FFC107', borderColor: '#FF6F00', radius: 6 },
  [POINT_STATUS.PARTIAL]: { color: '#FF9800', borderColor: '#F57C00', radius: 5 },
  [POINT_STATUS.SOLVED]: { color: '#4CAF50', borderColor: '#2E7D32', radius: 5 }
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
  // Thêm kiểm tra nếu b gần bằng 0 thì coi như đường thẳng thẳng đứng
  if (Math.abs(eq.b) < EPSILON) {
    // Đảm bảo a khác 0 để tránh chia cho 0
    if (Math.abs(eq.a) < EPSILON) {
      // Nếu cả a và b đều gần bằng 0, trả về mặc định để tránh lỗi
      return [{ x: -big, y: 0 }, { x: big, y: 0 }];
    }
    const x = -eq.c / eq.a;
    // Kiểm tra nếu x là NaN hoặc Infinity
    if (isNaN(x) || !isFinite(x)) {
      return [{ x: 0, y: -big }, { x: 0, y: big }];
    }
    return [{ x, y: -big }, { x, y: big }];
  }
  
  // Tính các điểm cho đường thẳng có độ dốc hữu hạn
  const y1 = -(eq.c + eq.a * (-big)) / eq.b;
  const y2 = -(eq.c + eq.a * big) / eq.b;
  
  // Kiểm tra nếu các tọa độ là NaN hoặc Infinity
  if (isNaN(y1) || !isFinite(y1) || isNaN(y2) || !isFinite(y2)) {
    return [{ x: -big, y: 0 }, { x: big, y: 0 }];
  }
  
  return [
    { x: -big, y: y1 },
    { x: big, y: y2 }
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

// Modify the fillHalfPlane function to NOT color the solution region initially
const fillHalfPlane = (ctx, eq, fillColor, toCanvasCoords, alpha = 0.3) => {
  // Skip automatic coloring of solution regions
  if (!eq.forceFill) {
    return;
  }
  
  // Lấy các điểm boundary
  const [p1, p2] = getBoundaryPoints(eq);
  
  // Kiểm tra các tọa độ
  if (isNaN(p1.x) || !isFinite(p1.x) || isNaN(p1.y) || !isFinite(p1.y) ||
      isNaN(p2.x) || !isFinite(p2.x) || isNaN(p2.y) || !isFinite(p2.y)) {
    console.error('Invalid coordinates for fillHalfPlane:', eq);
    return;
  }
  
  // Calculate midpoint
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  
  // Kiểm tra midpoint
  if (isNaN(mid.x) || !isFinite(mid.x) || isNaN(mid.y) || !isFinite(mid.y)) {
    console.error('Invalid midpoint for fillHalfPlane:', mid);
    return;
  }
  
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
  
  // Convert the boundary points to canvas coordinates for drawing
  const canvasP1 = toCanvasCoords(p1.x, p1.y);
  const canvasP2 = toCanvasCoords(p2.x, p2.y);
  const canvasFar = toCanvasCoords(farPoint.x, farPoint.y);
  
  // Draw filled path
  ctx.beginPath();
  ctx.moveTo(canvasP1.x, canvasP1.y);
  ctx.lineTo(canvasP2.x, canvasP2.y);
  ctx.lineTo(canvasFar.x, canvasFar.y);
  ctx.closePath();
  
  // Get RGBA color for fill
  let fillRgba;
  if (typeof fillColor === 'string') {
    // Convert hex color to rgba for transparency
    fillRgba = hexToRgba(fillColor, alpha);
  } else {
    // Default fallback
    fillRgba = `rgba(0, 0, 255, ${alpha})`;
  }
  
  ctx.fillStyle = fillRgba;
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

// Add the hexToRgba function definition back in 
const hexToRgba = (hex, alpha = 0.3) => {
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
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Main component
const CoordinatePlane = forwardRef(({ inequalities, setInequalities, setQuizMessage, hoveredEq, setHoveredEq, onInequalityClick, setRelatedToIntersection }, ref) => {
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
  const [relatedInequalities, setRelatedInequalities] = useState([]); // Bất phương trình liên quan đến giao điểm đang chọn
  const [showInputValidation, setShowInputValidation] = useState(false); // Thêm state để kiểm soát việc hiển thị màu
  const [showSpellInput, setShowSpellInput] = useState(false); // Hiển thị khung nhập spell
  const [spellInput, setSpellInput] = useState(''); // Input cho spell

  const originMemo = useMemo(() => ({
    x: canvasWidth / 2,
    y: canvasHeight / 2
  }), [canvasWidth, canvasHeight]);

  // Function to convert mathematical coordinates to canvas coordinates
  const toCanvasCoords = useCallback((x, y) => {
    // Kiểm tra input hợp lệ
    if (isNaN(x) || !isFinite(x) || isNaN(y) || !isFinite(y) ||
        isNaN(origin.x) || !isFinite(origin.x) || 
        isNaN(origin.y) || !isFinite(origin.y) ||
        isNaN(zoom) || !isFinite(zoom)) {
      console.error('Invalid coordinates in toCanvasCoords:', { x, y, origin, zoom });
      return { x: 0, y: 0 }; // Trả về giá trị mặc định an toàn
    }
    
    return {
    x: origin.x + x * zoom,
    y: origin.y - y * zoom
    };
  }, [origin, zoom]);

  // Function to convert canvas coordinates to mathematical coordinates
  const toMathCoords = useCallback((canvasX, canvasY) => {
    // Kiểm tra input hợp lệ
    if (isNaN(canvasX) || !isFinite(canvasX) || 
        isNaN(canvasY) || !isFinite(canvasY) ||
        isNaN(origin.x) || !isFinite(origin.x) || 
        isNaN(origin.y) || !isFinite(origin.y) ||
        isNaN(zoom) || !isFinite(zoom)) {
      console.error('Invalid coordinates in toMathCoords:', { 
        canvasX, canvasY, origin, zoom 
      });
      return { x: 0, y: 0 }; // Trả về giá trị mặc định an toàn
    }
    
    return {
      x: (canvasX - origin.x) / zoom,
      y: (origin.y - canvasY) / zoom
    };
  }, [origin, zoom]);

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

  // Thêm state cho pinch zoom trên mobile
  const [touchState, setTouchState] = useState({
    initialDistance: 0,
    initialZoom: CANVAS_CONFIG.defaultZoom
  });

  // Xử lý touch start
  const handleTouchStart = (e) => {
    e.preventDefault(); // Ngăn các hành vi mặc định như scroll
    
    const touches = Array.from(e.touches);
    
    // Chỉ xử lý pinch zoom với 2 ngón tay
    if (touches.length === 2) {
      setTouchState({
        initialDistance: getDistance(touches[0], touches[1]),
        initialZoom: zoom
      });
    }
    
    // Nếu bấm 1 ngón tay, xử lý như mousedown để chọn point hoặc line
    if (touches.length === 1) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touches[0].clientX - rect.left;
      const y = touches[0].clientY - rect.top;
      handlePointClick(x, y);
    }
  };

  // Xử lý touch move
  const handleTouchMove = (e) => {
    e.preventDefault();
    
    const touches = Array.from(e.touches);
    
    // Chỉ hỗ trợ pinch zoom với 2 ngón tay
    if (touches.length === 2 && touchState.initialDistance > 0) {
      // Tính toán khoảng cách mới giữa 2 ngón tay
      const currentDistance = getDistance(touches[0], touches[1]);
      
      // Tính toán tỷ lệ zoom
      const scaleFactor = currentDistance / touchState.initialDistance;
      const newZoom = Math.max(CANVAS_CONFIG.minZoom, Math.min(100, touchState.initialZoom * scaleFactor));
      
      // Cập nhật zoom
      setZoom(newZoom);
      redraw();
    }
  };

  // Xử lý touch end
  const handleTouchEnd = (e) => {
    // Reset touch state
    setTouchState({
      initialDistance: 0,
      initialZoom: CANVAS_CONFIG.defaultZoom
    });
  };

  // Hàm tính khoảng cách giữa 2 touch points
  const getDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Sửa lại hàm drawPoint để hiển thị điểm với màu khác nhau theo status
  const drawPoint = useCallback((ctx, point) => {
    const canvasPoint = toCanvasCoords(point.x, point.y);
    const style = POINT_STYLE[point.status || POINT_STATUS.UNSOLVED];
    
    // Vẽ đường viền
    ctx.beginPath();
    ctx.arc(canvasPoint.x, canvasPoint.y, style.radius + 2, 0, 2 * Math.PI);
    ctx.fillStyle = style.borderColor;
    ctx.fill();
    
    // Vẽ điểm
    ctx.beginPath();
    ctx.arc(canvasPoint.x, canvasPoint.y, style.radius, 0, 2 * Math.PI);
    ctx.fillStyle = style.color;
    ctx.fill();
    
    // Thêm hiệu ứng phát sáng cho điểm đang active
    if (point.status === POINT_STATUS.ACTIVE) {
      ctx.beginPath();
      ctx.arc(canvasPoint.x, canvasPoint.y, style.radius + 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
      ctx.fill();
    }
  }, [toCanvasCoords]);

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

  // Add a function to manually highlight an inequality
  const highlightInequality = useCallback((inequality) => {
    if (inequality) {
      setHoveredEq(inequality);
      setActiveInequality(inequality);
      
      // Also scroll to the inequality in the list when it's highlighted
      if (typeof onInequalityClick === 'function') {
        onInequalityClick(inequality);
      }
      
      redraw();
    }
  }, [onInequalityClick]);

  // Modify the drawInequality function to apply more prominent highlighting
  const drawInequality = useCallback((ctx, ineq, isHighlighted = false) => {
    if (!ineq) return null;
    
    // Get boundary points in mathematical coordinates
    const [p1, p2] = getBoundaryPoints(ineq);
    
    // Convert to canvas coordinates
    const cp1 = toCanvasCoords(p1.x, p1.y);
    const cp2 = toCanvasCoords(p2.x, p2.y);
    
    // Kiểm tra tọa độ có hợp lệ không
    if (isNaN(cp1.x) || !isFinite(cp1.x) || isNaN(cp1.y) || !isFinite(cp1.y) ||
        isNaN(cp2.x) || !isFinite(cp2.x) || isNaN(cp2.y) || !isFinite(cp2.y)) {
      console.error('Invalid coordinates for drawing inequality:', ineq);
      return null;
    }
    
    // Check if this inequality is related to the active intersection point
    const isRelatedToIntersection = relatedInequalities.some(
      relEq => relEq.label === ineq.label
    );
    
    // Set line style based on operator with enhanced highlighting
    if (isRelatedToIntersection) {
      // Highlight in green for inequalities related to the current intersection point
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#2E7D32"; // Green color for intersection related inequalities
      
      // Add green glow effect for intersection related lines
      ctx.shadowColor = "#2E7D32";
      ctx.shadowBlur = 12;
    } else if (isHighlighted) {
      // More prominent highlight style
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#FF9800"; // Bright orange for better visibility
      
      // Add glow effect for highlighted lines
      ctx.shadowColor = "#FF9800";
      ctx.shadowBlur = 10;
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = ineq.color || getColorForInequality(0);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
    
    // For inequalities solved correctly, we need to fill the non-solution region
    if (ineq.solved && ineq.isCorrect) {
      // Find which region is NOT the solution
      const oppositeSolutionType = ineq.solutionType === 'btn1' ? 'btn2' : 'btn1';
      
      // Create a temporary equation with the opposite solution type to fill
      const nonSolutionEq = {
        ...ineq,
        solutionType: oppositeSolutionType,
        forceFill: true
      };
      
      // Fill the non-solution region with a light red color and border
      const borderColor = "#CD2A2A";  // Error color from CSS variables
      const fillColor = "#FF8A80";    // Lighter shade of red
      
      // First draw the border
      ctx.lineWidth = 2;
      ctx.strokeStyle = borderColor;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const normalX = -dy / length;
      const normalY = dx / length;
      
      // Determine which direction to fill based on solution type
      let fillDir;
      if (ineq.solutionType === 'btn1') {
        fillDir = {
          x: normalX,
          y: normalY
        };
      } else {
        fillDir = {
          x: -normalX,
          y: -normalY
        };
      }
      
      // Create a region to fill
      const big = 10000;
      const farPoint = {
        x: mid.x + fillDir.x * big,
        y: mid.y + fillDir.y * big
      };
      
      // Convert to canvas coordinates
      const canvasP1 = toCanvasCoords(p1.x, p1.y);
      const canvasP2 = toCanvasCoords(p2.x, p2.y);
      const canvasFar = toCanvasCoords(farPoint.x, farPoint.y);
      
      // Draw the non-solution area with a slightly transparent fill
    ctx.beginPath();
      ctx.moveTo(canvasP1.x, canvasP1.y);
      ctx.lineTo(canvasP2.x, canvasP2.y);
      ctx.lineTo(canvasFar.x, canvasFar.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 138, 128, 0.3)"; // Lighter shade of red with transparency
      ctx.fill();
      ctx.stroke();
      
      // Reset line style for the boundary line
      if (isRelatedToIntersection) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#2E7D32";
        ctx.shadowColor = "#2E7D32";
        ctx.shadowBlur = 12;
      } else if (isHighlighted) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#FF9800";
        ctx.shadowColor = "#FF9800";
        ctx.shadowBlur = 10;
      } else {
        ctx.lineWidth = 2;
        ctx.strokeStyle = ineq.color || getColorForInequality(0);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }
    
    // For strict inequalities (<, >), use dashed line
    if (ineq.operator === '<' || ineq.operator === '>') {
      ctx.setLineDash([5, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    ctx.moveTo(cp1.x, cp1.y);
    ctx.lineTo(cp2.x, cp2.y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line style
    
    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    
    // Draw label near the middle of the visible line
    const midX = (cp1.x + cp2.x) / 2;
    const midY = (cp1.y + cp2.y) / 2;
    
    // Draw the inequality label - removed to hide d1, d2, d3 labels
    // ctx.font = "bold italic 16px 'STIX Two Math', 'Times New Roman', serif";
    // ctx.fillStyle = ineq.color || getColorForInequality(0);
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'middle';
    // ctx.fillText(ineq.label, midX, midY - 20);
    
    // If inequality isn't solved correctly yet, add solution buttons
    if (!ineq.solved || (ineq.solved && !ineq.isCorrect)) {
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
        x: pos1.x - 40,
        y: pos1.y - 15,
        width: 80,
        height: 30,
        sol: point1Satisfies
      };
      
      const btn2 = {
        x: pos2.x - 40,
        y: pos2.y - 15,
        width: 80,
        height: 30,
        sol: point2Satisfies
      };

      // Draw beautiful buttons (Harry Potter theme style)
      // Region 1 Button
      ctx.fillStyle = 'rgba(14, 26, 64, 0.9)'; // Darker background
      ctx.strokeStyle = '#D3A625'; // Gold border
      ctx.lineWidth = 2;
      
      // Button 1 with rounded rectangle and glow
      ctx.beginPath();
      ctx.roundRect(btn1.x, btn1.y, btn1.width, btn1.height, 6);
      ctx.shadowColor = 'rgba(240, 199, 94, 0.5)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.stroke();
      
      // Button 2
      ctx.beginPath();
      ctx.roundRect(btn2.x, btn2.y, btn2.width, btn2.height, 6);
      ctx.shadowColor = 'rgba(240, 199, 94, 0.5)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.stroke();
      
      // Add gradient effect to buttons
      const gradient1 = ctx.createLinearGradient(btn1.x, btn1.y, btn1.x, btn1.y + btn1.height);
      gradient1.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      gradient1.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient1;
      ctx.beginPath();
      ctx.roundRect(btn1.x, btn1.y, btn1.width, btn1.height/2, 6, 6, 0, 0);
      ctx.fill();
      
      ctx.beginPath();
      ctx.roundRect(btn2.x, btn2.y, btn2.width, btn2.height/2, 6, 6, 0, 0);
      ctx.fill();
      
      // Button text
      ctx.fillStyle = '#F0C75E'; // Gold text
      ctx.font = 'bold 13px "Cinzel", serif';
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
  }, [toCanvasCoords, relatedInequalities]);

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
      drawPoint(ctx, point);
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
    // Only handle hover effects for points/buttons, no panning
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Get mathematical coordinates
    const mathCoords = toMathCoords(x, y);
    
    // Initialize buttonHovered variable at the beginning of the function
    let buttonHovered = false;
    
    // Check if hovering over any inequality line
    let lineHovered = false;
    inequalities.forEach(ineq => {
      if (!ineq) return;
      
      // Get the line equation: ax + by + c = 0
      const a = ineq.a;
      const b = ineq.b;
      const c = ineq.c;
      
      // Calculate the distance from point to line
      // Distance = |ax + by + c| / sqrt(a² + b²)
      const distance = Math.abs(a * mathCoords.x + b * mathCoords.y + c) / Math.sqrt(a * a + b * b);
      
      // If close enough to the line, consider it a hover (adjust tolerance based on zoom)
      const hoverTolerance = 0.3 / (zoom / 25); // Scaled by zoom level
      if (distance < hoverTolerance) {
        lineHovered = true;
        setHoveredEq(ineq);
        redraw();
      }
    });
    
    // If not hovering over any line and we had a previously hovered equation, clear it
    if (!lineHovered && !buttonHovered && hoveredEq) {
      setHoveredEq(null);
      redraw();
    }
    
    // Check for solution buttons hover
    buttonHovered = false; // Reset to ensure proper state
    solutionButtons.forEach(btn => {
      if ((btn.btn1.contains && btn.btn1.contains(x, y)) || 
          (btn.btn2.contains && btn.btn2.contains(x, y))) {
        buttonHovered = true;
        // Redraw to show hover effect
        redraw();
      }
    });
    
    if (!buttonHovered && !lineHovered) {
      // Handle point hover
      const hoverTolerance = 20 / zoom; // Adjust based on zoom level
      
      // Check if hovering over an intersection point
      let isHovering = false;
      intersectionPoints.forEach(point => {
        const dx = point.x - mathCoords.x;
        const dy = point.y - mathCoords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < hoverTolerance) {
          isHovering = true;
          setHoveredIntersection(point);
          redraw();
        }
      });
      
      if (!isHovering && hoveredIntersection) {
        setHoveredIntersection(null);
        redraw();
      }
    }
  };

  const handleMouseUp = (e) => {
    // Do nothing, panning disabled
  };

  const handleMouseLeave = useCallback(() => {
    setDragging(false);
  }, []);

  // Update the redraw function to handle solution domain selection
  const redraw = useCallback(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Kiểm tra các tọa độ origin và canvas width/height
    if (isNaN(origin.x) || !isFinite(origin.x) || 
        isNaN(origin.y) || !isFinite(origin.y) ||
        isNaN(canvasWidth) || !isFinite(canvasWidth) ||
        isNaN(canvasHeight) || !isFinite(canvasHeight) ||
        isNaN(zoom) || !isFinite(zoom)) {
      console.error('Invalid canvas parameters:', { 
        origin, canvasWidth, canvasHeight, zoom 
      });
      // Khôi phục giá trị mặc định
      setOrigin({
        x: canvasWidth / 2,
        y: canvasHeight / 2
      });
      setZoom(CANVAS_CONFIG.defaultZoom);
      return;
    }
    
    // Draw grid and axes
    drawGridAndAxes(ctx, canvasWidth, canvasHeight, zoom, origin);
    
    // Draw inequalities and collect solution buttons
    let buttons = [];
    inequalities.forEach(eq => {
      // Kiểm tra đẳng thức có hợp lệ không
      if (!eq || isNaN(eq.a) || !isFinite(eq.a) || 
          isNaN(eq.b) || !isFinite(eq.b) || 
          isNaN(eq.c) || !isFinite(eq.c)) {
        console.error('Invalid inequality in redraw:', eq);
        return;
      }
      
      const isHighlighted = hoveredEq && hoveredEq.label === eq.label;
      const btnData = drawInequality(ctx, eq, isHighlighted);
      if (btnData) buttons.push(btnData);
    });
    
    // Update solution buttons for click handling
    setSolutionButtons(buttons);

    // Draw intersection points
    intersectionPoints.forEach(pt => {
      // Kiểm tra điểm có hợp lệ không
      if (!pt || isNaN(pt.x) || !isFinite(pt.x) || 
          isNaN(pt.y) || !isFinite(pt.y)) {
        console.error('Invalid intersection point in redraw:', pt);
        return;
      }
      
      drawPoint(ctx, pt);
    });
  }, [inequalities, zoom, drawInequality, toCanvasCoords, canvasWidth, canvasHeight, 
      intersectionPoints, origin, hoveredEq, drawPoint]);

  // Update the handleCanvasClick function to detect clicks on inequality lines
  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to math coordinates for line detection
    const mathCoords = toMathCoords(x, y);
    
    // STEP 1: Check if clicking on an intersection point (HIGHEST PRIORITY)
    const clickedPoint = intersectionPoints.find(pt => {
      const canvasPoint = toCanvasCoords(pt.x, pt.y);
      const distance = Math.sqrt(
        Math.pow(x - canvasPoint.x, 2) + 
        Math.pow(y - canvasPoint.y, 2)
      );
      return distance < 12; // Increased tolerance for easier selection
    });
    
    if (clickedPoint) {
      // If clicking on intersection point, handle it directly here
      if (activePoint && Math.abs(activePoint.x - clickedPoint.x) < EPSILON && 
          Math.abs(activePoint.y - clickedPoint.y) < EPSILON) {
        // Nếu đang bấm vào giao điểm đã chọn, bỏ chọn nó
        setActivePoint(null);
        setRelatedInequalities([]);
        
        // Clear related inequalities in parent component if it exists
        if (typeof setRelatedToIntersection === 'function') {
          setRelatedToIntersection([]);
        }
        
        // Reset trạng thái giao điểm về UNSOLVED hoặc PARTIAL tùy theo trạng thái trước đó
        setIntersectionPoints(points => points.map(pt => {
          if (Math.abs(pt.x - clickedPoint.x) < EPSILON && 
              Math.abs(pt.y - clickedPoint.y) < EPSILON) {
            return { 
              ...pt, 
              status: pt.status === POINT_STATUS.SOLVED ? POINT_STATUS.SOLVED : POINT_STATUS.UNSOLVED 
            };
          }
          return pt;
        }));
        
        setQuizMessage('');
      } else if (clickedPoint.status === POINT_STATUS.SOLVED) {
        // If point is already solved, just show it
        setQuizMessage(`This point is at (${clickedPoint.correct.x.toFixed(1)}, ${clickedPoint.correct.y.toFixed(1)})`);
        
        // Tìm các bất phương trình tạo ra giao điểm này để highlight
        const relatedIneqs = [];
        
        // Check all pairs of inequalities
        for (let i = 0; i < inequalities.length; i++) {
          for (let j = i + 1; j < inequalities.length; j++) {
            const eq1 = inequalities[i];
            const eq2 = inequalities[j];
            
            // Calculate intersection
            const pt = computeIntersection(eq1, eq2);
            
            // Check if this intersection matches our clicked point
            if (pt && Math.abs(pt.x - clickedPoint.x) < EPSILON && Math.abs(pt.y - clickedPoint.y) < EPSILON) {
              // Found the two inequalities that form this intersection
              relatedIneqs.push(eq1);
              relatedIneqs.push(eq2);
              // We can break after finding the matching pair
              break;
            }
          }
          // If we found the inequalities, we can break the outer loop too
          if (relatedIneqs.length === 2) break;
        }
        
        // Update the related inequalities state
        setRelatedInequalities(relatedIneqs);
        
        // Cập nhật relatedToIntersection ở component cha nếu có
        if (typeof setRelatedToIntersection === 'function') {
          setRelatedToIntersection(relatedIneqs);
        }
        
        // Highlight these inequalities in list
        if (relatedIneqs.length > 0 && typeof onInequalityClick === 'function') {
          // Highlight first inequality and scroll to it
          onInequalityClick(relatedIneqs[0]);
        }
      } else if (clickedPoint.status !== POINT_STATUS.SOLVED) {
        setActivePoint(clickedPoint);
        setInputCoords({ x: '', y: '' });
        setShowInputValidation(false);
        setQuizMessage('Please enter the coordinates of the point:');
        
        // Find inequalities that form this intersection point
        const relatedIneqs = [];
        
        // Check all pairs of inequalities
        for (let i = 0; i < inequalities.length; i++) {
          for (let j = i + 1; j < inequalities.length; j++) {
            const eq1 = inequalities[i];
            const eq2 = inequalities[j];
            
            // Calculate intersection
            const pt = computeIntersection(eq1, eq2);
            
            // Check if this intersection matches our clicked point
            if (pt && Math.abs(pt.x - clickedPoint.x) < EPSILON && Math.abs(pt.y - clickedPoint.y) < EPSILON) {
              // Found the two inequalities that form this intersection
              relatedIneqs.push(eq1);
              relatedIneqs.push(eq2);
              // We can break after finding the matching pair
              break;
            }
          }
          // If we found the inequalities, we can break the outer loop too
          if (relatedIneqs.length === 2) break;
        }
        
        // Update the related inequalities state
        setRelatedInequalities(relatedIneqs);
        
        // Cập nhật relatedToIntersection ở component cha nếu có
        if (typeof setRelatedToIntersection === 'function') {
          setRelatedToIntersection(relatedIneqs);
        }
        
        // Highlight these inequalities in list
        if (relatedIneqs.length > 0 && typeof onInequalityClick === 'function') {
          // Highlight first inequality and scroll to it
          onInequalityClick(relatedIneqs[0]);
        }
        
        setIntersectionPoints(points => points.map(pt => {
          if (Math.abs(pt.x - clickedPoint.x) < EPSILON && 
              Math.abs(pt.y - clickedPoint.y) < EPSILON) {
            return { ...pt, status: POINT_STATUS.ACTIVE };
          }
          return pt;
        }));
      }
      
      redraw();
      return;
    }
    
    // STEP 2: Check if clicking on a solution button (MEDIUM PRIORITY)
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
        setQuizMessage(`Incorrect! The region you selected for ${clickedButton.eq.label} is not the solution. Try again.`);
      }
      
      // Đóng UI nhập tọa độ nếu đang mở
      if (activePoint) {
        setActivePoint(null);
      }
      
      // Immediately redraw to show the changes
      redraw();
      return;
    }
    
    // STEP 3: Check if clicking on an inequality line (LOWEST PRIORITY)
    let clickedLine = null;
    let closestDistance = Infinity;
    
    inequalities.forEach(ineq => {
      if (!ineq) return;
      
      // Calculate distance from point to line
      const a = ineq.a;
      const b = ineq.b;
      const c = ineq.c;
      const distance = Math.abs(a * mathCoords.x + b * mathCoords.y + c) / Math.sqrt(a * a + b * b);
      
      // If close enough and closer than previous matches, select this inequality
      const clickTolerance = 0.3 / (zoom / 25); // Same as hover tolerance
      if (distance < clickTolerance && distance < closestDistance) {
        clickedLine = ineq;
        closestDistance = distance;
      }
    });
    
    if (clickedLine) {
      // Nếu đường thẳng này đã được chọn, thì bỏ chọn nó
      if (activeInequality && activeInequality.label === clickedLine.label) {
        setHoveredEq(null);
        setActiveInequality(null);
        
        // Clear related inequalities when deselecting
        setRelatedInequalities([]);
        
        // Clear related inequalities in parent component if it exists
        if (typeof setRelatedToIntersection === 'function') {
          setRelatedToIntersection([]);
        }
      } else {
        // Otherwise, select the clicked line
        setHoveredEq(clickedLine);
        setActiveInequality(clickedLine);
        
        // Call the callback to scroll to this inequality in the list
        if (typeof onInequalityClick === 'function') {
          onInequalityClick(clickedLine);
        }
      }
      
      // Đóng UI nhập tọa độ nếu đang mở
      if (activePoint) {
        setActivePoint(null);
      }
      
      redraw();
      return;
    }
    
    // STEP 4: If none of the above, handle point selection in point mode
    const worldX = (x - origin.x) / zoom;
    const worldY = (origin.y - y) / zoom;
    
    // Đóng UI nhập tọa độ nếu đang mở
    if (activePoint) {
      setActivePoint(null);
      
      // Reset related inequalities
      setRelatedInequalities([]);
      if (typeof setRelatedToIntersection === 'function') {
        setRelatedToIntersection([]);
      }
      
      redraw();
    }
    
    // Nếu đang có điểm giao điểm xanh lá cây được chọn, bỏ chọn nó
    const selectedGreenPoint = intersectionPoints.find(pt => 
      pt.status === POINT_STATUS.SOLVED && 
      Math.abs(pt.x - worldX) < 0.3 && 
      Math.abs(pt.y - worldY) < 0.3
    );
    
    if (selectedGreenPoint) {
      setRelatedInequalities([]);
      if (typeof setRelatedToIntersection === 'function') {
        setRelatedToIntersection([]);
      }
      setQuizMessage('');
      redraw();
    }
    
    if (isPointMode) {
      handlePointSelection({ x: worldX, y: worldY });
    }
  }, [origin, zoom, isPointMode, handlePointSelection, solutionButtons, setInequalities, setQuizMessage, redraw, toMathCoords, onInequalityClick, setRelatedToIntersection, intersectionPoints, toCanvasCoords, setActivePoint, setInputCoords, setRelatedInequalities, inequalities, computeIntersection, activePoint, activeInequality]);

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
    const canvasP1 = toCanvasCoords(p1.x, p1.y);
    const canvasP2 = toCanvasCoords(p2.x, p2.y);
    const canvasFar = toCanvasCoords(farPoint.x, farPoint.y);
    
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
      // Specify the event as non-passive
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
      setShowInputValidation(false);
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
      
      // Clear highlighted inequalities
      setRelatedInequalities([]);
      
      return;
    }
  
    // Handle new point selection
    if (clickedPoint && clickedPoint.status !== POINT_STATUS.SOLVED) {
      setActivePoint(clickedPoint);
      setInputCoords({ x: '', y: '' });
      setShowInputValidation(false);
      setQuizMessage('Please enter the coordinates of the point:');
      
      // Find inequalities that form this intersection point
      const relatedIneqs = [];
      
      // Check all pairs of inequalities
      for (let i = 0; i < inequalities.length; i++) {
        for (let j = i + 1; j < inequalities.length; j++) {
          const eq1 = inequalities[i];
          const eq2 = inequalities[j];
          
          // Calculate intersection
          const pt = computeIntersection(eq1, eq2);
          
          // Check if this intersection matches our clicked point
          if (pt && Math.abs(pt.x - clickedPoint.x) < EPSILON && Math.abs(pt.y - clickedPoint.y) < EPSILON) {
            // Found the two inequalities that form this intersection
            relatedIneqs.push(eq1);
            relatedIneqs.push(eq2);
            // We can break after finding the matching pair
            break;
          }
        }
        // If we found the inequalities, we can break the outer loop too
        if (relatedIneqs.length === 2) break;
      }
      
      // Update the related inequalities state
      setRelatedInequalities(relatedIneqs);
      
      // Cập nhật relatedToIntersection ở component cha nếu có
      if (typeof setRelatedToIntersection === 'function') {
        setRelatedToIntersection(relatedIneqs);
      }
      
      // Highlight these inequalities in list
      if (relatedIneqs.length > 0 && typeof onInequalityClick === 'function') {
        // Highlight first inequality and scroll to it
        onInequalityClick(relatedIneqs[0]);
      }
      
      setIntersectionPoints(points => points.map(pt => {
        if (Math.abs(pt.x - clickedPoint.x) < EPSILON && 
            Math.abs(pt.y - clickedPoint.y) < EPSILON) {
          return { ...pt, status: POINT_STATUS.ACTIVE };
        }
        return pt;
      }));
    }
  }, [intersectionPoints, toCanvasCoords, setActivePoint, setInputCoords, setQuizMessage, activePoint, inequalities, computeIntersection, onInequalityClick, setRelatedToIntersection]);

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

  // Optimize the findValidIntersections function to prevent lag
  const findValidIntersections = useCallback(() => {
    // Use a functional update to avoid dependency on intersectionPoints
    setIntersectionPoints(prevPoints => {
    const newPoints = [];
      
      // Create a map for quick lookup of existing points
      const existingPointsMap = new Map();
      prevPoints.forEach(point => {
        const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
        existingPointsMap.set(key, point);
      });
      
      // Process each pair of inequalities only once
      const processedPairs = new Set();
    
    inequalities.forEach((eq1, i) => {
        inequalities.slice(i + 1).forEach((eq2, j) => {
          // Generate a unique key for this pair
          const pairKey = `${eq1.label}-${eq2.label}`;
      
          // Skip if we've already processed this pair
          if (processedPairs.has(pairKey)) return;
          processedPairs.add(pairKey);
        
          // Calculate intersection
        const pt = computeIntersection(eq1, eq2);
          
          if (pt) {
          // Kiểm tra điểm có nằm trong vùng không phải nghiệm của bất phương trình khác không
          const isInNonSolutionRegion = inequalities.some(eq3 => {
              // Chỉ kiểm tra với các bất phương trình khác
              if (eq3 === eq1 || eq3 === eq2) return false;
              // Kiểm tra xem điểm có nằm trong vùng nghiệm của bất phương trình này không
            const isInSolution = checkPointInInequality(eq3, pt);
            return !isInSolution; // true nếu điểm nằm trong vùng KHÔNG phải nghiệm
          });
  
            // Chỉ hiển thị giao điểm nếu nó KHÔNG nằm trong vùng không phải nghiệm
          if (!isInNonSolutionRegion) {
              // Use a key to quickly check for existing points
              const key = `${pt.x.toFixed(6)},${pt.y.toFixed(6)}`;
  
              if (existingPointsMap.has(key)) {
                // Reuse existing point to preserve status
                newPoints.push(existingPointsMap.get(key));
            } else {
                // Create new point
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
  
      // Compare with previous points to avoid unnecessary updates
      if (prevPoints.length === newPoints.length && 
          prevPoints.every((pt, i) => 
            Math.abs(pt.x - newPoints[i].x) < EPSILON && 
            Math.abs(pt.y - newPoints[i].y) < EPSILON && 
            pt.status === newPoints[i].status)) {
        return prevPoints; // Return previous points to avoid re-render
      }
      
      return newPoints;
    });
  }, [inequalities, computeIntersection, checkPointInInequality]);

  const handleCheckCoordinates = useCallback(() => {
    if (!activePoint) return;
    
    if (inputCoords.x === '' || inputCoords.y === '') {
      setQuizMessage('Please enter both x and y coordinates!');
      return;
    }
  
    // Hiển thị màu validation khi bấm check
    setShowInputValidation(true);

    const userX = Number(inputCoords.x);
    const userY = Number(inputCoords.y);
    const correctX = activePoint.correct.x;
    const correctY = activePoint.correct.y;

    const xCorrect = Math.abs(userX - correctX) < 0.15; // Allow small rounding errors
    const yCorrect = Math.abs(userY - correctY) < 0.15;

    // Get related inequality labels for better feedback
    const relatedLabels = relatedInequalities.map(ineq => ineq.label).join(' and ');
  
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
      setQuizMessage(`Correct! The intersection of ${relatedLabels} is at (${correctX.toFixed(1)}, ${correctY.toFixed(1)}).`);
      
      // Biến mất UI ngay lập tức bằng cách set activePoint = null
      setActivePoint(null);
      
      // Giữ highlight cho các bất phương trình liên quan trong một khoảng thời gian
      setTimeout(() => {
        setRelatedInequalities([]);
        
        // Cập nhật relatedToIntersection ở component cha nếu có
        if (typeof setRelatedToIntersection === 'function') {
          setRelatedToIntersection([]);
        }
      }, 2000);
    } else {
      // Thông báo chi tiết về lỗi
      if (!xCorrect && !yCorrect) {
        setQuizMessage(`Both coordinates are incorrect for the intersection of ${relatedLabels}. Try again!`);
      } else if (!xCorrect) {
        setQuizMessage(`The x-coordinate is incorrect for the intersection of ${relatedLabels}. Try again!`);
      } else {
        setQuizMessage(`The y-coordinate is incorrect for the intersection of ${relatedLabels}. Try again!`);
      }
    }
  }, [activePoint, inputCoords, setQuizMessage, setRelatedToIntersection, relatedInequalities]);

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
      // Reset zoom and pan
      setZoom(CANVAS_CONFIG.defaultZoom);
      setOrigin({ 
        x: canvasWidth / 2, 
        y: canvasHeight / 2 
      });
      
      // Clear any selected/hovered state
      setHoveredEq(null);
      setActiveInequality(null);
      setSelectedPoint(null);
      setHoveredIntersection(null);
      setActivePoint(null);
      setInputCoords({ x: '', y: '' });
      
      // Clear intersection points
      setIntersectionPoints([]);
      
      // Redraw the canvas
      redraw();
    },
    highlightInequality
  }));

  // Xử lý khi bấm nút Cast Spell
  const handleCastSpell = useCallback(() => {
    if (!spellInput) return;
    
    // Hiệu ứng khi cast spell
    setQuizMessage(`Casting spell: "${spellInput}"!`);
    
    // Hiệu ứng trên canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      
      // Hiệu ứng flash
      ctx.fillStyle = 'rgba(211, 166, 37, 0.2)';
      ctx.fillRect(0, 0, width, height);
      
      // Sau đó vẽ lại
      setTimeout(() => {
        redraw();
      }, 300);
    }
    
    // Reset sau khi cast
    setSpellInput('');
    setShowSpellInput(false);
  }, [spellInput, redraw, setQuizMessage]);

  // Xử lý khi bấm nút Avada Kedavra
  const handleFiniteIncantatem = useCallback(() => {
    // Hiệu ứng khi dùng Avada Kedavra
    setQuizMessage("Avada Kedavra! All spells have been cancelled.");
    
    // Reset lại trạng thái
    setActiveInequality(null);
    setActivePoint(null);
    setRelatedInequalities([]);
    if (typeof setRelatedToIntersection === 'function') {
      setRelatedToIntersection([]);
    }
    
    // Hiệu ứng trên canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      
      // Hiệu ứng flash đỏ
      ctx.fillStyle = 'rgba(170, 51, 51, 0.2)';
      ctx.fillRect(0, 0, width, height);
      
      // Sau đó vẽ lại
      setTimeout(() => {
        redraw();
      }, 300);
    }
    
    // Đóng UI spell
    setShowSpellInput(false);
  }, [redraw, setQuizMessage, setActiveInequality, setActivePoint]);

  // Draw button function (moved outside of component)
  return (
    <div ref={containerRef} className="coordinate-plane-wrapper">
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
        style={{ touchAction: 'manipulation' }} /* Allow pinch zoom while blocking page scroll */
      />
      
      {activePoint && (
        <div className="coordinate-input-container">
          <div className="coordinate-input-box">
            <div className="coordinate-input-title">Enter Intersection Point Coordinates:</div>
            <div className="coordinate-input-form">
          <span>(</span>
            <input 
              type="number"
              step="0.1"
              inputMode="decimal"
              value={inputCoords.x}
              onChange={e => setInputCoords(prev => ({ ...prev, x: e.target.value }))}
              className={
                  !showInputValidation ? '' :
                  (inputCoords.x !== '' && Number(inputCoords.x).toFixed(1) === activePoint.correct.x.toFixed(1))
                  ? 'correct' 
                  : 'incorrect'
              }
            />
              <span>,</span>
            <input 
              type="number"
              step="0.1"
              inputMode="decimal"
              value={inputCoords.y}
              onChange={e => setInputCoords(prev => ({ ...prev, y: e.target.value }))}
              className={
                  !showInputValidation ? '' :
                  (inputCoords.y !== '' && Number(inputCoords.y).toFixed(1) === activePoint.correct.y.toFixed(1))
                  ? 'correct' 
                  : 'incorrect'
              }
            />
          <span>)</span>
            </div>
            <button className="check-button" onClick={handleCheckCoordinates}>
              Check
            </button>
          </div>
        </div>
      )}
      {showSpellInput && (
        <div className="spell-input-container">
          <button onClick={handleCastSpell} disabled={!spellInput}>Cast Spell</button>
          <button onClick={handleFiniteIncantatem} className="finite-incantatem-btn">Avada Kedavra</button>
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