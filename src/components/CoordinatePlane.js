import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import './CoordinatePlane.css';

const CoordinatePlane = forwardRef(({ 
  inequalities, 
  setInequalities, 
  setQuizMessage, 
  hoveredEq, 
  setHoveredEq, 
  isMobile, 
  drawingMode = false,
  regionMode = false,
  intersectionPoints = []
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState(null);
  const [boundaries, setBoundaries] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [regions, setRegions] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const gridSizeBase = 40; // Base grid size

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleAddInequality: (newInequality) => {
      setInequalities(prev => [...prev, newInequality]);
      return true;
    }
  }));

  // Resize canvas when the component mounts or container size changes
  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        renderCanvas();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const renderCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const gridSize = gridSizeBase * scale; // Adjust grid size based on scale

    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 1;

    // Calculate grid offset based on center and pan offset
    const offsetX = centerX + offset.x;
    const offsetY = centerY + offset.y;
    
    // Calculate grid starting points
    const startX = offsetX % gridSize;
    const startY = offsetY % gridSize;

    // Draw vertical grid lines
    for (let x = startX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = startY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, offsetY);
    ctx.lineTo(width, offsetY);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(offsetX, 0);
    ctx.lineTo(offsetX, height);
    ctx.stroke();

    // Draw axis arrows
    // X-axis arrow
    ctx.beginPath();
    ctx.moveTo(width - 15, offsetY - 8);
    ctx.lineTo(width, offsetY);
    ctx.lineTo(width - 15, offsetY + 8);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Y-axis arrow
    ctx.beginPath();
    ctx.moveTo(offsetX - 8, 15);
    ctx.lineTo(offsetX, 0);
    ctx.lineTo(offsetX + 8, 15);
    ctx.fill();

    // Draw origin point
    ctx.fillStyle = '#000000';
    ctx.font = 'bold italic 20px Times New Roman';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw origin point without highlight
    ctx.beginPath();
    ctx.arc(offsetX, offsetY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    ctx.fillText("O", offsetX - 15, offsetY + 15);

    // Draw axis labels with enhanced style
    ctx.font = 'bold italic 20px Times New Roman';
    
    // X-axis label without highlight
    ctx.fillStyle = '#000000';
    ctx.fillText("x", width - 10, offsetY + 20);
    
    // Y-axis label without highlight
    ctx.fillStyle = '#000000';
    ctx.fillText("y", offsetX - 20, 10);

    // Draw axis numbers
    drawAxisNumbers(ctx, width, height, offsetX, offsetY, gridSize);

    // Draw inequalities
    inequalities.forEach((ineq, index) => {
      if (!ineq.a || !ineq.b || !ineq.c) return; // Skip invalid inequalities
      
      const color = ineq.color || '#FF0000'; // Default to red if color is missing
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // For vertical lines (b=0)
      if (ineq.b === 0) {
        if (ineq.a === 0) return; // Skip invalid inequalities
        
        // Vertical line x = -c/a
        const x = -ineq.c / ineq.a;
        const screenX = offsetX + x * gridSize;
        
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
        ctx.stroke();
        
        // Fill the solution region
        if (ineq.type === '>=' || ineq.type === '>' || ineq.type === '<=' || ineq.type === '<') {
          ctx.fillStyle = `${color}20`; // Semi-transparent
          ctx.beginPath();
          
          // Determine which side to fill
          let fillRight = false;
          if (ineq.type === '>=' || ineq.type === '>') {
            fillRight = ineq.a < 0;
          } else {
            fillRight = ineq.a > 0;
          }
          
          if (fillRight) {
            ctx.rect(screenX, 0, width - screenX, height);
          } else {
            ctx.rect(0, 0, screenX, height);
          }
          
          ctx.fill();
        }
      } else {
        // Regular line y = (-a*x - c) / b
        const getY = (x) => (-ineq.a * x - ineq.c) / ineq.b;
        
        // Calculate left and right bounds of the canvas in coordinate space
        const leftX = (0 - offsetX) / gridSize;
        const rightX = (width - offsetX) / gridSize;
        
        // Draw the line
        ctx.beginPath();
        for (let screenX = 0; screenX <= width; screenX += 2) {
          const x = (screenX - offsetX) / gridSize;
          const y = getY(x);
          const screenY = offsetY - y * gridSize;
          
          if (screenX === 0) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
        
        // Fill the solution region
        if (ineq.type === '>=' || ineq.type === '>' || ineq.type === '<=' || ineq.type === '<') {
          ctx.fillStyle = `${color}20`; // Semi-transparent
          
          // Determine which way to fill based on inequality type
          let fillDown = true;
          if (ineq.type === '>=' || ineq.type === '>') {
            fillDown = ineq.b < 0;
          } else {
            fillDown = ineq.b > 0;
          }
          
          // Draw the filled region
          ctx.beginPath();
          
          // Left point
          const leftY = getY(leftX);
          const leftScreenY = offsetY - leftY * gridSize;
          ctx.moveTo(0, leftScreenY);
          
          // Draw the line
          for (let screenX = 0; screenX <= width; screenX += 2) {
            const x = (screenX - offsetX) / gridSize;
            const y = getY(x);
            const screenY = offsetY - y * gridSize;
            ctx.lineTo(screenX, screenY);
          }
          
          // Complete the region
          if (fillDown) {
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
          } else {
            ctx.lineTo(width, 0);
            ctx.lineTo(0, 0);
          }
          
          ctx.closePath();
          ctx.fill();
        }
      }
      
      // Draw hovered inequality highlight
      if (hoveredEq && hoveredEq.label === ineq.label) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);
        
        if (ineq.b === 0) {
          // Vertical line
          const x = -ineq.c / ineq.a;
          const screenX = offsetX + x * gridSize;
          
          ctx.beginPath();
          ctx.moveTo(screenX, 0);
          ctx.lineTo(screenX, height);
          ctx.stroke();
        } else {
          // Regular line
          const getY = (x) => (-ineq.a * x - ineq.c) / ineq.b;
          
          ctx.beginPath();
          for (let screenX = 0; screenX <= width; screenX += 2) {
            const x = (screenX - offsetX) / gridSize;
            const y = getY(x);
            const screenY = offsetY - y * gridSize;
            
            if (screenX === 0) {
              ctx.moveTo(screenX, screenY);
            } else {
              ctx.lineTo(screenX, screenY);
            }
          }
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
      }
    });

    // Draw custom boundaries
    if (boundaries.length > 0 || currentPath.length > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff9800';
      
      // Draw completed boundaries
      boundaries.forEach(path => {
        if (path.length < 2) return;
        
        ctx.beginPath();
        const startPoint = canvasToScreen(path[0].x, path[0].y);
        ctx.moveTo(startPoint.x, startPoint.y);
        
        for (let i = 1; i < path.length; i++) {
          const point = canvasToScreen(path[i].x, path[i].y);
          ctx.lineTo(point.x, point.y);
        }
        
        ctx.stroke();
      });
      
      // Draw current path while drawing
      if (currentPath.length > 1) {
        ctx.beginPath();
        const startPoint = canvasToScreen(currentPath[0].x, currentPath[0].y);
        ctx.moveTo(startPoint.x, startPoint.y);
        
        for (let i = 1; i < currentPath.length; i++) {
          const point = canvasToScreen(currentPath[i].x, currentPath[i].y);
          ctx.lineTo(point.x, point.y);
        }
        
        ctx.stroke();
      }
    }
    
    // Draw selected regions
    if (regions.length > 0) {
      ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
      
      regions.forEach(region => {
        const screenPoint = canvasToScreen(region.x, region.y);
        ctx.beginPath();
        ctx.arc(screenPoint.x, screenPoint.y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    // Draw intersection points
    if (intersectionPoints.length > 0) {
      ctx.fillStyle = '#f44336';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      
      intersectionPoints.forEach(point => {
        const screenPoint = canvasToScreen(point.x, point.y);
        
        // Draw circle for point
        ctx.beginPath();
        ctx.arc(screenPoint.x, screenPoint.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`(${point.x}, ${point.y})`, screenPoint.x, screenPoint.y - 8);
      });
    }
  };

  useEffect(() => {
    renderCanvas();
  }, [inequalities, hoveredEq, offset, scale, boundaries, currentPath, regions, intersectionPoints, drawingMode, regionMode, isDrawing]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => {
      const newScale = Math.min(Math.max(prev * delta, 0.5), 2);
      return newScale;
    });
  };

  const handleMouseDown = (e) => {
    const { clientX, clientY } = e;
    
    if (drawingMode) {
      startDrawing(clientX, clientY);
    } else if (regionMode) {
      selectRegion(clientX, clientY);
    } else {
      // Original panning functionality
      setIsDragging(true);
      setLastX(clientX);
      setLastY(clientY);
    }
  };

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    
    if (drawingMode && isDrawing) {
      continueDrawing(clientX, clientY);
    } else if (isDragging) {
      // Original panning functionality
      const dx = clientX - lastX;
      const dy = clientY - lastY;
      
      setOffset({
        x: offset.x + dx,
        y: offset.y + dy
      });
      
      setLastX(clientX);
      setLastY(clientY);
    }
  };

  const handleMouseUp = () => {
    if (drawingMode && isDrawing) {
      finishDrawing();
    }
    
    // Original panning functionality
    setIsDragging(false);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Single touch for panning
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y
      });
    } else if (e.touches.length === 2) {
      // Pinch to zoom - calculate initial distance
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setTouchDistance(Math.sqrt(dx * dx + dy * dy));
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault(); // Prevent scrolling while interacting with the canvas
    
    if (e.touches.length === 1 && isDragging) {
      // Single touch - pan
      setOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    } else if (e.touches.length === 2 && touchDistance) {
      // Pinch to zoom - calculate new distance and scale factor
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      
      // Apply scaling based on pinch gesture
      const scaleFactor = newDistance / touchDistance;
      setScale(prev => {
        const newScale = Math.min(Math.max(prev * scaleFactor, 0.5), 2);
        return newScale;
      });
      
      // Update touch distance for next move
      setTouchDistance(newDistance);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDistance(null);
  };

  const resetView = () => {
    setOffset({ x: 0, y: 0 });
    setScale(1);
  };

  // Add drawing functionality
  const startDrawing = (x, y) => {
    if (drawingMode) {
      setIsDrawing(true);
      const canvasPoint = screenToCanvas(x, y);
      setCurrentPath([canvasPoint]);
    }
  };
  
  const continueDrawing = (x, y) => {
    if (drawingMode && isDrawing) {
      const canvasPoint = screenToCanvas(x, y);
      setCurrentPath(prev => [...prev, canvasPoint]);
    }
  };
  
  const finishDrawing = () => {
    if (drawingMode && isDrawing && currentPath.length > 1) {
      setBoundaries(prev => [...prev, currentPath]);
      setCurrentPath([]);
      setIsDrawing(false);
    }
  };
  
  // Add region selection functionality
  const selectRegion = (x, y) => {
    if (regionMode) {
      const canvasPoint = screenToCanvas(x, y);
      // Check if point is inside any existing region to avoid duplicates
      const isInsideExisting = regions.some(region => 
        pointInPolygon(canvasPoint.x, canvasPoint.y, region));
        
      if (!isInsideExisting) {
        setRegions(prev => [...prev, { x: canvasPoint.x, y: canvasPoint.y }]);
      }
    }
  };
  
  // Helper function to check if a point is inside a polygon
  const pointInPolygon = (x, y, polygon) => {
    // Implementation of point-in-polygon algorithm
    // For this example, we'll use a simple distance check
    const dx = x - polygon.x;
    const dy = y - polygon.y;
    return Math.sqrt(dx * dx + dy * dy) < 0.5; // Within 0.5 units
  };
  
  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const gridSize = gridSizeBase * scale;
    const x = (screenX - rect.left - offset.x) / gridSize;
    const y = (offset.y - (screenY - rect.top)) / gridSize;
    return { x, y };
  };
  
  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = (canvasX, canvasY) => {
    const gridSize = gridSizeBase * scale;
    const x = canvasX * gridSize + offset.x;
    const y = offset.y - canvasY * gridSize;
    return { x, y };
  };

  // Fix for Y-axis numbers visibility
  const drawAxisNumbers = (ctx, width, height, offsetX, offsetY, gridSize) => {
    ctx.font = '16px Arial';
    const unitSize = gridSize;
    
    // Calculate visible range
    const viewportLeft = -offsetX / unitSize;
    const viewportRight = (width - offsetX) / unitSize;
    const viewportTop = -offsetY / unitSize;
    const viewportBottom = (height - offsetY) / unitSize;
    
    // X-axis numbers
    for (let x = Math.ceil(viewportLeft); x <= Math.floor(viewportRight); x++) {
      if (x !== 0) { // Skip zero
        const screenX = offsetX + x * unitSize;
        ctx.fillStyle = '#000000';
        ctx.fillText(x.toString(), screenX, offsetY + 20);
      }
    }

    // Y-axis numbers with better visibility
    for (let y = Math.ceil(viewportTop); y <= Math.floor(viewportBottom); y++) {
      if (y !== 0) { // Skip zero
        const screenY = offsetY - y * unitSize;
        
        // Always add background for Y-axis numbers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        // Use a fixed width background that's aligned with the Y-axis
        ctx.rect(offsetX - 40, screenY - 10, 40, 20);
        ctx.fill();
        
        // Draw text on top of background
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), offsetX - 10, screenY + 5);
        // Reset alignment for other text
        ctx.textAlign = 'center';
      }
    }
  };

  return (
    <div className="coordinate-container">
      <div className="coordinate-plane-container">
        <canvas
          className="coordinate-plane-canvas"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <button
          className="reset-view-button"
          onClick={resetView}
          title="Đặt lại góc nhìn"
        >
          <i className="material-icons">restart_alt</i>
        </button>
        {isMobile && (
          <div className="mobile-control-hint">
            Kéo để di chuyển, chụm để phóng to
          </div>
        )}
      </div>
    </div>
  );
});

export default CoordinatePlane; 