export type PanelShape = "text-panel" | "circle" | "cta-pill";
export type BackgroundTheme = "imagery" | "grey1200" | "white";
export type FormatRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface ResolvedPanel {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: PanelShape;
  theme: BackgroundTheme;
  frostOpacity: number;
}

export interface BgTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const FORMAT_DIMENSIONS: Record<FormatRatio, { width: number; height: number; label: string }> = {
  "1:1": { width: 1080, height: 1080, label: "1:1 (1080x1080)" },
  "4:5": { width: 1080, height: 1350, label: "4:5 (1080x1350)" },
  "9:16": { width: 1080, height: 1920, label: "9:16 (1080x1920)" },
  "16:9": { width: 1920, height: 1080, label: "16:9 (1920x1080)" },
};

export const LOCKED_STICKER_OPACITY = 50;

export const STICKER_CATEGORIES: { id: string; title: string; count: number; shape: PanelShape; sizes: [number, number][] }[] = [
  { id: "squares", title: "Square Text Panels", count: 20, shape: "text-panel", sizes: [[120,120],[160,160],[200,200],[240,240],[280,280],[320,320],[360,360],[400,400],[440,440],[480,480],[520,520],[560,560],[600,600],[640,640],[700,700],[760,760],[820,820],[880,880],[920,920],[960,960]] },
  { id: "horizontal", title: "Horizontal Text Panels", count: 20, shape: "text-panel", sizes: [[330,110],[420,110],[480,140],[560,160],[640,180],[720,220],[840,240],[920,260],[960,300],[960,420],[960,540],[800,360],[880,480],[1040,420],[1200,360],[1200,520],[1400,440],[1400,680],[1680,320],[1760,840]] },
  { id: "vertical", title: "Vertical Text Panels", count: 20, shape: "text-panel", sizes: [[260,360],[300,420],[340,480],[380,520],[420,560],[460,640],[480,720],[520,780],[560,840],[600,920],[720,920],[640,960],[760,1080],[840,1120],[920,1150],[960,1230],[840,1440],[920,1600],[960,1680],[960,1760]] },
  { id: "pills", title: "CTA Pills", count: 10, shape: "cta-pill", sizes: [[160,52],[205,64],[205,80],[260,72],[300,80],[360,88],[420,80],[480,96],[560,104],[680,112]] },
  { id: "circles", title: "Circles", count: 10, shape: "circle", sizes: [[56,56],[72,72],[88,88],[104,104],[120,120],[160,160],[200,200],[260,260],[340,340],[440,440]] },
];

export function getCornerRadius(w: number, h: number, shape: PanelShape, customRadius = 20): number {
  const maxR = Math.min(w, h) / 2;
  return shape === "circle" || shape === "cta-pill" ? maxR : Math.min(customRadius, maxR);
}

export function getShadowMetrics(w: number, h: number, theme: BackgroundTheme) {
  const minDim = Math.min(w, h);
  const sigma = Math.max(1.5, Math.min(2.8, minDim * 0.034));
  const offsetY = Math.max(1.0, Math.min(2.0, minDim * 0.024));
  const pad = Math.ceil(offsetY + sigma * 3.5 + 2);
  const alpha = theme === "white" ? 0.21 : theme === "grey1200" ? 0.48 : 0.25;
  return { pad, offsetY, sigma, alpha };
}

export function drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const cr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + cr, y);
  ctx.lineTo(x + w - cr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
  ctx.lineTo(x + w, y + h - cr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
  ctx.lineTo(x + cr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - cr);
  ctx.lineTo(x, y + cr);
  ctx.quadraticCurveTo(x, y, x + cr, y);
  ctx.closePath();
}

export function renderStandaloneGlassPanel(opts: {
  width: number; height: number; shape: PanelShape; theme: BackgroundTheme;
  frostOpacity: number; customRadius?: number; includeShadow?: boolean;
}): HTMLCanvasElement {
  const w = Math.max(16, Math.round(opts.width));
  const h = Math.max(16, Math.round(opts.height));
  const r = getCornerRadius(w, h, opts.shape, opts.customRadius ?? 20);
  const sRaw = Math.max(0, Math.min(1, opts.frostOpacity));
  const s = opts.theme === "grey1200" ? sRaw * 0.5 : sRaw;
  const sh = getShadowMetrics(w, h, opts.theme);
  const pad = opts.includeShadow === false ? 0 : sh.pad;

  const canvas = document.createElement("canvas");
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext("2d")!;

  if (opts.includeShadow !== false) {
    ctx.save();
    ctx.filter = `blur(${sh.sigma.toFixed(2)}px)`;
    ctx.fillStyle = `rgba(0,0,0,${sh.alpha})`;
    drawRoundedRectPath(ctx, pad, pad + sh.offsetY, w, h, r);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    drawRoundedRectPath(ctx, pad, pad, w, h, r);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }

  if (opts.theme === "white") {
    ctx.save();
    drawRoundedRectPath(ctx, pad, pad, w, h, r);
    ctx.strokeStyle = "rgba(182,185,190,0.26)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  drawRoundedRectPath(ctx, pad, pad, w, h, r);
  ctx.clip();

  const baseAlpha = opts.theme === "grey1200" ? 0.05 + s * 0.34 : opts.theme === "white" ? Math.min(0.85, 0.07 + s * 0.50) : 0.05 + s * 0.34;
  const rgb = opts.theme === "white" ? "244,244,243" : opts.theme === "grey1200" ? "246,246,247" : "252,252,250";
  const fg = ctx.createLinearGradient(0, pad, 0, pad + h);
  fg.addColorStop(0, `rgba(${rgb},${Math.min(0.86, baseAlpha * 0.96).toFixed(3)})`);
  fg.addColorStop(1, `rgba(${rgb},${Math.min(0.86, baseAlpha * 1.03).toFixed(3)})`);
  ctx.fillStyle = fg;
  ctx.fillRect(pad, pad, w, h);

  const glowStroke = Math.max(10, Math.min(32, Math.min(w, h) * 0.34));
  const gMid = opts.theme === "grey1200" ? 0.10 : opts.theme === "white" ? 0.42 : 0.28;
  const gPeak = opts.theme === "grey1200" ? 0.14 : opts.theme === "white" ? 0.52 : 0.35;
  const gg = ctx.createLinearGradient(0, pad, 0, pad + h);
  gg.addColorStop(0, "rgba(255,255,255,0.03)");
  gg.addColorStop(0.45, `rgba(255,255,255,${gMid})`);
  gg.addColorStop(1, `rgba(255,255,255,${gPeak})`);
  ctx.save();
  ctx.filter = `blur(${(glowStroke * 0.42).toFixed(1)}px)`;
  drawRoundedRectPath(ctx, pad, pad, w, h, r);
  ctx.strokeStyle = gg;
  ctx.lineWidth = glowStroke;
  ctx.stroke();
  ctx.restore();

  drawRoundedRectPath(ctx, pad + 0.55, pad + 0.55, w - 1.1, h - 1.1, Math.max(0, r - 0.55));
  ctx.strokeStyle = opts.theme === "white" ? "rgba(255,255,255,0.92)" : opts.theme === "grey1200" ? "rgba(248,249,250,0.74)" : "rgba(248,249,248,0.54)";
  ctx.lineWidth = opts.theme === "imagery" ? 1.05 : 1.15;
  ctx.stroke();
  ctx.restore();
  return canvas;
}

const panelCache = new Map<string, { canvas: HTMLCanvasElement; pad: number }>();
export function getCachedGlassPanel(opts: { width: number; height: number; shape: PanelShape; theme: BackgroundTheme; frostOpacity: number }) {
  const key = `${Math.round(opts.width)}x${Math.round(opts.height)}-${opts.shape}-${opts.theme}-${opts.frostOpacity.toFixed(3)}`;
  const hit = panelCache.get(key);
  if (hit) return hit;
  if (panelCache.size > 48) panelCache.clear();
  const sh = getShadowMetrics(opts.width, opts.height, opts.theme);
  const canvas = renderStandaloneGlassPanel(opts);
  const entry = { canvas, pad: sh.pad };
  panelCache.set(key, entry);
  return entry;
}

export function getMediaDrawRect(srcW: number, srcH: number, stageW: number, stageH: number, bg: BgTransform) {
  const base = Math.max(stageW / Math.max(1, srcW), stageH / Math.max(1, srcH));
  const dw = srcW * base * bg.scale;
  const dh = srcH * base * bg.scale;
  return { dx: (stageW - dw) / 2 + bg.offsetX, dy: (stageH - dh) / 2 + bg.offsetY, dw, dh };
}

export function drawCompositedStageFrame(
  ctx: CanvasRenderingContext2D, source: CanvasImageSource, srcW: number, srcH: number,
  stageW: number, stageH: number, bg: BgTransform, panels: ResolvedPanel[]
) {
  const { dx, dy, dw, dh } = getMediaDrawRect(srcW, srcH, stageW, stageH, bg);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, stageW, stageH);
  ctx.clip();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, stageW, stageH);
  ctx.drawImage(source, dx, dy, dw, dh);

  for (const p of panels) {
    const w = Math.max(24, Math.round(p.width));
    const h = Math.max(24, Math.round(p.height));
    const r = getCornerRadius(w, h, p.shape, 20);
    const sEff = p.theme === "grey1200" ? p.frostOpacity * 0.5 : p.frostOpacity;
    const blurPx = (7.5 + sEff * 10.0).toFixed(1);
    ctx.save();
    drawRoundedRectPath(ctx, p.x, p.y, w, h, r);
    ctx.clip();
    ctx.filter = `blur(${blurPx}px) saturate(102%)`;
    ctx.drawImage(source, dx, dy, dw, dh);
    ctx.restore();

    const { canvas: glassCanvas, pad } = getCachedGlassPanel({ width: w, height: h, shape: p.shape, theme: p.theme, frostOpacity: p.frostOpacity });
    ctx.drawImage(glassCanvas, Math.round(p.x - pad), Math.round(p.y - pad));
  }
  ctx.restore();
}

export function generateStandaloneGlassSvg(opts: { width: number; height: number; shape: PanelShape; theme: BackgroundTheme; frostOpacity: number; includeShadow?: boolean }): string {
  const w = Math.max(16, Math.round(opts.width)), h = Math.max(16, Math.round(opts.height));
  const r = getCornerRadius(w, h, opts.shape, 20);
  const s = opts.theme === "grey1200" ? Math.max(0, Math.min(1, opts.frostOpacity)) * 0.5 : Math.max(0, Math.min(1, opts.frostOpacity));
  const sh = getShadowMetrics(w, h, opts.theme), pad = opts.includeShadow === false ? 0 : sh.pad;
  const baseA = opts.theme === "grey1200" ? 0.05 + s * 0.34 : opts.theme === "white" ? Math.min(0.85, 0.07 + s * 0.50) : 0.05 + s * 0.34;
  const fc = opts.theme === "white" ? "#F4F4F3" : opts.theme === "grey1200" ? "#F6F6F7" : "#FCFCFA";
  const gs = Math.max(10, Math.min(32, Math.min(w, h) * 0.34));
  const gm = opts.theme === "grey1200" ? "0.10" : opts.theme === "white" ? "0.42" : "0.28";
  const gp = opts.theme === "grey1200" ? "0.28" : opts.theme === "white" ? "0.52" : "0.35";
  const rc = opts.theme === "white" ? "#FFFFFF" : "#F8F9FA";
  const ro = opts.theme === "white" ? "0.92" : opts.theme === "grey1200" ? "0.74" : "0.54";
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${w+pad*2}" height="${h+pad*2}" viewBox="${-pad} ${-pad} ${w+pad*2} ${h+pad*2}" fill="none"><defs><clipPath id="pc"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"/></clipPath><mask id="sm" maskUnits="userSpaceOnUse" x="${-pad}" y="${-pad}" width="${w+pad*2}" height="${h+pad*2}"><rect x="${-pad}" y="${-pad}" width="${w+pad*2}" height="${h+pad*2}" fill="#FFF"/><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000"/></mask><filter id="sb" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="${sh.sigma.toFixed(2)}"/></filter><filter id="gb" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="${(gs*0.42).toFixed(1)}"/></filter><linearGradient id="ff" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${fc}" stop-opacity="${Math.min(0.86,baseA*0.96).toFixed(3)}"/><stop offset="100%" stop-color="${fc}" stop-opacity="${Math.min(0.86,baseA*1.03).toFixed(3)}"/></linearGradient><linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF" stop-opacity="0.03"/><stop offset="45%" stop-color="#FFF" stop-opacity="${gm}"/><stop offset="100%" stop-color="#FFF" stop-opacity="${gp}"/></linearGradient></defs>${opts.includeShadow === false ? "" : `<g mask="url(#sm)"><rect x="0" y="${sh.offsetY.toFixed(2)}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000" fill-opacity="${sh.alpha.toFixed(3)}" filter="url(#sb)"/></g>`}${opts.theme==="white"?`<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" stroke="#B6B9BE" stroke-opacity="0.26" stroke-width="0.8"/>`:""}<g clip-path="url(#pc)"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="url(#ff)"/><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" stroke="url(#bg)" stroke-width="${gs.toFixed(1)}" filter="url(#gb)"/><rect x="0.55" y="0.55" width="${w-1.1}" height="${h-1.1}" rx="${Math.max(0,r-0.55)}" ry="${Math.max(0,r-0.55)}" stroke="${rc}" stroke-opacity="${ro}" stroke-width="1.15"/></g></svg>`;
}

export function generateCompositedMultiGlassSvg(
  source: CanvasImageSource, srcW: number, srcH: number, stageW: number, stageH: number, bg: BgTransform, panels: ResolvedPanel[]
): string {
  const c = document.createElement("canvas"); c.width = stageW; c.height = stageH;
  const bCtx = c.getContext("2d")!;
  const { dx, dy, dw, dh } = getMediaDrawRect(srcW, srcH, stageW, stageH, bg);
  bCtx.fillStyle = "#FFFFFF"; bCtx.fillRect(0, 0, stageW, stageH);
  bCtx.drawImage(source, dx, dy, dw, dh);
  const bgUrl = c.toDataURL("image/png");

  const defs: string[] = [], layers: string[] = [];
  panels.forEach((p, i) => {
    const w = Math.max(24, Math.round(p.width)), h = Math.max(24, Math.round(p.height)), r = getCornerRadius(w, h, p.shape, 20);
    const px = Math.round(p.x), py = Math.round(p.y);
    const sEff = p.theme === "grey1200" ? p.frostOpacity * 0.5 : p.frostOpacity;
    const blurPx = (7.5 + sEff * 10.0).toFixed(1);
    defs.push(`<clipPath id="sc${i}"><rect x="${px}" y="${py}" width="${w}" height="${h}" rx="${r}" ry="${r}"/></clipPath><filter id="sb${i}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blurPx}"/></filter>`);
    const inner = generateStandaloneGlassSvg(p).replace(/<\?xml.*?\?>/g, "").replace(/id="([a-z]+)"/g, `id="$1_${i}"`).replace(/url\(#([a-z]+)\)/g, `url(#$1_${i})`).replace(/<svg[^>]*>/, `<g transform="translate(${px},${py})">`).replace(/<\/svg>$/, "</g>");
    layers.push(`<g clip-path="url(#sc${i})"><image href="${bgUrl}" x="0" y="0" width="${stageW}" height="${stageH}" filter="url(#sb${i})"/></g>${inner}`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${stageW}" height="${stageH}" viewBox="0 0 ${stageW} ${stageH}" fill="none"><defs>${defs.join("")}</defs><image href="${bgUrl}" x="0" y="0" width="${stageW}" height="${stageH}"/>${layers.join("")}</svg>`;
}


export function renderRefractedGlassPatch(
  bgSource: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: {
    width: number;
    height: number;
    shape: PanelShape;
    theme: BackgroundTheme;
    frostOpacity: number;
    customRadius?: number;
  }
): HTMLCanvasElement {
  const w = Math.max(16, Math.round(config.width));
  const h = Math.max(16, Math.round(config.height));
  const maxR = Math.min(w, h) / 2;
  const r = config.shape === "circle" || config.shape === "cta-pill" ? maxR : Math.min(config.customRadius ?? 20, maxR);

  const standalone = renderStandaloneGlassPanel({
    width: w,
    height: h,
    shape: config.shape,
    theme: config.theme,
    frostOpacity: config.frostOpacity,
    customRadius: config.customRadius ?? 20,
    includeShadow: true,
  });

  const cw = standalone.width;
  const ch = standalone.height;
  const outPad = (cw - w) / 2;

  const pad = 36;
  const sw = w + pad * 2;
  const sh = h + pad * 2;
  const sx = Math.floor(panelX - pad);
  const sy = Math.floor(panelY - pad);

  const sharpBuf = document.createElement("canvas");
  sharpBuf.width = sw;
  sharpBuf.height = sh;
  const sCtx = sharpBuf.getContext("2d")!;
  sCtx.fillStyle = config.theme === "grey1200" ? "#121317" : "#FFFFFF";
  sCtx.fillRect(0, 0, sw, sh);
  sCtx.drawImage(bgSource, -sx, -sy, stageWidth, stageHeight);

  const blurBuf = document.createElement("canvas");
  blurBuf.width = sw;
  blurBuf.height = sh;
  const bCtx = blurBuf.getContext("2d")!;
  const blurPx = 8 + config.frostOpacity * 10;
  bCtx.filter = `blur(${blurPx.toFixed(1)}px) saturate(103%)`;
  bCtx.drawImage(sharpBuf, 0, 0);
  bCtx.filter = "none";

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const oCtx = out.getContext("2d")!;

  oCtx.save();
  oCtx.beginPath();
  oCtx.roundRect(outPad, outPad, w, h, r);
  oCtx.clip();
  oCtx.drawImage(blurBuf, outPad - pad, outPad - pad);
  oCtx.restore();

  oCtx.drawImage(standalone, 0, 0);
  return out;
}
