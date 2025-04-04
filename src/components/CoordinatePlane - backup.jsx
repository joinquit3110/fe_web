import React, { useRef, useEffect, useState } from "react";
import { computeIntersection } from "../utils/geometry";

/* =============================
   Các hàm tiện ích
   ============================= */

// f(x,y)= a*x + b*y + c
function fValue(eq, point) {
  return eq.a * point.x + eq.b * point.y + eq.c;
}

// Normalize vector
function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

// desiredSign: với ">" hoặc ">=" thì mong muốn f>0, với "<" hoặc "<=" thì mong muốn f<0.
function desiredSign(eq) {
  return (eq.operator === ">" || eq.operator === ">=") ? 1 : -1;
}

// Kiểm tra điểm có thuộc miền nghiệm hay không
function checkPointInInequality(eq, point) {
  const val = fValue(eq, point);
  switch (eq.operator) {
    case "<=":
      return val <= 0;
    case ">=":
      return val >= 0;
    case "<":
      return val < 0;
    case ">":
      return val > 0;
    default:
      return false;
  }
}

/* =============================
   Chuyển đổi tọa độ: toán học → canvas
   ============================= */
function toCanvasCoords(x, y, canvasWidth, canvasHeight, zoom) {
  const origin = { x: canvasWidth / 2, y: canvasHeight / 2 };
  return { x: origin.x + x * zoom, y: origin.y - y * zoom };
}

/* =============================
   Tính 2 điểm trên đường biên (toán học)
   ============================= */
function getBoundaryPoints(eq) {
  const big = 10000;
  let p1, p2;
  if (Math.abs(eq.b) < 1e-9) {
    const x = -eq.c / eq.a;
    p1 = { x, y: -big };
    p2 = { x, y: big };
  } else {
    p1 = { x: -big, y: -(eq.c + eq.a * (-big)) / eq.b };
    p2 = { x: big, y: -(eq.c + eq.a * big) / eq.b };
  }
  return [p1, p2];
}

/* =============================
   Tô miền nghiệm
   ============================= */
function fillHalfPlane(ctx, eq, fillColor, toCanvasCoords) {
  console.log("=== fillHalfPlane for", eq.label, "===");
  const big = 10000;
  const [p1, p2] = getBoundaryPoints(eq);
  
  // Tính trung điểm của đường biên (toán học)
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  console.log("Midpoint:", mid);
  
  // Candidate cố định: mid + (1,1) và mid + (-1,-1)
  const candidate1 = { x: mid.x + 1, y: mid.y + 1 };
  const candidate2 = { x: mid.x - 1, y: mid.y - 1 };
  console.log("Candidate1:", candidate1, " f(candidate1) =", fValue(eq, candidate1));
  console.log("Candidate2:", candidate2, " f(candidate2) =", fValue(eq, candidate2));
  
  const d = desiredSign(eq);
  let chosenCandidate;
  if ((fValue(eq, candidate1) > 0 ? 1 : -1) === d) {
    chosenCandidate = candidate1;
  } else {
    chosenCandidate = candidate2;
  }
  console.log("Chosen candidate for filling:", chosenCandidate, " f(chosen) =", fValue(eq, chosenCandidate));
  
  // Tính fillDir: sử dụng candidate cố định và sau đó normalize để có vector đơn vị.
  const rawFillDir = { 
    x: chosenCandidate.x - mid.x, 
    y: chosenCandidate.y - mid.y 
  };
  const fillDir = normalize(rawFillDir);
  console.log("Fill direction (normalized):", fillDir);
  
  // Tạo các điểm mở rộng từ p1 và p2 theo fillDir
  const ext1 = { x: p1.x + fillDir.x * big, y: p1.y + fillDir.y * big };
  const ext2 = { x: p2.x + fillDir.x * big, y: p2.y + fillDir.y * big };
  
  // Chuyển các điểm sang tọa độ canvas
  const cp1 = toCanvasCoords(p1.x, p1.y);
  const cp2 = toCanvasCoords(p2.x, p2.y);
  const cext1 = toCanvasCoords(ext1.x, ext1.y);
  const cext2 = toCanvasCoords(ext2.x, ext2.y);
  
  // Tạo polygon và tô màu
  const path = new Path2D();
  path.moveTo(cp1.x, cp1.y);
  path.lineTo(cp2.x, cp2.y);
  path.lineTo(cext2.x, cext2.y);
  path.lineTo(cext1.x, cext1.y);
  path.closePath();
  
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fill(path);
  ctx.restore();
}

/* =============================
   Xác định vị trí nút (solution buttons)
   ============================= */
function getButtonCandidates(eq, x1, x2, y1, y2, zoom) {
  const [p1, p2] = getBoundaryPoints(eq);
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  console.log("getButtonCandidates - Midpoint:", mid);
  const offset = 40 / zoom;
  const candidate1 = { x: mid.x + 1 * offset, y: mid.y + 1 * offset };
  const candidate2 = { x: mid.x - 1 * offset, y: mid.y - 1 * offset };
  console.log("Candidate1:", candidate1, " f(candidate1) =", fValue(eq, candidate1));
  console.log("Candidate2:", candidate2, " f(candidate2) =", fValue(eq, candidate2));
  return [candidate1, candidate2];
}

/* =============================
   Vẽ lưới và trục
   ============================= */
function drawGridTop(ctx, w, h, zoom) {
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += zoom) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += zoom) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawAxesTop(ctx, w, h, zoom) {
  const origin = { x: w / 2, y: h / 2 };
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(w, origin.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, h);
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(w - 15, origin.y - 7.5);
  ctx.lineTo(w, origin.y);
  ctx.lineTo(w - 15, origin.y + 7.5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(origin.x - 7.5, 15);
  ctx.lineTo(origin.x, 0);
  ctx.lineTo(origin.x + 7.5, 15);
  ctx.fill();
  ctx.font = "12px 'STIX Two Math', 'Times New Roman', serif";
  ctx.fillStyle = "#000";
  for (let i = -Math.ceil(origin.x / zoom); i <= Math.ceil((w - origin.x) / zoom); i++) {
    if (i === 0) continue;
    const pos = { x: origin.x + i * zoom, y: origin.y };
    ctx.beginPath();
    ctx.moveTo(pos.x, origin.y - 4);
    ctx.lineTo(pos.x, origin.y + 4);
    ctx.stroke();
    ctx.fillText(i, pos.x - 5, origin.y + 15);
  }
  for (let j = -Math.ceil(origin.y / zoom); j <= Math.ceil((h - origin.y) / zoom); j++) {
    if (j === 0) continue;
    const pos = { x: origin.x, y: origin.y - j * zoom };
    ctx.beginPath();
    ctx.moveTo(origin.x - 4, pos.y);
    ctx.lineTo(origin.x + 4, pos.y);
    ctx.stroke();
    ctx.fillText(j, origin.x + 8, pos.y + 4);
  }
  ctx.font = "bold italic 18px 'STIX Two Math', 'Times New Roman', serif";
  ctx.fillText("O", origin.x - 20, origin.y + 20);
  ctx.fillText("x", w - 25, origin.y - 10);
  ctx.fillText("y", origin.x - 25, 25);
}

/* =============================
   Vẽ đường và nút chọn miền
   ============================= */
function drawLinesAndButtons(ctx, eq, toCanvasCoordsFunc, zoom, canvasWidth, canvasHeight) {
  let x1, x2, y1, y2;
  if (Math.abs(eq.b) < 1e-9) {
    const x_val = -eq.c / eq.a;
    x1 = x2 = x_val;
    y1 = -canvasHeight / (2 * zoom);
    y2 = canvasHeight / (2 * zoom);
  } else if (Math.abs(eq.a) < 1e-9) {
    const y_val = -eq.c / eq.b;
    y1 = y2 = y_val;
    x1 = -canvasWidth / (2 * zoom);
    x2 = canvasWidth / (2 * zoom);
  } else {
    x1 = -canvasWidth / (2 * zoom);
    x2 = canvasWidth / (2 * zoom);
    y1 = -(eq.c + eq.a * x1) / eq.b;
    y2 = -(eq.c + eq.a * x2) / eq.b;
  }
  const pt1Canvas = toCanvasCoordsFunc(x1, y1, canvasWidth, canvasHeight, zoom);
  const pt2Canvas = toCanvasCoordsFunc(x2, y2, canvasWidth, canvasHeight, zoom);
  
  ctx.strokeStyle = eq.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pt1Canvas.x, pt1Canvas.y);
  ctx.lineTo(pt2Canvas.x, pt2Canvas.y);
  ctx.stroke();
  
  ctx.font = "bold italic 14px 'STIX Two Math', 'Times New Roman', serif";
  ctx.fillStyle = eq.color;
  const labelOffsetX = 5 + (30 - zoom) * 0.1;
  const labelOffsetY = -5 - (30 - zoom) * 0.1;
  ctx.fillText(eq.label, pt2Canvas.x + labelOffsetX, pt2Canvas.y + labelOffsetY);
  
  // Tính vị trí nút dựa trên candidate cố định
  const candidatesMath = getButtonCandidates(eq, x1, x2, y1, y2, zoom);
  console.log("Candidates for", eq.label, ":", candidatesMath);
  const d = desiredSign(eq);
  let btnMathSolution, btnMathOther;
  if ((fValue(eq, candidatesMath[0]) > 0 ? 1 : -1) === d) {
    btnMathSolution = candidatesMath[0];
    btnMathOther = candidatesMath[1];
  } else {
    btnMathSolution = candidatesMath[1];
    btnMathOther = candidatesMath[0];
  }
  console.log("Selected candidate for Miền 1 for", eq.label, ":", btnMathSolution);
  console.log("Candidate for Miền 2 for", eq.label, ":", btnMathOther);
  
  const btn1CanvasPos = toCanvasCoordsFunc(btnMathSolution.x, btnMathSolution.y, canvasWidth, canvasHeight, zoom);
  const btn2CanvasPos = toCanvasCoordsFunc(btnMathOther.x, btnMathOther.y, canvasWidth, canvasHeight, zoom);
  
  const btn1Pos = { x: btn1CanvasPos.x - 30, y: btn1CanvasPos.y - 15 };
  const btn2Pos = { x: btn2CanvasPos.x - 30, y: btn2CanvasPos.y - 15 };
  
  if (!eq.solved) {
    ctx.fillStyle = eq.color;
    ctx.fillRect(btn1Pos.x, btn1Pos.y, 60, 30);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(btn1Pos.x, btn1Pos.y, 60, 30);
    ctx.fillStyle = "#fff";
    ctx.fillText("Miền 1", btn1Pos.x + 8, btn1Pos.y + 20);
    
    const altColor = eq.color === "#0077cc" ? "#d9534f" : "#0077cc";
    ctx.fillStyle = altColor;
    ctx.fillRect(btn2Pos.x, btn2Pos.y, 60, 30);
    ctx.strokeRect(btn2Pos.x, btn2Pos.y, 60, 30);
    ctx.fillStyle = "#fff";
    ctx.fillText("Miền 2", btn2Pos.x + 8, btn2Pos.y + 20);
    
    return {
      btn1: { x: btn1Pos.x, y: btn1Pos.y, width: 60, height: 30, sol: true },
      btn2: { x: btn2Pos.x, y: btn2Pos.y, width: 60, height: 30, sol: false },
      eq,
    };
  } else {
    // Khi đã giải, tô lại miền nghiệm theo lựa chọn và vẽ lại đường.
    const regionColor = eq.selectedSolution ? eq.color : "#dcdcdc";
    fillHalfPlane(ctx, eq, regionColor, toCanvasCoordsFunc);
    ctx.strokeStyle = eq.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pt1Canvas.x, pt1Canvas.y);
    ctx.lineTo(pt2Canvas.x, pt2Canvas.y);
    ctx.stroke();
    ctx.font = "bold italic 14px 'STIX Two Math', 'Times New Roman', serif";
    ctx.fillStyle = eq.color;
    ctx.fillText(eq.label, pt2Canvas.x + labelOffsetX, pt2Canvas.y + labelOffsetY);
    return null;
  }
}

/* =============================
   COMPONENT: CoordinatePlane
   ============================= */
const CoordinatePlane = ({ inequalities, setInequalities, quizMessage, setQuizMessage }) => {
  const canvasRef = useRef(null);
  const [solutionButtons, setSolutionButtons] = useState([]);
  const [intersections, setIntersections] = useState([]);
  const [zoom, setZoom] = useState(30);
  const canvasWidth = 600;
  const canvasHeight = 600;
  
  const toCanvasCoordsWrapper = (x, y, cw, ch, zoomVal) => {
    const origin = { x: cw / 2, y: ch / 2 };
    return { x: origin.x + x * zoomVal, y: origin.y - y * zoomVal };
  };
  
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Vẽ nền trắng, lưới và trục
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawGridTop(ctx, canvasWidth, canvasHeight, zoom);
    drawAxesTop(ctx, canvasWidth, canvasHeight, zoom);
    
    // Vẽ các đường và nút (hoặc vẽ vùng tô nếu đã giải)
    let btns = [];
    inequalities.forEach((eq) => {
      const data = drawLinesAndButtons(ctx, eq, toCanvasCoordsWrapper, zoom, canvasWidth, canvasHeight);
      if (data) btns.push(data);
    });
    setSolutionButtons(btns);
    
    // Vẽ giao điểm giữa các bất phương trình
    let inters = [];
    for (let i = 0; i < inequalities.length; i++) {
      for (let j = i + 1; j < inequalities.length; j++) {
        const pt = computeIntersection(inequalities[i], inequalities[j]);
        if (pt) {
          inters.push(pt);
          const cpt = toCanvasCoordsWrapper(pt.x, pt.y, canvasWidth, canvasHeight, zoom);
          ctx.fillStyle = "gray";
          ctx.beginPath();
          ctx.arc(cpt.x, cpt.y, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = "#000";
          ctx.fillText(`(${pt.x.toFixed(1)};${pt.y.toFixed(1)})`, cpt.x + 5, cpt.y - 5);
        }
      }
    }
    setIntersections(inters);
  };
  
  useEffect(() => {
    redraw();
  }, [inequalities, zoom]);
  
  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((prev) => (e.deltaY > 0 ? Math.max(prev - 2, 10) : prev + 2));
  };
  
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    for (let btn of solutionButtons) {
      if (
        clickX >= btn.btn1.x &&
        clickX <= btn.btn1.x + btn.btn1.width &&
        clickY >= btn.btn1.y &&
        clickY <= btn.btn1.y + btn.btn1.height
      ) {
        const eq = btn.eq;
        if (checkPointInInequality(eq, { x: 0, y: 0 })) {
          setQuizMessage("Chính xác!");
          setInequalities(
            inequalities.map((it) =>
              it.label === eq.label ? { ...it, solved: true, selectedSolution: true } : it
            )
          );
        } else {
          setQuizMessage("Sai, mời chọn lại!");
        }
        break;
      }
      if (
        clickX >= btn.btn2.x &&
        clickX <= btn.btn2.x + btn.btn2.width &&
        clickY >= btn.btn2.y &&
        clickY <= btn.btn2.y + btn.btn2.height
      ) {
        const eq = btn.eq;
        if (!checkPointInInequality(eq, { x: 0, y: 0 })) {
          setQuizMessage("Chính xác!");
          setInequalities(
            inequalities.map((it) =>
              it.label === eq.label ? { ...it, solved: true, selectedSolution: false } : it
            )
          );
        } else {
          setQuizMessage("Sai, mời chọn lại!");
        }
        break;
      }
    }
  };
  
  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    for (let pt of intersections) {
      const cpt = toCanvasCoordsWrapper(pt.x, pt.y, canvasWidth, canvasHeight, zoom);
      const dx = cpt.x - clickX;
      const dy = cpt.y - clickY;
      if (Math.sqrt(dx * dx + dy * dy) < 10) {
        const ans = prompt("Nhập tọa độ (x,y):");
        if (ans) {
          const parts = ans.split(",");
          const xAns = parseFloat(parts[0]);
          const yAns = parseFloat(parts[1]);
          if (Math.abs(xAns - pt.x) < 0.1 && Math.abs(yAns - pt.y) < 0.1) {
            alert("Chính xác!");
          } else {
            alert("Chưa đúng!");
          }
        }
        break;
      }
    }
  };
  
  useEffect(() => {
    redraw();
  }, [inequalities, zoom]);
  
  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      onWheel={handleWheel}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
      style={{
        border: "1px solid #ccc",
        cursor: "default",
        backgroundColor: "#ffffff",
        marginLeft: "10px",
      }}
    />
  );
};

export default CoordinatePlane;
