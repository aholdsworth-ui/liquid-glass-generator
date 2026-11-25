export type PanelShape = "text-panel" | "circle" | "cta-pill";
export type GlassShape = PanelShape;
export type BackgroundTheme = "imagery" | "grey1200" | "white";
export type GlassTheme = BackgroundTheme;
export type FormatRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface GlassPanelConfig {
  width: number;
  height: number;
  shape: PanelShape;
  theme: BackgroundTheme;
  frostOpacity: number;
  customRadius?: number;
  includeShadow?: boolean;
}

export interface StickerCategory {
  id: string;
  title: string;
  count: number;
  shape: PanelShape;
  sizes: [number, number][];
}

export const FORMAT_DIMENSIONS: Record<FormatRatio, { width: number; height: number; label: string }> = {
  "1:1": { width: 1080, height: 1080, label: "1:1 (1080×1080)" },
  "4:5": { width: 1080, height: 1350, label: "4:5 (1080×1350)" },
  "9:16": { width: 1080, height: 1920, label: "9:16 (1080×1920)" },
  "16:9": { width: 1920, height: 1080, label: "16:9 (1920×1080)" },
};

export const LOCKED_THEME_OPACITY: Record<BackgroundTheme, number> = { imagery: 50, grey1200: 50, white: 50 };

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: "squares",
    title: "Square Text Panels",
    count: 20,
    shape: "text-panel",
    sizes: [
      [120, 120], [160, 160], [200, 200], [240, 240], [280, 280],
      [320, 320], [360, 360], [400, 400], [440, 440], [480, 480],
      [520, 520], [560, 560], [600, 600], [640, 640], [700, 700],
      [760, 760], [820, 820], [880, 880], [920, 920], [960, 960],
    ],
  },
  {
    id: "horizontal",
    title: "Horizontal Text Panels",
    count: 20,
    shape: "text-panel",
    sizes: [
      [330, 110], [420, 110], [480, 140], [560, 160], [640, 180],
      [720, 220], [840, 240], [920, 260], [960, 300], [960, 420],
      [960, 540], [800, 360], [880, 480], [1040, 420], [1200, 360],
      [1200, 520], [1400, 440], [1400, 680], [1680, 320], [1760, 840],
    ],
  },
  {
    id: "vertical",
    title: "Vertical Text Panels",
    count: 20,
    shape: "text-panel",
    sizes: [
      [260, 360], [300, 420], [340, 480], [380, 520], [420, 560],
      [460, 640], [480, 720], [520, 780], [560, 840], [600, 920],
      [720, 920], [640, 960], [760, 1080], [840, 1120], [920, 1150],
      [960, 1230], [840, 1440], [920, 1600], [960, 1680], [960, 1760],
    ],
  },
  {
    id: "pills",
    title: "CTA Pills",
    count: 10,
    shape: "cta-pill",
    sizes: [
      [160, 52], [205, 64], [205, 80], [260, 72], [300, 80],
      [360, 88], [420, 80], [480, 96], [560, 104], [680, 112],
    ],
  },
  {
    id: "circles",
    title: "Circles",
    count: 10,
    shape: "circle",
    sizes: [
      [56, 56], [72, 72], [88, 88], [104, 104], [120, 120],
      [160, 160], [200, 200], [260, 260], [340, 340], [440, 440],
    ],
  },
];

export function getCornerRadius(width: number, height: number, shape: PanelShape, customRadius = 20): number {
  const maxR = Math.min(width, height) / 2;
  if (shape === "circle" || shape === "cta-pill") return maxR;
  return Math.min(customRadius, maxR);
}

export function getShadowMetrics(width: number, height: number, theme: BackgroundTheme) {
  const minDim = Math.min(width, height);
  const sigma = Math.max(1.5, Math.min(2.8, minDim * 0.034));
  const offsetY = Math.max(1.0, Math.min(2.0, minDim * 0.024));
  const pad = Math.ceil(offsetY + sigma * 3.5 + 2);
  if (theme === "white") return { pad, offsetY, sigma, alpha: 0.21, r: 0, g: 0, b: 0 };
  if (theme === "grey1200") return { pad, offsetY, sigma, alpha: 0.48, r: 0, g: 0, b: 0 };
  return { pad, offsetY, sigma, alpha: 0.25, r: 0, g: 0, b: 0 };
}

function traceRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCrispKeyline(ctx: CanvasRenderingContext2D, pad: number, w: number, h: number, r: number, theme: BackgroundTheme) {
  ctx.save();
  if (theme === "white") {
    const oIns = 0.2;
    traceRoundedRect(ctx, pad + oIns, pad + oIns, w - oIns * 2, h - oIns * 2, Math.max(0, r - oIns));
    ctx.strokeStyle = "rgba(198, 202, 206, 0.30)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    const kIns = 0.65;
    traceRoundedRect(ctx, pad + kIns, pad + kIns, w - kIns * 2, h - kIns * 2, Math.max(0, r - kIns));
    ctx.strokeStyle = "rgba(255, 255, 255, 0.90)";
    ctx.lineWidth = 1.15;
    ctx.stroke();
  } else {
    const kIns = 0.65;
    traceRoundedRect(ctx, pad + kIns, pad + kIns, w - kIns * 2, h - kIns * 2, Math.max(0, r - kIns));
    const kg = ctx.createLinearGradient(pad, pad, pad + w, pad + h);
    if (theme === "grey1200") {
      kg.addColorStop(0, "rgba(255, 255, 255, 0.86)");
      kg.addColorStop(0.5, "rgba(242, 244, 248, 0.58)");
      kg.addColorStop(1, "rgba(255, 255, 255, 0.78)");
      ctx.lineWidth = 1.25;
    } else {
      kg.addColorStop(0, "rgba(255, 255, 255, 0.82)");
      kg.addColorStop(0.5, "rgba(245, 246, 246, 0.52)");
      kg.addColorStop(1, "rgba(255, 255, 255, 0.74)");
      ctx.lineWidth = 1.15;
    }
    ctx.strokeStyle = kg;
    ctx.stroke();
  }
  ctx.restore();
}

let _ctxFilterSupported: boolean | null = null;
function hasNativeCtxFilter(): boolean {
  if (_ctxFilterSupported !== null) return _ctxFilterSupported;
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  _ctxFilterSupported = !!ctx && typeof ctx.filter === "string";
  return _ctxFilterSupported;
}

function applyGaussianBlur(src: HTMLCanvasElement, sigma: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const oCtx = out.getContext("2d")!;

  if (sigma <= 0.15) {
    oCtx.drawImage(src, 0, 0);
    return out;
  }

  if (hasNativeCtxFilter()) {
    oCtx.filter = `blur(${sigma.toFixed(2)}px)`;
    oCtx.drawImage(src, 0, 0);
    oCtx.filter = "none";
    return out;
  }

  // Premultiplied 3-pass separable box blur fallback for older Safari versions
  const sCtx = src.getContext("2d")!;
  const img = sCtx.getImageData(0, 0, w, h);
  const px = img.data;
  const len = w * h;
  let pr = new Float32Array(len);
  let pg = new Float32Array(len);
  let pb = new Float32Array(len);
  let pa = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const a = px[i * 4 + 3] / 255;
    pa[i] = a;
    pr[i] = px[i * 4] * a;
    pg[i] = px[i * 4 + 1] * a;
    pb[i] = px[i * 4 + 2] * a;
  }

  const rad = Math.max(1, Math.round(sigma * 1.1));
  const tr = new Float32Array(len);
  const tg = new Float32Array(len);
  const tb = new Float32Array(len);
  const ta = new Float32Array(len);

  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0, sa = 0, cnt = 0;
        const x0 = Math.max(0, x - rad);
        const x1 = Math.min(w - 1, x + rad);
        for (let k = x0; k <= x1; k++) {
          const idx = row + k;
          sr += pr[idx]; sg += pg[idx]; sb += pb[idx]; sa += pa[idx];
          cnt++;
        }
        const oIdx = row + x;
        tr[oIdx] = sr / cnt; tg[oIdx] = sg / cnt; tb[oIdx] = sb / cnt; ta[oIdx] = sa / cnt;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sr = 0, sg = 0, sb = 0, sa = 0, cnt = 0;
        const y0 = Math.max(0, y - rad);
        const y1 = Math.min(h - 1, y + rad);
        for (let k = y0; k <= y1; k++) {
          const idx = k * w + x;
          sr += tr[idx]; sg += tg[idx]; sb += tb[idx]; sa += ta[idx];
          cnt++;
        }
        const oIdx = y * w + x;
        pr[oIdx] = sr / cnt; pg[oIdx] = sg / cnt; pb[oIdx] = sb / cnt; pa[oIdx] = sa / cnt;
      }
    }
  }

  for (let i = 0; i < len; i++) {
    const a = pa[i];
    if (a <= 0.0005) {
      px[i * 4 + 3] = 0;
    } else {
      px[i * 4] = Math.min(255, Math.round(pr[i] / a));
      px[i * 4 + 1] = Math.min(255, Math.round(pg[i] / a));
      px[i * 4 + 2] = Math.min(255, Math.round(pb[i] / a));
      px[i * 4 + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  oCtx.putImageData(img, 0, 0);
  return out;
}

export function renderStandaloneGlassPanel({
  width,
  height,
  shape,
  theme,
  frostOpacity,
  customRadius = 20,
  includeShadow = true,
}: GlassPanelConfig): HTMLCanvasElement {
  const w = Math.max(16, Math.round(width));
  const h = Math.max(16, Math.round(height));
  const r = getCornerRadius(w, h, shape, customRadius);
  const rawS = Math.max(0, Math.min(1.0, frostOpacity));
  const s = theme === "grey1200" ? rawS * 0.5 : rawS;

  const shadow = getShadowMetrics(w, h, theme);
  const workPad = shadow.pad;
  const cw = w + workPad * 2;
  const ch = h + workPad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  // 1. Exterior-only soft drop shadow
  if (includeShadow) {
    const shRaw = document.createElement("canvas");
    shRaw.width = cw;
    shRaw.height = ch;
    const shCtx = shRaw.getContext("2d")!;
    shCtx.fillStyle = `rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, ${shadow.alpha.toFixed(3)})`;
    traceRoundedRect(shCtx, workPad, workPad + shadow.offsetY, w, h, r);
    shCtx.fill();

    const shBlurred = applyGaussianBlur(shRaw, shadow.sigma);
    ctx.save();
    ctx.drawImage(shBlurred, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000000";
    traceRoundedRect(ctx, workPad, workPad, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  // 2. Neutral interior frost + smooth 2D Gaussian inner glow (zero 45° bevel corners)
  ctx.save();
  traceRoundedRect(ctx, workPad, workPad, w, h, r);
  ctx.clip();

  const frostGrad = ctx.createLinearGradient(0, workPad, 0, workPad + h);
  if (theme === "white") {
    const a = Math.min(0.85, 0.07 + s * 0.5);
    frostGrad.addColorStop(0, `rgba(244, 244, 243, ${(a * 0.96).toFixed(4)})`);
    frostGrad.addColorStop(1, `rgba(244, 244, 243, ${Math.min(0.86, a * 1.02).toFixed(4)})`);
  } else if (theme === "grey1200") {
    const a = Math.min(0.56, 0.035 + s * 0.19);
    frostGrad.addColorStop(0, `rgba(246, 246, 247, ${(a * 0.95).toFixed(4)})`);
    frostGrad.addColorStop(1, `rgba(246, 246, 247, ${Math.min(0.58, a * 1.03).toFixed(4)})`);
  } else {
    const a = Math.min(0.68, 0.05 + s * 0.34);
    frostGrad.addColorStop(0, `rgba(252, 252, 250, ${(a * 0.96).toFixed(4)})`);
    frostGrad.addColorStop(1, `rgba(252, 252, 250, ${Math.min(0.7, a * 1.02).toFixed(4)})`);
  }
  ctx.fillStyle = frostGrad;
  ctx.fillRect(workPad, workPad, w, h);

  const minDim = Math.min(w, h);
  const glowStroke = Math.max(10, Math.min(32, minDim * 0.34));
  const glowBlur = Math.max(4.5, glowStroke * 0.45);

  const glowRaw = document.createElement("canvas");
  glowRaw.width = cw;
  glowRaw.height = ch;
  const gCtx = glowRaw.getContext("2d")!;
  const glowGrad = gCtx.createLinearGradient(0, workPad, 0, workPad + h);

  if (theme === "white") {
    glowGrad.addColorStop(0, `rgba(255, 255, 255, ${(0.08 + 0.04 * s).toFixed(3)})`);
    glowGrad.addColorStop(0.42, `rgba(255, 255, 255, ${(0.52 + 0.16 * s).toFixed(3)})`);
    glowGrad.addColorStop(1, `rgba(255, 255, 255, ${(0.68 + 0.2 * s).toFixed(3)})`);
  } else if (theme === "grey1200") {
    glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.03)");
    glowGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.19)");
    glowGrad.addColorStop(1, "rgba(255, 255, 255, 0.25)");
  } else {
    glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.06)");
    glowGrad.addColorStop(0.42, `rgba(255, 255, 255, ${(0.42 + 0.12 * s).toFixed(3)})`);
    glowGrad.addColorStop(1, `rgba(255, 255, 255, ${(0.54 + 0.14 * s).toFixed(3)})`);
  }

  gCtx.strokeStyle = glowGrad;
  gCtx.lineWidth = glowStroke;
  traceRoundedRect(gCtx, workPad, workPad, w, h, r);
  gCtx.stroke();

  const glowBlurred = applyGaussianBlur(glowRaw, glowBlur);
  ctx.drawImage(glowBlurred, 0, 0);
  ctx.restore();

  // 3. Crisp anti-aliased vector keyline
  drawCrispKeyline(ctx, workPad, w, h, r, theme);

  if (!includeShadow) {
    const cropped = document.createElement("canvas");
    cropped.width = w;
    cropped.height = h;
    cropped.getContext("2d")!.drawImage(canvas, workPad, workPad, w, h, 0, 0, w, h);
    return cropped;
  }
  return canvas;
}

function renderBlurredBackdropCrop(
  bgSource: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  w: number,
  h: number,
  theme: BackgroundTheme,
  rawOpacity: number
): HTMLCanvasElement {
  const margin = 40;
  const sw = w + margin * 2;
  const sh = h + margin * 2;

  const sharp = document.createElement("canvas");
  sharp.width = sw;
  sharp.height = sh;
  const sCtx = sharp.getContext("2d")!;
  sCtx.fillStyle = theme === "grey1200" ? "#121317" : "#FFFFFF";
  sCtx.fillRect(0, 0, sw, sh);
  sCtx.drawImage(bgSource, -(panelX - margin), -(panelY - margin), stageWidth, stageHeight);

  const blurPx = 7.5 + rawOpacity * 10.0;
  const blurredFull = applyGaussianBlur(sharp, blurPx);

  const cropped = document.createElement("canvas");
  cropped.width = w;
  cropped.height = h;
  cropped.getContext("2d")!.drawImage(blurredFull, -margin, -margin);
  return cropped;
}

export function renderRefractedGlassPatch(
  bgSource: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: GlassPanelConfig
): HTMLCanvasElement {
  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, config.customRadius ?? 20);
  const rawS = Math.max(0, Math.min(1.0, config.frostOpacity));
  const shadow = getShadowMetrics(w, h, config.theme);
  const outPad = shadow.pad;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w + outPad * 2;
  outCanvas.height = h + outPad * 2;
  const outCtx = outCanvas.getContext("2d")!;

  const blurredCrop = renderBlurredBackdropCrop(bgSource, stageWidth, stageHeight, panelX, panelY, w, h, config.theme, rawS);
  const standalone = renderStandaloneGlassPanel({ ...config, width: w, height: h, includeShadow: true });

  outCtx.save();
  traceRoundedRect(outCtx, outPad, outPad, w, h, r);
  outCtx.clip();
  outCtx.drawImage(blurredCrop, outPad, outPad);
  outCtx.restore();

  outCtx.drawImage(standalone, 0, 0);
  return outCanvas;
}

export function generateStandaloneGlassSvg(config: GlassPanelConfig): string {
  const w = Math.max(16, Math.round(config.width));
  const h = Math.max(16, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, config.customRadius ?? 20);
  const rawS = Math.max(0, Math.min(1.0, config.frostOpacity));
  const s = config.theme === "grey1200" ? rawS * 0.5 : rawS;
  const shadow = getShadowMetrics(w, h, config.theme);
  const pad = shadow.pad;

  const baseFrostAlpha =
    config.theme === "grey1200"
      ? 0.035 + s * 0.19
      : config.theme === "white"
      ? Math.min(0.85, 0.07 + s * 0.5)
      : 0.05 + s * 0.34;

  const frostColor = config.theme === "white" ? "#F4F4F3" : config.theme === "grey1200" ? "#F6F6F7" : "#FCFCFA";
  const topFrostOp = Math.min(0.86, baseFrostAlpha * 0.96).toFixed(3);
  const botFrostOp = Math.min(0.86, baseFrostAlpha * 1.02).toFixed(3);

  const glowStroke = Math.max(10, Math.min(32, Math.min(w, h) * 0.34));
  const glowBlur = Math.max(4.5, glowStroke * 0.45).toFixed(2);
  const glowMid = config.theme === "grey1200" ? 0.19 : config.theme === "white" ? 0.52 + 0.16 * s : 0.42 + 0.12 * s;
  const glowPeak = config.theme === "grey1200" ? 0.25 : config.theme === "white" ? 0.68 + 0.2 * s : 0.54 + 0.14 * s;

  const keylineMarkup =
    config.theme === "white"
      ? `<rect x="0.2" y="0.2" width="${(w - 0.4).toFixed(1)}" height="${(h - 0.4).toFixed(1)}" rx="${Math.max(0, r - 0.2).toFixed(1)}" ry="${Math.max(0, r - 0.2).toFixed(1)}" fill="none" stroke="#C6CACE" stroke-opacity="0.30" stroke-width="0.7" />
    <rect x="0.65" y="0.65" width="${(w - 1.3).toFixed(2)}" height="${(h - 1.3).toFixed(2)}" rx="${Math.max(0, r - 0.65).toFixed(2)}" ry="${Math.max(0, r - 0.65).toFixed(2)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.90" stroke-width="1.15" />`
      : `<rect x="0.65" y="0.65" width="${(w - 1.3).toFixed(2)}" height="${(h - 1.3).toFixed(2)}" rx="${Math.max(0, r - 0.65).toFixed(2)}" ry="${Math.max(0, r - 0.65).toFixed(2)}" fill="none" stroke="#FFFFFF" stroke-opacity="${config.theme === "grey1200" ? "0.76" : "0.70"}" stroke-width="${config.theme === "grey1200" ? "1.25" : "1.15"}" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" fill="none">
  <defs>
    <clipPath id="panel-clip">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" />
    </clipPath>
    <mask id="outer-shadow-mask" maskUnits="userSpaceOnUse" x="${-pad}" y="${-pad}" width="${w + pad * 2}" height="${h + pad * 2}">
      <rect x="${-pad}" y="${-pad}" width="${w + pad * 2}" height="${h + pad * 2}" fill="#FFFFFF" />
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000000" />
    </mask>
    <filter id="drop-shadow-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="${shadow.sigma.toFixed(2)}" />
    </filter>
    <filter id="inner-glow-blur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${glowBlur}" />
    </filter>
    <linearGradient id="frost-fill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${frostColor}" stop-opacity="${topFrostOp}" />
      <stop offset="100%" stop-color="${frostColor}" stop-opacity="${botFrostOp}" />
    </linearGradient>
    <linearGradient id="base-side-glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.04" />
      <stop offset="44%" stop-color="#FFFFFF" stop-opacity="${glowMid.toFixed(3)}" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="${glowPeak.toFixed(3)}" />
    </linearGradient>
  </defs>
  <g id="liquid-glass-shadow" mask="url(#outer-shadow-mask)">
    <rect x="0" y="${shadow.offsetY.toFixed(2)}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000000" fill-opacity="${shadow.alpha.toFixed(3)}" filter="url(#drop-shadow-blur)" />
  </g>
  <g id="liquid-glass-panel" clip-path="url(#panel-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="url(#frost-fill)" />
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="none" stroke="url(#base-side-glow)" stroke-width="${glowStroke.toFixed(1)}" filter="url(#inner-glow-blur)" />
  </g>
  <g id="liquid-glass-keyline">
    ${keylineMarkup}
  </g>
</svg>`;
}

export function generateCompositedGlassSvg(
  bgSource: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: GlassPanelConfig
): string {
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = stageWidth;
  bgCanvas.height = stageHeight;
  bgCanvas.getContext("2d")!.drawImage(bgSource, 0, 0, stageWidth, stageHeight);
  const bgDataUrl = bgCanvas.toDataURL("image/png");

  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, config.customRadius ?? 20);
  const px = Math.round(panelX);
  const py = Math.round(panelY);
  const rawS = Math.max(0, Math.min(1.0, config.frostOpacity));

  // Pre-bake blurred backdrop crop so Adobe InDesign preserves 100% of the background blur
  const blurredCrop = renderBlurredBackdropCrop(bgSource, stageWidth, stageHeight, px, py, w, h, config.theme, rawS);
  const blurredDataUrl = blurredCrop.toDataURL("image/png");

  const innerPanelSvg = generateStandaloneGlassSvg(config)
    .replace(/<\?xml.*?\?>\s*/g, "")
    .replace(/<svg[^>]*>/, `<g id="liquid-glass-svg-panel" transform="translate(${px}, ${py})">`)
    .replace(/<\/svg>\s*$/, "</g>");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${stageWidth}" height="${stageHeight}" viewBox="0 0 ${stageWidth} ${stageHeight}" fill="none">
  <defs>
    <clipPath id="stage-backdrop-clip">
      <rect x="${px}" y="${py}" width="${w}" height="${h}" rx="${r}" ry="${r}" />
    </clipPath>
  </defs>
  <image id="uploaded-background" href="${bgDataUrl}" x="0" y="0" width="${stageWidth}" height="${stageHeight}" />
  <g id="frosted-backdrop" clip-path="url(#stage-backdrop-clip)">
    <image href="${blurredDataUrl}" x="${px}" y="${py}" width="${w}" height="${h}" />
  </g>
  ${innerPanelSvg}
</svg>`;
}
