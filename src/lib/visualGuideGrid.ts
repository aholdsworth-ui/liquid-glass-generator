export function drawVisualGuideGrid(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  vs: number,
  frameW: number,
  frameH: number,
  density: number
) {
  if (!density || density <= 0 || frameW <= 0 || frameH <= 0 || vs <= 0) return;
  const gw = frameW * vs;
  const gh = frameH * vs;
  if (gw < 4 || gh < 4) return;
  const t = Math.max(0, Math.min(100, density)) / 100;
  const minDivs = Math.max(2, Math.round(2 + t * 30));
  const cols = frameW <= frameH ? minDivs : Math.max(2, Math.round(minDivs * (frameW / frameH)));
  const rows = frameH <= frameW ? minDivs : Math.max(2, Math.round(minDivs * (frameH / frameW)));
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, gw, gh); ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(186, 190, 198, 0.52)";
  ctx.beginPath();
  for (let i = 1; i < cols; i++) { const x = Math.round(ox + (gw * i) / cols) + 0.5; ctx.moveTo(x, oy); ctx.lineTo(x, oy + gh); }
  for (let j = 1; j < rows; j++) { const y = Math.round(oy + (gh * j) / rows) + 0.5; ctx.moveTo(ox, y); ctx.lineTo(ox + gw, y); }
  ctx.stroke();
  ctx.restore();
}
