import React, { useEffect, useRef } from 'react';
import './CoordinatePlane.css';

const CoordinatePlane = ({ ref, inequalities, setInequalities, setQuizMessage, hoveredEq, setHoveredEq }) => {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Draw vertical grid lines
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x + offset.x, 0);
      ctx.lineTo(x + offset.x, height);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y + offset.y);
      ctx.lineTo(width, y + offset.y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, centerY + offset.y);
    ctx.lineTo(width, centerY + offset.y);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(centerX + offset.x, 0);
    ctx.lineTo(centerX + offset.x, height);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px Cinzel';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // X-axis labels
    for (let x = -10; x <= 10; x++) {
      if (x !== 0) {
        const screenX = centerX + (x * 50) + offset.x;
        ctx.fillText(x.toString(), screenX, centerY + 20 + offset.y);
      }
    }

    // Y-axis labels
    for (let y = -10; y <= 10; y++) {
      if (y !== 0) {
        const screenY = centerY - (y * 50) + offset.y;
        ctx.fillText(y.toString(), centerX - 20 + offset.x, screenY);
      }
    }

    // Draw inequalities
    inequalities.forEach((ineq, index) => {
      ctx.strokeStyle = ineq.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Draw the inequality line
      for (let x = -10; x <= 10; x += 0.1) {
        const y = (ineq.a * x + ineq.c) / -ineq.b;
        const screenX = centerX + (x * 50) + offset.x;
        const screenY = centerY - (y * 50) + offset.y;
        
        if (x === -10) {
          ctx.moveTo(screenX, screenY);
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();

      // Fill the solution region
      if (ineq.type === '>=' || ineq.type === '<=') {
        ctx.fillStyle = `${ineq.color}20`;
        ctx.beginPath();
        for (let x = -10; x <= 10; x += 0.1) {
          const y = (ineq.a * x + ineq.c) / -ineq.b;
          const screenX = centerX + (x * 50) + offset.x;
          const screenY = centerY - (y * 50) + offset.y;
          
          if (x === -10) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }
        ctx.lineTo(width, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
      }
    });

    // Draw hovered inequality highlight
    if (hoveredEq) {
      ctx.strokeStyle = hoveredEq.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let x = -10; x <= 10; x += 0.1) {
        const y = (hoveredEq.a * x + hoveredEq.c) / -hoveredEq.b;
        const screenX = centerX + (x * 50) + offset.x;
        const screenY = centerY - (y * 50) + offset.y;
        
        if (x === -10) {
          ctx.moveTo(screenX, screenY);
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [inequalities, hoveredEq, offset]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 2));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="coordinate-plane-container">
      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="coordinate-plane-canvas"
      />
      <div className="coordinate-controls">
        <button onClick={() => setOffset({ x: 0, y: 0 })}>Reset View</button>
        <button onClick={() => setScale(1)}>Reset Zoom</button>
      </div>
    </div>
  );
};

export default CoordinatePlane; 