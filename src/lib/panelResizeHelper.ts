export type PanelResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function handleToCursor(h: PanelResizeHandle): string {
  if (h === "nw" || h === "se") return "nwse-resize";
  if (h === "ne" || h === "sw") return "nesw-resize";
  if (h === "n" || h === "s") return "ns-resize";
  return "ew-resize";
}

export function hitTestPanelHandle(
  px: number, py: number, pw: number, ph: number,
  fx: number, fy: number, tol: number
): PanelResizeHandle | null {
  const cr = Math.min(tol * 1.15, Math.max(6, Math.min(pw, ph) * 0.34));
  const corners: [PanelResizeHandle, number, number][] = [
    ["nw", px, py], ["ne", px + pw, py],
    ["se", px + pw, py + ph], ["sw", px, py + ph],
  ];
  for (const [k, cx, cy] of corners) {
    if (Math.hypot(fx - cx, fy - cy) <= cr) return k;
  }
  const inB = Math.min(tol * 0.7, Math.max(4, Math.min(pw, ph) * 0.24));
  const outB = tol * 0.9;
  const mids: [PanelResizeHandle, number, number][] = [
    ["n", px + pw / 2, py], ["s", px + pw / 2, py + ph],
    ["w", px, py + ph / 2], ["e", px + pw, py + ph / 2],
  ];
  for (const [k, mx, my] of mids) {
    if (Math.hypot(fx - mx, fy - my) <= cr * 0.95) return k;
  }
  if (fx >= px && fx <= px + pw) {
    if (fy >= py - outB && fy <= py + inB) return "n";
    if (fy >= py + ph - inB && fy <= py + ph + outB) return "s";
  }
  if (fy >= py && fy <= py + ph) {
    if (fx >= px - outB && fx <= px + inB) return "w";
    if (fx >= px + pw - inB && fx <= px + pw + outB) return "e";
  }
  return null;
}

export function computePanelResize(
  h: PanelResizeHandle, sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, shape: string, shiftKey: boolean
): { x: number; y: number; w: number; h: number } {
  const MIN = 24, MAX = 4000, r = sx + sw, b = sy + sh;
  let x = sx, y = sy, nw = sw, nh = sh;
  if (h.includes("e")) nw = Math.max(MIN, Math.min(MAX, Math.round(sw + dx)));
  if (h.includes("w")) { nw = Math.max(MIN, Math.min(MAX, Math.round(sw - dx))); x = r - nw; }
  if (h.includes("s")) nh = Math.max(MIN, Math.min(MAX, Math.round(sh + dy)));
  if (h.includes("n")) { nh = Math.max(MIN, Math.min(MAX, Math.round(sh - dy))); y = b - nh; }
  if (shape === "circle") {
    if (h === "e" || h === "w") { nh = nw; y = Math.round(sy + sh / 2 - nh / 2); }
    else if (h === "n" || h === "s") { nw = nh; x = Math.round(sx + sw / 2 - nw / 2); }
    else {
      const dd = ((h.includes("e") ? dx : -dx) + (h.includes("s") ? dy : -dy)) / 2;
      nw = nh = Math.max(MIN, Math.min(MAX, Math.round(sw + dd)));
      x = h.includes("w") ? r - nw : sx;
      y = h.includes("n") ? b - nh : sy;
    }
  } else if (shiftKey && h.length === 2) {
    const asp = sw / Math.max(1, sh);
    nh = Math.max(MIN, Math.min(MAX, Math.round(nw / asp)));
    nw = Math.max(MIN, Math.min(MAX, Math.round(nh * asp)));
    if (h.includes("w")) x = r - nw;
    if (h.includes("n")) y = b - nh;
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(nw), h: Math.round(nh) };
}

export function drawPanelHandlesOnCtx(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  u: number, active: boolean, label?: string
): void {
  ctx.save();
  const col = active ? "#1A73E8" : "#121317";
  ctx.strokeStyle = "rgba(18,19,23,0.28)";
  ctx.lineWidth = 1.4 * u;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = active ? "#1A73E8" : "rgba(255,255,255,0.9)";
  ctx.lineWidth = (active ? 1.8 : 1.2) * u;
  if (!active) ctx.setLineDash([4 * u, 4 * u]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  const dot = (cx: number, cy: number, hw: number, hh: number) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    if ((ctx as any).roundRect) (ctx as any).roundRect(cx - hw, cy - hh, hw * 2, hh * 2, 2 * u);
    else ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.fill();
    ctx.stroke();
  };
  const s = 4.2 * u;
  for (const [cx, cy] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) dot(cx, cy, s, s);
  if (w > 34 * u) { dot(x + w / 2, y, 7 * u, 3.2 * u); dot(x + w / 2, y + h, 7 * u, 3.2 * u); }
  if (h > 34 * u) { dot(x, y + h / 2, 3.2 * u, 7 * u); dot(x + w, y + h / 2, 3.2 * u, 7 * u); }
  if (active && label) {
    ctx.font = `600 ${Math.round(11 * u)}px system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 14 * u, th = 20 * u;
    const bx = Math.max(4 * u, Math.min(ctx.canvas.width - tw - 4 * u, x + w / 2 - tw / 2));
    const by = y > th + 10 * u ? y - th - 8 * u : Math.min(ctx.canvas.height - th - 4 * u, y + h + 8 * u);
    ctx.fillStyle = "rgba(18,19,23,0.9)";
    ctx.beginPath();
    if ((ctx as any).roundRect) (ctx as any).roundRect(bx, by, tw, th, 6 * u);
    else ctx.rect(bx, by, tw, th);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx + 7 * u, by + th / 2);
  }
  ctx.restore();
}

export function hitTestPanelsList(
  panels: any[], fx: number, fy: number, fw: number, fh: number, rect: DOMRect
): { idx: number; handle: PanelResizeHandle | null; inside: boolean; pw: number; ph: number } | null {
  const tol = 12 * Math.max(fw / Math.max(100, rect.width * 0.82), fh / Math.max(100, rect.height * 0.82));
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    const pw = Math.max(24, parseInt(p.widthInput || "0", 10) || 0);
    const ph = p.shape === "circle" ? pw : Math.max(24, parseInt(p.heightInput || "0", 10) || 0);
    const h = hitTestPanelHandle(p.x, p.y, pw, ph, fx, fy, tol);
    if (h) return { idx: i, handle: h, inside: true, pw, ph };
    if (fx >= p.x && fx <= p.x + pw && fy >= p.y && fy <= p.y + ph) return { idx: i, handle: null, inside: true, pw, ph };
  }
  return null;
}

export function drawStagePanelsHandles(
  ctx: CanvasRenderingContext2D, origPanels: any[], pPanels: any[],
  ox: number, oy: number, dw: number | null, dh: number | null,
  fw: number, fh: number, activeIdx: number
): void {
  origPanels.forEach((o: any, i: number) => {
    const ow = Math.max(24, parseInt(o.widthInput || "0", 10) || 0);
    const oh = o.shape === "circle" ? ow : Math.max(24, parseInt(o.heightInput || "0", 10) || 0);
    const lbl = o.shape === "circle" ? `${ow} px \u2300` : `${ow} \u00D7 ${oh} px`;
    if (dw !== null && dh !== null) {
      const sx = dw / fw, sy = dh / fh;
      drawPanelHandlesOnCtx(ctx, ox + o.x * sx, oy + o.y * sy, ow * sx, oh * sy, 1, activeIdx === i, lbl);
    } else if (pPanels[i]) {
      const pp = pPanels[i];
      const pw = Math.max(8, parseInt(pp.widthInput || "0", 10) || 0);
      const ph = pp.shape === "circle" ? pw : Math.max(8, parseInt(pp.heightInput || "0", 10) || 0);
      drawPanelHandlesOnCtx(ctx, ox + pp.x, oy + pp.y, pw, ph, 1, activeIdx === i, lbl);
    }
  });
}
