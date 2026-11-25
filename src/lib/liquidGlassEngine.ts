export type PanelShape = "text-panel" | "circle" | "cta-pill";
export type GlassShape = PanelShape;
export type GlassTheme = "imagery" | "grey1200" | "white";
export type BackgroundTheme = GlassTheme;
export type FormatRatio = "1:1" | "4:5" | "9:16" | "16:9";

export const FORMAT_DIMENSIONS: Record<
  FormatRatio,
  { width: number; height: number; label: string }
> = {
  "1:1": { width: 1080, height: 1080, label: "1:1 (1080×1080)" },
  "4:5": { width: 1080, height: 1350, label: "4:5 (1080×1350)" },
  "9:16": { width: 1080, height: 1920, label: "9:16 (1080×1920)" },
  "16:9": { width: 1920, height: 1080, label: "16:9 (1920×1080)" },
};

export const LOCKED_THEME_OPACITY: Record<GlassTheme, number> = {
  imagery: 35,
  grey1200: 40,
  white: 80,
};

export interface StickerCategory {
  id: string;
  title: string;
  count: number;
  shape: PanelShape;
  sizes: [number, number][];
}

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

export interface StandaloneGlassParams {
  width: number;
  height: number;
  shape: PanelShape;
  theme: GlassTheme;
  frostOpacity: number;
  customRadius?: number;
  cornerRadius?: number;
  includeShadow?: boolean;
}
export type GlassConfig = StandaloneGlassParams;

export function getCornerRadius(
  width: number,
  height: number,
  shape: PanelShape,
  customRadius = 20
): number {
  const maxR = Math.min(width, height) / 2;
  return shape === "circle" || shape === "cta-pill"
    ? maxR
    : Math.min(customRadius, maxR);
}

function sdRoundBox(
  px: number,
  py: number,
  bx: number,
  by: number,
  r: number
): number {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

function sdRoundBoxNormal(
  px: number,
  py: number,
  bx: number,
  by: number,
  r: number
): [number, number] {
  const e = 0.5;
  const dx =
    sdRoundBox(px + e, py, bx, by, r) - sdRoundBox(px - e, py, bx, by, r);
  const dy =
    sdRoundBox(px, py + e, bx, by, r) - sdRoundBox(px, py - e, bx, by, r);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function erfcApprox(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const poly =
    1.00002368 +
    t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))));
  const ans = t * Math.exp(-z * z - 1.26551223 + t * poly);
  return x >= 0 ? ans : 2 - ans;
}

export function getShadowMetrics(w: number, h: number, theme: GlassTheme) {
  const m = Math.min(w, h);
  const sigma = Math.max(2.2, Math.min(5.8, m * 0.065));
  const offsetY = Math.max(1.2, Math.min(4.0, m * 0.042));
  const pad = Math.ceil(offsetY + sigma * 3.0);
  if (theme === "white") {
    return { pad, offsetY, sigma, alpha: 0.125, r: 15, g: 23, b: 42 };
  }
  if (theme === "grey1200") {
    return { pad, offsetY, sigma, alpha: 0.34, r: 0, g: 0, b: 0 };
  }
  return { pad, offsetY, sigma, alpha: 0.175, r: 10, g: 14, b: 24 };
}

function evaluateGlassSurface(
  w: number,
  h: number,
  uNorm: number,
  vNorm: number,
  inwardDist: number,
  nx: number,
  ny: number,
  theme: GlassTheme,
  frostOpacity: number
): [number, number, number, number] {
  const maxOp = theme === "white" ? 1.35 : 1.0;
  const s = Math.max(0, Math.min(maxOp, frostOpacity));
  const minDim = Math.min(w, h);

  const rimW = Math.max(1.25, Math.min(1.85, minDim * 0.022));
  const bevelW =
    theme === "white"
      ? Math.min(7.5, minDim * 0.14)
      : Math.min(11.5, minDim * 0.19);
  const contourW = Math.max(6.0, Math.min(24.0, minDim * 0.26));

  const catchTL = Math.max(0, nx * -0.68 + ny * -0.73);
  const catchBR = Math.max(0, nx * 0.55 + ny * 0.83);
  const dirRim =
    0.42 + 0.62 * Math.pow(catchTL, 1.3) + 0.38 * Math.pow(catchBR, 1.6);

  const sheen = 1.0 - 0.16 * vNorm + 0.08 * (1 - uNorm);
  const innerContour =
    smoothstep(rimW * 0.7, rimW * 2.2, inwardDist) *
    Math.exp(-Math.pow(Math.max(0, inwardDist - rimW * 1.6) / contourW, 1.35));

  let fR = 250, fG = 252, fB = 255, fA = 0;
  if (theme === "white") {
    const baseA = Math.min(0.86, 0.08 + s * 0.52);
    const cw = 0.35 + 0.65 * innerContour;
    fR = Math.round(247 - 24 * cw + 7 * (1 - vNorm));
    fG = Math.round(250 - 20 * cw + 5 * (1 - vNorm));
    fB = Math.round(254 - 12 * cw + 1 * (1 - vNorm));
    fA = Math.min(0.88, baseA * (0.94 + 0.1 * sheen) + innerContour * 0.085);
  } else if (theme === "grey1200") {
    fR = 220; fG = 226; fB = 238;
    fA = Math.min(0.62, (0.045 + s * 0.22) * sheen + innerContour * 0.03);
  } else {
    fR = Math.round(252 - 10 * innerContour);
    fG = Math.round(253 - 7 * innerContour);
    fB = 255;
    fA = Math.min(0.68, (0.06 + s * 0.34) * sheen + innerContour * 0.055);
  }

  const meniscus = Math.exp(
    -Math.pow(inwardDist / Math.max(2.0, bevelW * 0.48), 1.7)
  );
  let bR = 255, bG = 255, bB = 255, bA = 0;

  if (theme === "white") {
    const outerKey = 1 - smoothstep(rimW * 0.55, rimW * 1.18, inwardDist);
    const innerSpec =
      smoothstep(rimW * 0.5, rimW * 1.25, inwardDist) *
      (1 - smoothstep(rimW * 1.35, rimW * 3.4, inwardDist));
    const keyA = outerKey * (0.34 + 0.1 * catchBR);
    const specA = innerSpec * (0.48 + 0.38 * dirRim) + meniscus * 0.09;
    const tot = Math.min(0.92, keyA + specA);
    if (tot > 0.001) {
      const kw = keyA / tot;
      bR = Math.round((142 + 24 * catchTL) * kw + 255 * (1 - kw));
      bG = Math.round((152 + 24 * catchTL) * kw + 255 * (1 - kw));
      bB = Math.round((170 + 22 * catchTL) * kw + 255 * (1 - kw));
      bA = tot;
    }
  } else if (theme === "grey1200") {
    const edge = 1 - smoothstep(rimW * 0.62, rimW * 1.32, inwardDist);
    bR = Math.min(255, Math.round(218 + 37 * catchTL));
    bG = Math.min(255, Math.round(225 + 30 * catchTL));
    bB = Math.min(255, Math.round(238 + 17 * catchTL));
    bA = Math.min(0.86, edge * (0.38 + 0.36 * dirRim) + meniscus * 0.09 * dirRim);
  } else {
    const hair = 1 - smoothstep(0.25, 0.95, inwardDist);
    const edge = 1 - smoothstep(rimW * 0.65, rimW * 1.35, inwardDist);
    const wA = edge * (0.46 + 0.44 * dirRim) + meniscus * 0.13 * dirRim;
    const cA = hair * 0.1;
    const tot = Math.min(0.94, wA + cA);
    if (tot > 0.001) {
      const cw = cA / tot;
      bR = Math.round(165 * cw + 255 * (1 - cw));
      bG = Math.round(175 * cw + 255 * (1 - cw));
      bB = Math.round(192 * cw + 255 * (1 - cw));
      bA = tot;
    }
  }

  const outA = bA + fA * (1 - bA);
  if (outA <= 0.0001) return [255, 255, 255, 0];
  return [
    (bR * bA + fR * fA * (1 - bA)) / outA,
    (bG * bA + fG * fA * (1 - bA)) / outA,
    (bB * bA + fB * fA * (1 - bA)) / outA,
    outA,
  ];
}

export function renderStandaloneGlassPanel({
  width,
  height,
  shape,
  theme,
  frostOpacity,
  customRadius,
  cornerRadius,
  includeShadow = true,
}: StandaloneGlassParams): HTMLCanvasElement {
  const w = Math.max(16, Math.round(width));
  const h = Math.max(16, Math.round(height));
  const r = getCornerRadius(w, h, shape, customRadius ?? cornerRadius ?? 20);
  const sh = getShadowMetrics(w, h, theme);
  const pad = includeShadow ? sh.pad : 0;
  const cw = w + pad * 2;
  const ch = h + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  canvas.dataset.pad = String(pad);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.createImageData(cw, ch);
  const data = img.data;

  const cx = pad + w / 2, cy = pad + h / 2;
  const bx = w / 2, by = h / 2;
  const invSig = 1 / (sh.sigma * Math.SQRT2);

  for (let y = 0; y < ch; y++) {
    const py = y + 0.5 - cy;
    const vNorm = Math.max(0, Math.min(1, (y - pad) / Math.max(1, h - 1)));
    for (let x = 0; x < cw; x++) {
      const px = x + 0.5 - cx;
      const d = sdRoundBox(px, py, bx, by, r);
      const mA = 1 - smoothstep(-0.65, 0.65, d);

      let shA = 0;
      if (includeShadow && mA < 0.999) {
        const dSh = sdRoundBox(px, py - sh.offsetY, bx, by, r);
        shA = sh.alpha * 0.5 * erfcApprox(dSh * invSig) * (1 - mA);
      }
      if (mA <= 0.001) {
        if (shA <= 0.001) continue;
        const i = (y * cw + x) * 4;
        data[i] = sh.r; data[i + 1] = sh.g; data[i + 2] = sh.b;
        data[i + 3] = Math.round(shA * 255);
        continue;
      }
      const uNorm = Math.max(0, Math.min(1, (x - pad) / Math.max(1, w - 1)));
      const [nx, ny] = sdRoundBoxNormal(px, py, bx, by, r);
      const [sR, sG, sB, sA] = evaluateGlassSurface(
        w, h, uNorm, vNorm, Math.max(0, -d), nx, ny, theme, frostOpacity
      );
      const gA = sA * mA;
      const totA = gA + shA;
      if (totA <= 0.001) continue;
      const i = (y * cw + x) * 4;
      data[i] = Math.round((sR * gA + sh.r * shA) / totA);
      data[i + 1] = Math.round((sG * gA + sh.g * shA) / totA);
      data[i + 2] = Math.round((sB * gA + sh.b * shA) / totA);
      data[i + 3] = Math.round(totA * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function generateStandaloneGlassSvg({
  width,
  height,
  shape,
  theme,
  frostOpacity,
}: StandaloneGlassParams): string {
  const w = Math.max(16, Math.round(width));
  const h = Math.max(16, Math.round(height));
  const r = getCornerRadius(w, h, shape, 20);
  const s = Math.max(0, Math.min(theme === "white" ? 1.35 : 1.0, frostOpacity));
  const sh = getShadowMetrics(w, h, theme);
  const p = sh.pad;
  const tw = w + p * 2, th = h + p * 2;

  const baseA =
    theme === "grey1200" ? 0.045 + s * 0.22
    : theme === "white" ? Math.min(0.86, 0.08 + s * 0.52)
    : 0.06 + s * 0.34;
  const fCol = theme === "white" ? "#EEF2F8" : theme === "grey1200" ? "#DCE2EE" : "#FAFBFD";
  const op1 = Math.min(0.88, baseA * 1.04).toFixed(3);
  const op2 = Math.min(0.88, baseA * 0.92).toFixed(3);
  const inR = Math.max(0, r - 0.75);
  const bevR = Math.max(0, r - 2.2);
  const cs = Math.max(6, Math.min(18, Math.min(w, h) * 0.18));

  const rimSection =
    theme === "white"
      ? `<rect x="${(cs * 0.4).toFixed(1)}" y="${(cs * 0.4).toFixed(1)}"
        width="${(w - cs * 0.8).toFixed(1)}" height="${(h - cs * 0.8).toFixed(1)}"
        rx="${Math.max(0, r - cs * 0.4).toFixed(1)}" fill="none"
        stroke="#CFD8E6" stroke-opacity="0.34" stroke-width="${cs.toFixed(1)}"
        filter="url(#meniscus-blur)" />
      <rect x="1.7" y="1.7" width="${w - 3.4}" height="${h - 3.4}"
        rx="${Math.max(0, r - 1.7)}" fill="none"
        stroke="#FFFFFF" stroke-opacity="0.82" stroke-width="1.5" />
      <rect x="0.7" y="0.7" width="${w - 1.4}" height="${h - 1.4}"
        rx="${Math.max(0, r - 0.7)}" fill="none"
        stroke="#8E98AA" stroke-opacity="0.40" stroke-width="1.4" />`
      : `<rect x="2.2" y="2.2" width="${w - 4.4}" height="${h - 4.4}"
        rx="${bevR}" fill="none" stroke="#FFFFFF" stroke-opacity="0.36"
        stroke-width="6" filter="url(#meniscus-blur)" />
      <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}"
        rx="${inR}" fill="none" stroke="#FFFFFF"
        stroke-opacity="${theme === "grey1200" ? "0.72" : "0.84"}"
        stroke-width="1.5" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}"
  viewBox="${-p} ${-p} ${tw} ${th}" fill="none">
  <defs>
    <clipPath id="panel-clip">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" />
    </clipPath>
    <mask id="sh-mask" maskUnits="userSpaceOnUse"
      x="${-p}" y="${-p}" width="${tw}" height="${th}">
      <rect x="${-p}" y="${-p}" width="${tw}" height="${th}" fill="#FFF" />
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="#000" />
    </mask>
    <filter id="sh-blur" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="${sh.sigma.toFixed(2)}" />
    </filter>
    <filter id="meniscus-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.0" />
    </filter>
    <linearGradient id="frost-fill" x1="0%" y1="0%" x2="35%" y2="100%">
      <stop offset="0%" stop-color="${fCol}" stop-opacity="${op1}" />
      <stop offset="100%" stop-color="${fCol}" stop-opacity="${op2}" />
    </linearGradient>
  </defs>
  <g mask="url(#sh-mask)">
    <rect x="0" y="${sh.offsetY.toFixed(2)}" width="${w}" height="${h}"
      rx="${r}" fill="rgb(${sh.r},${sh.g},${sh.b})"
      fill-opacity="${sh.alpha.toFixed(3)}" filter="url(#sh-blur)" />
  </g>
  <g clip-path="url(#panel-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}"
      fill="url(#frost-fill)" />
    ${rimSection}
  </g>
</svg>`;
}

export function generateCompositedGlassSvg(
  bgSource: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: StandaloneGlassParams
): string {
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = stageWidth;
  bgCanvas.height = stageHeight;
  bgCanvas.getContext("2d")!.drawImage(bgSource, 0, 0, stageWidth, stageHeight);
  const bgUrl = bgCanvas.toDataURL("image/png");

  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, 20);
  const px = Math.round(panelX), py = Math.round(panelY);
  const blurPx = (7.5 + config.frostOpacity * 10.0).toFixed(1);

  const inner = generateStandaloneGlassSvg(config)
    .replace(/<\?xml.*?\?>\s*/g, "")
    .replace(/<svg[^>]*>/, `<g transform="translate(${px}, ${py})">`)
    .replace(/<\/svg>\s*$/, "</g>");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${stageWidth}"
  height="${stageHeight}" viewBox="0 0 ${stageWidth} ${stageHeight}">
  <defs>
    <clipPath id="stage-clip">
      <rect x="${px}" y="${py}" width="${w}" height="${h}" rx="${r}" />
    </clipPath>
    <filter id="stage-blur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${blurPx}" />
    </filter>
  </defs>
  <image href="${bgUrl}" x="0" y="0"
    width="${stageWidth}" height="${stageHeight}" />
  <g clip-path="url(#stage-clip)">
    <image href="${bgUrl}" x="0" y="0" width="${stageWidth}"
      height="${stageHeight}" filter="url(#stage-blur)" />
  </g>
  ${inner}
</svg>`;
}

export function renderRefractedGlassPatch(
  bgSource: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: StandaloneGlassParams
): HTMLCanvasElement {
  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape);
  const sh = getShadowMetrics(w, h, config.theme);
  const outPad = sh.pad;
  const cw = w + outPad * 2, ch = h + outPad * 2;

  const pad = 36;
  const sx = Math.floor(panelX - pad), sy = Math.floor(panelY - pad);
  const sw = w + pad * 2, shH = h + pad * 2;

  const sharp = document.createElement("canvas");
  sharp.width = sw; sharp.height = shH;
  const sCtx = sharp.getContext("2d", { willReadFrequently: true })!;
  sCtx.fillStyle = config.theme === "grey1200" ? "#121317" : "#FFFFFF";
  sCtx.fillRect(0, 0, sw, shH);
  sCtx.drawImage(bgSource, -sx, -sy, stageWidth, stageHeight);

  const blur = document.createElement("canvas");
  blur.width = sw; blur.height = shH;
  const bCtx = blur.getContext("2d", { willReadFrequently: true })!;
  const blurPx = 7.5 + config.frostOpacity * 10.0;
  bCtx.filter = `blur(${blurPx.toFixed(1)}px) saturate(110%)`;
  bCtx.drawImage(sharp, 0, 0);
  bCtx.filter = "none";

  const bPx = bCtx.getImageData(0, 0, sw, shH).data;
  const sPx = sCtx.getImageData(0, 0, sw, shH).data;

  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.dataset.pad = String(outPad);
  const oCtx = out.getContext("2d")!;
  const oImg = oCtx.createImageData(cw, ch);
  const oData = oImg.data;

  const cx = outPad + w / 2, cy = outPad + h / 2;
  const bx = w / 2, by = h / 2;
  const invSig = 1 / (sh.sigma * Math.SQRT2);
  const mZone =
    config.theme === "white"
      ? Math.min(9, Math.min(w, h) * 0.16)
      : Math.min(15, Math.min(w, h) * 0.24);
  const maxDisp = config.theme === "white" ? 4.5 : 10.0;

  const sample = (buf: Uint8ClampedArray, fx: number, fy: number) => {
    const cx0 = Math.max(0, Math.min(sw - 1, fx));
    const cy0 = Math.max(0, Math.min(shH - 1, fy));
    const x0 = Math.floor(cx0), y0 = Math.floor(cy0);
    const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(shH - 1, y0 + 1);
    const tx = cx0 - x0, ty = cy0 - y0;
    const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
    const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
    return [
      (buf[i00] * (1 - tx) + buf[i10] * tx) * (1 - ty) +
        (buf[i01] * (1 - tx) + buf[i11] * tx) * ty,
      (buf[i00 + 1] * (1 - tx) + buf[i10 + 1] * tx) * (1 - ty) +
        (buf[i01 + 1] * (1 - tx) + buf[i11 + 1] * tx) * ty,
      (buf[i00 + 2] * (1 - tx) + buf[i10 + 2] * tx) * (1 - ty) +
        (buf[i01 + 2] * (1 - tx) + buf[i11 + 2] * tx) * ty,
    ];
  };

  for (let y = 0; y < ch; y++) {
    const py = y + 0.5 - cy;
    const vNorm = Math.max(0, Math.min(1, (y - outPad) / Math.max(1, h - 1)));
    for (let x = 0; x < cw; x++) {
      const px = x + 0.5 - cx;
      const d = sdRoundBox(px, py, bx, by, r);
      const mA = 1 - smoothstep(-0.65, 0.65, d);

      let shA = 0;
      if (mA < 0.999) {
        const dSh = sdRoundBox(px, py - sh.offsetY, bx, by, r);
        shA = sh.alpha * 0.5 * erfcApprox(dSh * invSig) * (1 - mA);
      }
      if (mA <= 0.001) {
        if (shA <= 0.001) continue;
        const i = (y * cw + x) * 4;
        oData[i] = sh.r; oData[i + 1] = sh.g; oData[i + 2] = sh.b;
        oData[i + 3] = Math.round(shA * 255);
        continue;
      }

      const lx = x - outPad, ly = y - outPad;
      const uNorm = Math.max(0, Math.min(1, lx / Math.max(1, w - 1)));
      const inDist = Math.max(0, -d);
      const [nx, ny] = sdRoundBoxNormal(px, py, bx, by, r);
      const lens = Math.pow(Math.max(0, 1 - inDist / mZone), 2.2);
      const bxS = lx + pad - nx * lens * maxDisp;
      const byS = ly + pad - ny * lens * maxDisp;
      const sp = config.theme === "white" ? 0.45 : 1.0;
      const ec = config.theme === "white" ? lens * 0.2 : lens * 0.38;

      const [brR] = sample(bPx, bxS - nx * lens * sp, byS - ny * lens * sp);
      const [, brG] = sample(bPx, bxS, byS);
      const [, , brB] = sample(bPx, bxS + nx * lens * sp, byS + ny * lens * sp);
      const [sR0, sG0, sB0] = sample(sPx, bxS, byS);

      const rR = brR * (1 - ec) + sR0 * ec;
      const rG = brG * (1 - ec) + sG0 * ec;
      const rB = brB * (1 - ec) + sB0 * ec;

      const [sfR, sfG, sfB, sfA] = evaluateGlassSurface(
        w, h, uNorm, vNorm, inDist, nx, ny, config.theme, config.frostOpacity
      );
      const gR = sfR * sfA + rR * (1 - sfA);
      const gG = sfG * sfA + rG * (1 - sfA);
      const gB = sfB * sfA + rB * (1 - sfA);

      const outA = mA + shA;
      const i = (y * cw + x) * 4;
      oData[i] = Math.round((gR * mA + sh.r * shA) / outA);
      oData[i + 1] = Math.round((gG * mA + sh.g * shA) / outA);
      oData[i + 2] = Math.round((gB * mA + sh.b * shA) / outA);
      oData[i + 3] = Math.round(Math.min(1, outA) * 255);
    }
  }
  oCtx.putImageData(oImg, 0, 0);
  return out;
}
