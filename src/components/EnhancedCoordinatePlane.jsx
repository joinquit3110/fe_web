import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { 
  parseInequality, 
  resetLabelCounter, 
  checkPointInInequality, 
  isPointOnBoundary,
  getBoundaryPoints, 
  calculateIntersection,
  getHalfPlaneFillDirection,
  themeColors
} from "../utils/inequalityAlgorithms";

// Constants for canvas configuration
const CANVAS_CONFIG = {
  width: 800,
  height: 800,
  minZoom: 20,
  defaultZoom: 40,
  maxZoom: 100,
  panSpeed: 0.8
};

// Solution point status indicators
const POINT_STATUS = {
  UNSOLVED: 'unsolved',    // Not yet attempted
  ACTIVE: 'active',        // Currently being tested
  CORRECT: 'correct',      // Point satisfies all inequalities
  INCORRECT: 'incorrect'   // Point does not satisfy at least one inequality
};

// Enhanced Coordinate Plane Component
const EnhancedCoordinatePlane = forwardRef((props, ref) => {
  const { 
    inequalities, 
    setInequalities, 
    setQuizMessage, 
    hoveredEq, 
    setHoveredEq
  } = props;

  // Canvas and context references
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  
  // State for view control
  const [zoom, setZoom] = useState(CANVAS_CONFIG.defaultZoom);
  const [origin, setOrigin] = useState({ x: CANVAS_CONFIG.width / 2, y: CANVAS_CONFIG.height / 2 });
  
  // State for interaction
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [testPoint, setTestPoint] = useState(null);
  const [pointStatus, setPointStatus] = useState(POINT_STATUS.UNSOLVED);
  const [showControls, setShowControls] = useState(true);
  const [showPointCoordinates, setShowPointCoordinates] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);
  
  // Animation state
  const [fadeEffect, setFadeEffect] = useState(false);

  // Canvas size state
  const [canvasSize, setCanvasSize] = useState({
    width: CANVAS_CONFIG.width,
    height: CANVAS_CONFIG.height
  });

  // Track solution regions for each inequality
  const [solutionRegions, setSolutionRegions] = useState({});

  // Conversion functions between canvas and mathematical coordinates
  const toMathCoords = useCallback((canvasX, canvasY) => {
    return {
      x: (canvasX - origin.x) / zoom,
      y: (origin.y - canvasY) / zoom
    };
  }, [origin, zoom]);

  const toCanvasCoords = useCallback((mathX, mathY) => {
    return {
      x: origin.x + mathX * zoom,
      y: origin.y - mathY * zoom
    };
  }, [origin, zoom]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Set up canvas and context
    const canvas = canvasRef.current;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;
    
    // Initial render
    drawEverything();
    
    // Add resize handler
    const handleResize = () => {
      // Get the container dimensions
      const container = canvas.parentElement;
      if (!container) return;
      
      const { width, height } = container.getBoundingClientRect();
      
      // Update canvas size
      if (width > 0 && height > 0) {
        setCanvasSize({
          width: Math.min(width, CANVAS_CONFIG.width),
          height: Math.min(height, CANVAS_CONFIG.height)
        });
      }
    };
    
    // Initial resize and event listener
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasSize]);

  // Update canvas when relevant state changes
  useEffect(() => {
    drawEverything();
  }, [
    zoom, 
    origin, 
    inequalities, 
    hoveredEq, 
    testPoint, 
    pointStatus, 
    showControls,
    selectedRegion,
    showPointCoordinates,
    canvasSize,
    solutionRegions
  ]);
  
  // Fade effect for visual feedback
  useEffect(() => {
    if (fadeEffect) {
      const timer = setTimeout(() => setFadeEffect(false), 800);
      return () => clearTimeout(timer);
    }
  }, [fadeEffect]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Check if clicked on a region selection button
    const activeInequality = inequalities.find(ineq => ineq.showRegionButtons);
    if (activeInequality) {
      // Get button positions
      const buttonPositions = getRegionButtonPositions(activeInequality);
      
      // Check if clicked on button 1
      if (
        canvasX >= buttonPositions.btn1.x &&
        canvasX <= buttonPositions.btn1.x + 60 &&
        canvasY >= buttonPositions.btn1.y &&
        canvasY <= buttonPositions.btn1.y + 30
      ) {
        // Select region 1
        handleRegionSelection(activeInequality, 'btn1');
        return;
      }
      
      // Check if clicked on button 2
      if (
        canvasX >= buttonPositions.btn2.x &&
        canvasX <= buttonPositions.btn2.x + 60 &&
        canvasY >= buttonPositions.btn2.y &&
        canvasY <= buttonPositions.btn2.y + 30
      ) {
        // Select region 2
        handleRegionSelection(activeInequality, 'btn2');
        return;
      }
    }
    
    // If not clicking on buttons, handle point testing or dragging
    if (e.shiftKey) {
      // Shift + Click to test a point
      const mathCoords = toMathCoords(canvasX, canvasY);
      handlePointTest(mathCoords);
    } else {
      // Regular click for panning
      setIsDragging(true);
      setDragStart({ x: canvasX, y: canvasY });
    }
  }, [inequalities, toMathCoords, origin, zoom]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Pan the coordinate system
    setOrigin(prev => ({
      x: prev.x + (canvasX - dragStart.x) * CANVAS_CONFIG.panSpeed,
      y: prev.y + (canvasY - dragStart.y) * CANVAS_CONFIG.panSpeed
    }));
    
    setDragStart({ x: canvasX, y: canvasY });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Get mouse position for zooming towards cursor
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom factor
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(
      CANVAS_CONFIG.minZoom, 
      Math.min(CANVAS_CONFIG.maxZoom, zoom * zoomFactor)
    );
    
    // Adjust origin to zoom toward mouse position
    if (zoom !== newZoom) {
      setOrigin(prev => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / zoom)
      }));
      
      setZoom(newZoom);
    }
  }, [zoom]);

  // Add inequality handler - called from parent component
  const handleAddInequality = (input) => {
    // Try to parse the inequality
    const parsed = parseInequality(input);
    if (!parsed) return false;
    
    // Check if inequality already exists
    const exists = inequalities.some(ineq => 
      Math.abs(ineq.a - parsed.a) < 1e-9 && 
      Math.abs(ineq.b - parsed.b) < 1e-9 && 
      Math.abs(ineq.c - parsed.c) < 1e-9 && 
      ineq.operator === parsed.operator
    );
    
    if (exists) return 'EXISTS';
    
    // Add the new inequality
    const newInequalities = [...inequalities, parsed];
    setInequalities(newInequalities);
    
    // Provide visual feedback
    setFadeEffect(true);
    
    return true;
  };

  // Reset view handler
  const resetView = () => {
    setZoom(CANVAS_CONFIG.defaultZoom);
    setOrigin({ 
      x: canvasSize.width / 2, 
      y: canvasSize.height / 2 
    });
    setTestPoint(null);
    setPointStatus(POINT_STATUS.UNSOLVED);
    setShowPointCoordinates(false);
    setSolutionRegions({});
    resetLabelCounter();
  };

  // Point testing handler
  const handlePointTest = (point) => {
    setTestPoint(point);
    
    // Check if the point satisfies all inequalities
    let allSatisfied = true;
    let message = '';
    
    if (inequalities.length === 0) {
      message = 'Add at least one inequality spell to test a point!';
      setPointStatus(POINT_STATUS.UNSOLVED);
    } else {
      // Check each inequality
      for (const ineq of inequalities) {
        if (!checkPointInInequality(ineq, point)) {
          allSatisfied = false;
          break;
        }
      }
      
      if (allSatisfied) {
        message = `Correct! Point (${formatCoord(point.x)}, ${formatCoord(point.y)}) is in the solution region.`;
        setPointStatus(POINT_STATUS.CORRECT);
      } else {
        message = `Incorrect! Point (${formatCoord(point.x)}, ${formatCoord(point.y)}) is not a solution.`;
        setPointStatus(POINT_STATUS.INCORRECT);
      }
      
      setShowPointCoordinates(true);
    }
    
    setQuizMessage(message);
  };

  // Region selection handler for inequality
  const handleRegionSelection = (inequality, buttonType) => {
    // First, find the inequality in the list
    const index = inequalities.findIndex(ineq => ineq.label === inequality.label);
    if (index === -1) return;
    
    // Create a copy of the inequality
    const updatedInequality = { 
      ...inequalities[index], 
      showRegionButtons: false,
      solutionType: buttonType
    };
    
    // Update the inequality in the list
    const updatedInequalities = [...inequalities];
    updatedInequalities[index] = updatedInequality;
    
    // Update solution regions state
    setSolutionRegions({
      ...solutionRegions,
      [inequality.label]: buttonType
    });
    
    // Apply visual effect for feedback
    setFadeEffect(true);
    
    // Determine if the selection is correct
    const isCorrect = checkRegionSelection(inequality, buttonType);
    
    // Provide feedback
    if (isCorrect) {
      setQuizMessage(`Correct! You've identified the solution region for inequality ${inequality.label}!`);
    } else {
      setQuizMessage(`The region you selected for inequality ${inequality.label} is not the solution region.`);
    }
    
    // Update inequalities
    setInequalities(updatedInequalities);
  };
  
  // Show region selection buttons
  const handleShowRegionButtons = (inequalityLabel) => {
    // Hide buttons for all inequalities
    setInequalities(prev => 
      prev.map(ineq => ({
        ...ineq,
        showRegionButtons: ineq.label === inequalityLabel
      }))
    );
  };

  // Format coordinate for display
  const formatCoord = (num) => {
    const rounded = Math.round(num * 100) / 100;
    return rounded === Math.floor(rounded) ? rounded.toString() : rounded.toFixed(2);
  };

  // Get positions for region selection buttons
  const getRegionButtonPositions = (inequality) => {
    const [p1, p2] = getBoundaryPoints(inequality);
    const canvas1 = toCanvasCoords(p1.x, p1.y);
    const canvas2 = toCanvasCoords(p2.x, p2.y);
    
    // Calculate midpoint of the line
    const midX = (canvas1.x + canvas2.x) / 2;
    const midY = (canvas1.y + canvas2.y) / 2;
    
    // Calculate vector perpendicular to the line
    const dx = canvas2.x - canvas1.x;
    const dy = canvas2.y - canvas1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const nx = -dy / length;
    const ny = dx / length;
    
    // Button offset distance from the line
    const offset = 50;
    
    // Return positions for both buttons
    return {
      btn1: {
        x: midX - nx * offset - 30,
        y: midY - ny * offset - 15
      },
      btn2: {
        x: midX + nx * offset - 30,
        y: midY + ny * offset - 15
      }
    };
  };

  // Check if selected region is correct
  const checkRegionSelection = (inequality, selectedRegion) => {
    // Get boundary points
    const [p1, p2] = getBoundaryPoints(inequality);
    
    // Calculate a point in the middle of the line
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    
    // Calculate normal vector
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const nx = -dy / length;
    const ny = dx / length;
    
    // Create test points in both regions
    const testPoint1 = { 
      x: midX + nx, 
      y: midY + ny 
    };
    
    const testPoint2 = { 
      x: midX - nx, 
      y: midY - ny 
    };
    
    // Check which test point satisfies the inequality
    const test1Satisfies = checkPointInInequality(inequality, testPoint1);
    
    // If region 1 is selected, it should match test point 2 (which is in region 1 direction)
    // If region 2 is selected, it should match test point 1 (which is in region 2 direction)
    return (selectedRegion === 'btn1' && !test1Satisfies) || 
           (selectedRegion === 'btn2' && test1Satisfies);
  };

  // Test if a point satisfies all inequalities
  const testPointWithInequalities = (point) => {
    if (inequalities.length === 0) {
      setQuizMessage("No inequalities to test against! Cast some inequality spells first.");
      return;
    }
    
    // Test against each inequality
    const results = inequalities.map(ineq => ({
      label: ineq.label,
      satisfies: checkPointInInequality(ineq, point)
    }));
    
    // Check if the point satisfies all inequalities
    const allSatisfied = results.every(result => result.satisfies);
    
    // Format the point coordinates
    const formattedX = formatCoord(point.x);
    const formattedY = formatCoord(point.y);
    
    // Create a message with the results
    if (allSatisfied) {
      setPointStatus(POINT_STATUS.CORRECT);
      setShowPointCoordinates(true);
      setQuizMessage(`Correct! The point (${formattedX}, ${formattedY}) is a solution to all inequalities.`);
    } else {
      setPointStatus(POINT_STATUS.INCORRECT);
      setShowPointCoordinates(true);
      
      // Find which inequalities are not satisfied
      const failedInequalities = results
        .filter(result => !result.satisfies)
        .map(result => result.label)
        .join(', ');
      
      setQuizMessage(`The point (${formattedX}, ${formattedY}) does not satisfy the inequalities: ${failedInequalities}`);
    }
  };

  // Main drawing function
  const drawEverything = () => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Draw grid and axes
    drawGridAndAxes(ctx, canvasSize.width, canvasSize.height, zoom, origin);
    
    // Draw inequalities (filled regions first, then boundary lines)
    if (inequalities.length > 0) {
      // First draw filled regions for each inequality
      for (const ineq of inequalities) {
        // Apply solution region if specified
        const regionType = solutionRegions[ineq.label];
        const inequalityWithRegion = regionType 
          ? { ...ineq, solutionType: regionType } 
          : ineq;
          
        // Determine if this inequality should be highlighted
        const isHighlighted = hoveredEq && hoveredEq.label === ineq.label;
        
        // Fill the half-plane
        fillHalfPlane(ctx, inequalityWithRegion, ineq.color, toCanvasCoords, isHighlighted ? 0.5 : 0.3);
      }
      
      // Then draw boundary lines on top
      for (const ineq of inequalities) {
        // Determine if this inequality should be highlighted
        const isHighlighted = hoveredEq && hoveredEq.label === ineq.label;
        
        // Draw the boundary line
        drawBoundaryLine(ctx, ineq, isHighlighted, toCanvasCoords);
        
        // Draw region selection buttons if needed
        if (ineq.showRegionButtons) {
          drawRegionSelectionButtons(ctx, ineq);
        }
      }
      
      // Draw intersection points
      drawIntersectionPoints(ctx);
    }
    
    // Draw test point if exists
    if (testPoint) {
      drawTestPoint(ctx, testPoint);
    }
    
    // Draw controls if enabled
    if (showControls) {
      drawControlsHelp(ctx);
    }
    
    // Show fade effect animation
    if (fadeEffect) {
      ctx.fillStyle = 'rgba(211, 166, 37, 0.2)';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    }
  };

  // Draw grid and axes
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
  
    // Draw axes with theme colors
    ctx.strokeStyle = themeColors.secondary; // Gryffindor Gold
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
  
    // Draw arrows at the edges
    const arrowSize = 10;
  
    // X-axis arrow
    ctx.beginPath();
    ctx.moveTo(width, origin.y);
    ctx.lineTo(width - arrowSize, origin.y - arrowSize);
    ctx.lineTo(width - arrowSize, origin.y + arrowSize);
    ctx.fillStyle = themeColors.secondary;
    ctx.fill();
    ctx.closePath();
  
    // Y-axis arrow
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x - arrowSize, arrowSize);
    ctx.lineTo(origin.x + arrowSize, arrowSize);
    ctx.fill();
    ctx.closePath();
  
    // Draw labels
    ctx.font = "bold italic 18px 'STIX Two Math', 'Times New Roman', serif";
    ctx.fillStyle = themeColors.secondary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  
    // O label
    ctx.fillText("O", origin.x - 15, origin.y + 15);
  
    // X label
    ctx.fillText("x", width - 20, origin.y - 20);
  
    // Y label
    ctx.fillText("y", origin.x + 20, 20);
  
    // Draw numbers on axes
    ctx.font = '14px "Cinzel", serif';
    ctx.fillStyle = themeColors.secondary;
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

  // Draw the boundary line for an inequality
  const drawBoundaryLine = (ctx, inequality, isHighlighted, toCanvasCoords) => {
    const [p1, p2] = getBoundaryPoints(inequality);
    const canvasP1 = toCanvasCoords(p1.x, p1.y);
    const canvasP2 = toCanvasCoords(p2.x, p2.y);
    
    // Style for the boundary line
    ctx.beginPath();
    ctx.moveTo(canvasP1.x, canvasP1.y);
    ctx.lineTo(canvasP2.x, canvasP2.y);
    
    ctx.lineWidth = isHighlighted ? 3 : 2;
    ctx.strokeStyle = inequality.color;
    
    // Dashed line for strict inequalities
    if (inequality.operator === '<' || inequality.operator === '>') {
      ctx.setLineDash([5, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash pattern
    
    // Draw label
    const midX = (canvasP1.x + canvasP2.x) / 2;
    const midY = (canvasP1.y + canvasP2.y) / 2;
    
    // Draw label box
    ctx.fillStyle = isHighlighted 
      ? 'rgba(255, 255, 255, 0.9)' 
      : 'rgba(255, 255, 255, 0.7)';
    
    // Draw label with inequality.label (e.g., d₁, d₂, etc.)
    ctx.font = 'italic 16px "STIX Two Math", serif';
    
    // Measure text to create background
    const textMetrics = ctx.measureText(inequality.label);
    const padding = 5;
    
    // Draw label background
    ctx.fillRect(
      midX - textMetrics.width / 2 - padding,
      midY - 8 - padding,
      textMetrics.width + padding * 2,
      16 + padding * 2
    );
    
    // Draw border around label
    ctx.strokeStyle = inequality.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      midX - textMetrics.width / 2 - padding,
      midY - 8 - padding,
      textMetrics.width + padding * 2,
      16 + padding * 2
    );
    
    // Draw text
    ctx.fillStyle = inequality.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(inequality.label, midX, midY);
  };

  // Fill half-plane for inequality
  const fillHalfPlane = (ctx, eq, fillColor, toCanvasCoords, alpha = 0.3) => {
    if (!eq || (eq.operator === '=' && !eq.solutionType)) return;
    
    // Get boundary points
    const [p1, p2] = getBoundaryPoints(eq);
    
    // Convert to canvas coordinates
    const canvasP1 = toCanvasCoords(p1.x, p1.y);
    const canvasP2 = toCanvasCoords(p2.x, p2.y);
    
    // Determine fill direction based on inequality and/or selected region
    let fillDirection;
    
    if (eq.solutionType) {
      // User selected region
      const dx = canvasP2.x - canvasP1.x;
      const dy = canvasP2.y - canvasP1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Normal vector to the line
      const nx = -dy / length;
      const ny = dx / length;
      
      // Fill based on selected region
      fillDirection = eq.solutionType === 'btn1' 
        ? { x: -nx, y: -ny }  // Region 1
        : { x: nx, y: ny };   // Region 2
    } else {
      // Automatically determine based on inequality
      fillDirection = getHalfPlaneFillDirection(eq);
    }
    
    // Calculate a far point in the fill direction
    const midX = (canvasP1.x + canvasP2.x) / 2;
    const midY = (canvasP1.y + canvasP2.y) / 2;
    const farDistance = Math.max(canvasSize.width, canvasSize.height) * 2;
    const farX = midX + fillDirection.x * farDistance;
    const farY = midY + fillDirection.y * farDistance;
    
    // Create a path for filling
    ctx.beginPath();
    ctx.moveTo(canvasP1.x, canvasP1.y);
    ctx.lineTo(canvasP2.x, canvasP2.y);
    ctx.lineTo(farX, farY);
    
    // Calculate third point of the fill triangle
    const dx = canvasP2.x - canvasP1.x;
    const dy = canvasP2.y - canvasP1.y;
    const thirdX = canvasP1.x + fillDirection.x * farDistance;
    const thirdY = canvasP1.y + fillDirection.y * farDistance;
    
    ctx.lineTo(thirdX, thirdY);
    ctx.closePath();
    
    // Convert hex to rgba for fill
    const hexToRgba = (hex, a) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    
    // Fill the region
    ctx.fillStyle = hexToRgba(fillColor, alpha);
    ctx.fill();
  };

  // Draw region selection buttons
  const drawRegionSelectionButtons = (ctx, inequality) => {
    const buttonPositions = getRegionButtonPositions(inequality);
    
    // Draw region selection instruction
    const instX = (buttonPositions.btn1.x + buttonPositions.btn2.x) / 2;
    const instY = buttonPositions.btn1.y - 30;
    
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.fillStyle = themeColors.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw instruction background
    const text = "Select the solution region:";
    const textWidth = ctx.measureText(text).width;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(
      instX - textWidth / 2 - 10,
      instY - 10,
      textWidth + 20,
      20
    );
    
    // Draw instruction text
    ctx.fillStyle = themeColors.primary;
    ctx.fillText(text, instX, instY);
    
    // Draw button 1 with better styling
    ctx.fillStyle = 'rgba(26, 71, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(
      buttonPositions.btn1.x, 
      buttonPositions.btn1.y, 
      60, 
      30, 
      8
    );
    ctx.fill();
    
    // Button 1 border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Button 1 label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Cinzel", serif';
    ctx.fillText("Region 1", buttonPositions.btn1.x + 30, buttonPositions.btn1.y + 15);
    
    // Draw button 2 with better styling
    ctx.fillStyle = 'rgba(14, 26, 64, 0.9)';
    ctx.beginPath();
    ctx.roundRect(
      buttonPositions.btn2.x, 
      buttonPositions.btn2.y, 
      60, 
      30, 
      8
    );
    ctx.fill();
    
    // Button 2 border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Button 2 label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Cinzel", serif';
    ctx.fillText("Region 2", buttonPositions.btn2.x + 30, buttonPositions.btn2.y + 15);
  };

  // Draw test point
  const drawTestPoint = (ctx, point) => {
    const canvasPoint = toCanvasCoords(point.x, point.y);
    
    // Draw point with status-specific styling
    ctx.beginPath();
    ctx.arc(canvasPoint.x, canvasPoint.y, 8, 0, Math.PI * 2);
    
    // Set colors based on point status
    switch (pointStatus) {
      case POINT_STATUS.CORRECT:
        ctx.fillStyle = themeColors.success;
        break;
      case POINT_STATUS.INCORRECT:
        ctx.fillStyle = themeColors.error;
        break;
      case POINT_STATUS.ACTIVE:
        ctx.fillStyle = themeColors.warning;
        break;
      default:
        ctx.fillStyle = themeColors.primary;
    }
    
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    
    // Display coordinates if enabled
    if (showPointCoordinates) {
      const formattedX = formatCoord(point.x);
      const formattedY = formatCoord(point.y);
      const coordText = `(${formattedX}, ${formattedY})`;
      
      // Draw coordinate label with background
      ctx.font = '14px "Cinzel", serif';
      const textWidth = ctx.measureText(coordText).width;
      
      // Background for text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(
        canvasPoint.x - textWidth / 2 - 5,
        canvasPoint.y - 30,
        textWidth + 10,
        20
      );
      
      // Text
      ctx.fillStyle = themeColors.primary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(coordText, canvasPoint.x, canvasPoint.y - 20);
    }
  };

  // Draw intersection points of all inequalities
  const drawIntersectionPoints = (ctx) => {
    if (inequalities.length < 2) return;
    
    const drawnPoints = new Set(); // Track points already drawn to avoid duplicates
    
    // Check each pair of inequalities
    for (let i = 0; i < inequalities.length; i++) {
      for (let j = i + 1; j < inequalities.length; j++) {
        const intersection = calculateIntersection(inequalities[i], inequalities[j]);
        
        if (intersection) {
          // Create a key to track this point
          const key = `${formatCoord(intersection.x)},${formatCoord(intersection.y)}`;
          if (drawnPoints.has(key)) continue;
          
          // Convert to canvas coordinates
          const canvasPoint = toCanvasCoords(intersection.x, intersection.y);
          
          // Draw intersection point
          ctx.beginPath();
          ctx.arc(canvasPoint.x, canvasPoint.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = themeColors.primary;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
          
          drawnPoints.add(key);
        }
      }
    }
  };

  // Draw help controls information
  const drawControlsHelp = (ctx) => {
    const textLines = [
      'Drag: Pan view',
      'Shift+Click: Test point',
      'Wheel: Zoom in/out',
      'Double-click: Choose region'
    ];
    
    // Draw background for controls help
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(10, 10, 180, 90);
    
    // Draw border
    ctx.strokeStyle = themeColors.secondary;
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 180, 90);
    
    // Draw title
    ctx.font = 'bold 14px "Cinzel", serif';
    ctx.fillStyle = themeColors.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Controls:', 20, 15);
    
    // Draw help text
    ctx.font = '12px "Cinzel", serif';
    textLines.forEach((line, i) => {
      ctx.fillText(line, 20, 35 + i * 16);
    });
  };

  // Expose functions to parent component through ref
  useImperativeHandle(ref, () => ({
    handleAddInequality,
    resetView,
    showRegionButtons: handleShowRegionButtons
  }));

  return (
    <div className="enhanced-coordinate-plane">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
      <div className="zoom-controls">
        <button 
          className="zoom-button"
          onClick={() => setZoom(prev => Math.min(CANVAS_CONFIG.maxZoom, prev * 1.2))}
        >
          +
        </button>
        <button 
          className="zoom-button"
          onClick={() => setZoom(prev => Math.max(CANVAS_CONFIG.minZoom, prev / 1.2))}
        >
          -
        </button>
        <button 
          className="zoom-button reset"
          onClick={resetView}
          title="Reset View"
        >
          <span className="material-icons">refresh</span>
        </button>
      </div>
      <div className="toggle-controls">
        <button 
          className={`toggle-button ${showControls ? 'active' : ''}`}
          onClick={() => setShowControls(prev => !prev)}
        >
          <span className="material-icons">
            {showControls ? 'visibility' : 'visibility_off'}
          </span>
        </button>
      </div>
    </div>
  );
});

export default EnhancedCoordinatePlane; 