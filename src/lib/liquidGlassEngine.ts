export type PanelShape = "text-panel" | "circle" | "cta-pill";
export type GlassShape = PanelShape;
export type GlassTheme = "imagery" | "grey1200" | "white";

export const LOCKED_THEME_OPACITY: Record<GlassTheme, number> = {
  imagery: 35,
  grey1200: 40,
  white: 80,
};

export interface StandaloneGlassParams {
  width: number;
  height: number;
  shape: PanelShape;
  theme: GlassTheme;
  frostOpacity: number;
  customRadius?: number;
  includeShadow?: boolean;
}

export interface ShadowMetrics {
  pad: number;
  offsetY: number;
  sigma: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
}

export function getCornerRadius(
  width: number,
  height: number,
  shape: PanelShape,
  customRadius = 20
): number {
  const maxR = Math.min(width, height) / 2;
  if (shape === "circle" || shape === "cta-pill") {
    return maxR;
  }
  return Math.min(customRadius, maxR);
}

function sdRoundBox(px: number, py: number, bx: number, by: number, r: number): number {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inDist = Math.min(Math.max(qx, qy), 0);
  return outDist + inDist - r;
}

function sdRoundBoxNormal(
  px: number,
  py: number,
  bx: number,
  by: number,
  r: number
): [number, number] {
  const eps = 0.5;
  const dx = sdRoundBox(px + eps, py, bx, by, r) - sdRoundBox(px - eps, py, bx, by, r);
  const dy = sdRoundBox(px, py + eps, bx, by, r) - sdRoundBox(px, py - eps, bx, by, r);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function erfcApprox(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2 - ans;
}

export function getShadowMetrics(width: number, height: number, theme: GlassTheme): ShadowMetrics {
  const minDim = Math.min(width, height);
  const sigma = Math.max(2.2, Math.min(5.8, minDim * 0.065));
  const offsetY = Math.max(1.2, Math.min(4.0, minDim * 0.042));
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
  const maxOpacity = theme === "white" ? 1.35 : 1.0;
  const s = Math.max(0, Math.min(maxOpacity, frostOpacity));
  const minDim = Math.min(w, h);

  const rimWidth = Math.max(1.25, Math.min(1.85, minDim * 0.022));
  const bevelWidth =
    theme === "white" ? Math.min(7.5, minDim * 0.14) : Math.min(11.5, minDim * 0.19);
  const innerContourWidth = Math.max(6.0, Math.min(24.0, minDim * 0.26));

  const light1X = -0.68,
    light1Y = -0.73;
  const light2X = 0.55;

  const catchTopLeft = Math.max(0, nx * light1X + ny * light1Y);
  const catchBottomRight = Math.max(0, nx * light2X + ny * 0.83);
  const directionalRim =
    0.42 + 0.62 * Math.pow(catchTopLeft, 1.3) + 0.38 * Math.pow(catchBottomRight, 1.6);

  const sheenGrad = 1.0 - 0.16 * vNorm + 0.08 * (1 - uNorm);
  const innerContour =
    smoothstep(rimWidth * 0.7, rimWidth * 2.2, inwardDist) *
    Math.exp(-Math.pow(Math.max(0, inwardDist - rimWidth * 1.6) / innerContourWidth, 1.35));

  let frostR = 250,
    frostG = 252,
    frostB = 255;
  let frostA = 0;

  if (theme === "white") {
    const baseFrostAlpha = Math.min(0.86, 0.08 + s * 0.52);
    const contourWeight = 0.35 + 0.65 * innerContour;
    frostR = Math.round(247 - 24 * contourWeight + 7 * (1 - vNorm));
    frostG = Math.round(250 - 20 * contourWeight + 5 * (1 - vNorm));
    frostB = Math.round(254 - 12 * contourWeight + 1 * (1 - vNorm));
    frostA = Math.min(0.88, baseFrostAlpha * (0.94 + 0.1 * sheenGrad) + innerContour * 0.085);
  } else if (theme === "grey1200") {
    const baseFrostAlpha = 0.045 + s * 0.22;
    frostR = 220;
    frostG = 226;
    frostB = 238;
    frostA = Math.min(0.62, baseFrostAlpha * sheenGrad + innerContour * 0.03);
  } else {
    const baseFrostAlpha = 0.06 + s * 0.34;
    frostR = Math.round(252 - 10 * innerContour);
    frostG = Math.round(253 - 7 * innerContour);
    frostB = 255;
    frostA = Math.min(0.68, baseFrostAlpha * sheenGrad + innerContour * 0.055);
  }

  const meniscusBand = Math.exp(-Math.pow(inwardDist / Math.max(2.0, bevelWidth * 0.48), 1.7));
  let bevelR = 255,
    bevelG = 255,
    bevelB = 255,
    bevelA = 0;

  if (theme === "white") {
    const outerKeyline = 1 - smoothstep(rimWidth * 0.55, rimWidth * 1.18, inwardDist);
    const innerSpecular =
      smoothstep(rimWidth * 0.5, rimWidth * 1.25, inwardDist) *
      (1 - smoothstep(rimWidth * 1.35, rimWidth * 3.4, inwardDist));

    const keyA = outerKeyline * (0.34 + 0.1 * catchBottomRight);
    const specA = innerSpecular * (0.48 + 0.38 * directionalRim) + meniscusBand * 0.09;

    const totalRimA = Math.min(0.92, keyA + specA);
    if (totalRimA > 0.001) {
      const keyWeight = keyA / totalRimA;
      const keyR = 142 + Math.round(24 * catchTopLeft);
      const keyG = 152 + Math.round(24 * catchTopLeft);
      const keyB = 170 + Math.round(22 * catchTopLeft);
      bevelR = Math.round(keyR * keyWeight + 255 * (1 - keyWeight));
      bevelG = Math.round(keyG * keyWeight + 255 * (1 - keyWeight));
      bevelB = Math.round(keyB * keyWeight + 255 * (1 - keyWeight));
      bevelA = totalRimA;
    }
  } else if (theme === "grey1200") {
    const crispEdge = 1 - smoothstep(rimWidth * 0.62, rimWidth * 1.32, inwardDist);
    bevelR = Math.min(255, Math.round(218 + 37 * catchTopLeft));
    bevelG = Math.min(255, Math.round(225 + 30 * catchTopLeft));
    bevelB = Math.min(255, Math.round(238 + 17 * catchTopLeft));
    bevelA = Math.min(
      0.86,
      crispEdge * (0.38 + 0.36 * directionalRim) + meniscusBand * (0.09 * directionalRim)
    );
  } else {
    const outerHairline = 1 - smoothstep(0.25, 0.95, inwardDist);
    const crispEdge = 1 - smoothstep(rimWidth * 0.65, rimWidth * 1.35, inwardDist);
    const whiteRimA =
      crispEdge * (0.46 + 0.44 * directionalRim) + meniscusBand * (0.13 * directionalRim);
    const coolEdgeA = outerHairline * 0.1;
    const totalRimA = Math.min(0.94, whiteRimA + coolEdgeA);
    if (totalRimA > 0.001) {
      const coolW = coolEdgeA / totalRimA;
      bevelR = Math.round(165 * coolW + 255 * (1 - coolW));
      bevelG = Math.round(175 * coolW + 255 * (1 - coolW));
      bevelB = Math.round(192 * coolW + 255 * (1 - coolW));
      bevelA = totalRimA;
    }
  }

  const outA = bevelA + frostA * (1 - bevelA);
  let outR = 255,
    outG = 255,
    outB = 255;
  if (outA > 0.0001) {
    outR = (bevelR * bevelA + frostR * frostA * (1 - bevelA)) / outA;
    outG = (bevelG * bevelA + frostG * frostA * (1 - bevelA)) / outA;
    outB = (bevelB * bevelA + frostB * frostA * (1 - bevelA)) / outA;
  }

  return [outR, outG, outB, outA];
}

export function renderStandaloneGlassPanel({
  width,
  height,
  shape,
  theme,
  frostOpacity,
  customRadius = 20,
  includeShadow = true,
}: StandaloneGlassParams): HTMLCanvasElement {
  const w = Math.max(16, Math.round(width));
  const h = Math.max(16, Math.round(height));
  const r = getCornerRadius(w, h, shape, customRadius);

  const shadow = getShadowMetrics(w, h, theme);
  const pad = includeShadow ? shadow.pad : 0;
  const cw = w + pad * 2;
  const ch = h + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const imgData = ctx.createImageData(cw, ch);
  const data = imgData.data;

  const cx = pad + w / 2;
  const cy = pad + h / 2;
  const bx = w / 2;
  const by = h / 2;
  const invSigmaSqrt2 = 1 / (shadow.sigma * Math.SQRT2);

  for (let y = 0; y < ch; y++) {
    const py = y + 0.5 - cy;
    const vNorm = Math.max(0, Math.min(1, (y - pad) / Math.max(1, h - 1)));
    for (let x = 0; x < cw; x++) {
      const px = x + 0.5 - cx;
      const d = sdRoundBox(px, py, bx, by, r);
      const maskAlpha = 1 - smoothstep(-0.65, 0.65, d);

      let shA = 0;
      if (includeShadow && maskAlpha < 0.999) {
        const dShadow = sdRoundBox(px, py - shadow.offsetY, bx, by, r);
        const falloff = 0.5 * erfcApprox(dShadow * invSigmaSqrt2);
        shA = shadow.alpha * falloff * (1 - maskAlpha);
      }

      if (maskAlpha <= 0.001) {
        if (shA <= 0.001) continue;
        const idx = (y * cw + x) * 4;
        data[idx] = shadow.r;
        data[idx + 1] = shadow.g;
        data[idx + 2] = shadow.b;
        data[idx + 3] = Math.round(shA * 255);
        continue;
      }

      const uNorm = Math.max(0, Math.min(1, (x - pad) / Math.max(1, w - 1)));
      const inwardDist = Math.max(0, -d);
      const [nx, ny] = sdRoundBoxNormal(px, py, bx, by, r);

      const [surfR, surfG, surfB, surfAlpha] = evaluateGlassSurface(
        w,
        h,
        uNorm,
        vNorm,
        inwardDist,
        nx,
        ny,
        theme,
        frostOpacity
      );

      const gA = surfAlpha * maskAlpha;
      const totalA = gA + shA;
      if (totalA <= 0.001) continue;

      const idx = (y * cw + x) * 4;
      data[idx] = Math.round((surfR * gA + shadow.r * shA) / totalA);
      data[idx + 1] = Math.round((surfG * gA + shadow.g * shA) / totalA);
      data[idx + 2] = Math.round((surfB * gA + shadow.b * shA) / totalA);
      data[idx + 3] = Math.round(totalA * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
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
  const maxOpacity = theme === "white" ? 1.35 : 1.0;
  const s = Math.max(0, Math.min(maxOpacity, frostOpacity));
  const shadow = getShadowMetrics(w, h, theme);
  const pad = shadow.pad;

  const baseFrostAlpha =
    theme === "grey1200"
      ? 0.045 + s * 0.22
      : theme === "white"
      ? Math.min(0.86, 0.08 + s * 0.52)
      : 0.06 + s * 0.34;

  const frostColor =
    theme === "white" ? "#EEF2F8" : theme === "grey1200" ? "#DCE2EE" : "#FAFBFD";
  const topFrostOp = Math.min(0.88, baseFrostAlpha * 1.04).toFixed(4);
  const midFrostOp = Math.min(0.88, baseFrostAlpha * 0.96).toFixed(4);
  const botFrostOp = Math.min(0.88, baseFrostAlpha * 0.9).toFixed(4);

  const innerR = Math.max(0, r - 0.75);
  const bevelR = Math.max(0, r - 2.2);
  const meniscusStd = theme === "white" ? 2.2 : 3.4;
  const meniscusWidth = theme === "white" ? 4.5 : 6.5;
  const contourStroke = Math.max(6, Math.min(18, Math.min(w, h) * 0.18));

  let rimDefs = "";
  let rimLayers = "";

  if (theme === "white") {
    rimDefs = `
    <linearGradient id="rim-keyline" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#98A2B3" stop-opacity="0.42" />
      <stop offset="50%" stop-color="#8E98AA" stop-opacity="0.34" />
      <stop offset="100%" stop-color="#848FA2" stop-opacity="0.44" />
    </linearGradient>
    <linearGradient id="rim-specular" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.90" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.52" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.78" />
    </linearGradient>
    <filter id="inner-contour-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${(contourStroke * 0.45).toFixed(1)}" />
    </filter>`;
    rimLayers = `
    <rect x="${(contourStroke * 0.4).toFixed(1)}" y="${(contourStroke * 0.4).toFixed(1)}" width="${(w - contourStroke * 0.8).toFixed(1)}" height="${(h - contourStroke * 0.8).toFixed(1)}" rx="${Math.max(0, r - contourStroke * 0.4).toFixed(1)}" ry="${Math.max(0, r - contourStroke * 0.4).toFixed(1)}" fill="none" stroke="#CFD8E6" stroke-opacity="0.34" stroke-width="${contourStroke.toFixed(1)}" filter="url(#inner-contour-blur)" />
    <rect x="2.2" y="2.2" width="${w - 4.4}" height="${h - 4.4}" rx="${bevelR}" ry="${bevelR}" fill="none" stroke="url(#rim-specular)" stroke-width="${meniscusWidth}" filter="url(#meniscus-blur)" />
    <rect x="1.7" y="1.7" width="${w - 3.4}" height="${h - 3.4}" rx="${Math.max(0, r - 1.7)}" ry="${Math.max(0, r - 1.7)}" fill="none" stroke="url(#rim-specular)" stroke-width="1.5" />
    <rect x="0.7" y="0.7" width="${w - 1.4}" height="${h - 1.4}" rx="${Math.max(0, r - 0.7)}" ry="${Math.max(0, r - 0.7)}" fill="none" stroke="url(#rim-keyline)" stroke-width="1.4" />`;
  } else if (theme === "grey1200") {
    rimDefs = `
    <linearGradient id="rim-grey" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.82" />
      <stop offset="48%" stop-color="#DCE3F0" stop-opacity="0.50" />
      <stop offset="100%" stop-color="#EEF2FA" stop-opacity="0.72" />
    </linearGradient>`;
    rimLayers = `
    <rect x="2.2" y="2.2" width="${w - 4.4}" height="${h - 4.4}" rx="${bevelR}" ry="${bevelR}" fill="none" stroke="url(#rim-grey)" stroke-width="${meniscusWidth}" stroke-opacity="0.35" filter="url(#meniscus-blur)" />
    <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${innerR}" ry="${innerR}" fill="none" stroke="url(#rim-grey)" stroke-width="1.5" />`;
  } else {
    rimDefs = `
    <linearGradient id="rim-imagery" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.94" />
      <stop offset="48%" stop-color="#FFFFFF" stop-opacity="0.58" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.82" />
    </linearGradient>`;
    rimLayers = `
    <rect x="2.2" y="2.2" width="${w - 4.4}" height="${h - 4.4}" rx="${bevelR}" ry="${bevelR}" fill="none" stroke="url(#rim-imagery)" stroke-width="${meniscusWidth}" stroke-opacity="0.40" filter="url(#meniscus-blur)" />
    <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${innerR}" ry="${innerR}" fill="none" stroke="url(#rim-imagery)" stroke-width="1.55" />`;
  }

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
    <linearGradient id="frost-fill" x1="0%" y1="0%" x2="35%" y2="100%">
      <stop offset="0%" stop-color="${frostColor}" stop-opacity="${topFrostOp}" />
      <stop offset="55%" stop-color="${frostColor}" stop-opacity="${midFrostOp}" />
      <stop offset="100%" stop-color="${frostColor}" stop-opacity="${botFrostOp}" />
    </linearGradient>
    <filter id="meniscus-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${meniscusStd}" />
    </filter>${rimDefs}
  </defs>
  <g id="liquid-glass-shadow" mask="url(#outer-shadow-mask)">
    <rect x="0" y="${shadow.offsetY.toFixed(2)}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="rgb(${shadow.r},${shadow.g},${shadow.b})" fill-opacity="${shadow.alpha.toFixed(3)}" filter="url(#drop-shadow-blur)" />
  </g>
  <g id="liquid-glass-panel" clip-path="url(#panel-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="url(#frost-fill)" />${rimLayers}
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
  const bCtx = bgCanvas.getContext("2d")!;
  bCtx.drawImage(bgSource, 0, 0, stageWidth, stageHeight);
  const bgDataUrl = bgCanvas.toDataURL("image/png");

  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, 20);
  const px = Math.round(panelX);
  const py = Math.round(panelY);
  const blurPx =
    config.theme === "white"
      ? (8.0 + config.frostOpacity * 10.0).toFixed(1)
      : config.theme === "grey1200"
      ? (7.0 + config.frostOpacity * 9.0).toFixed(1)
      : (7.5 + config.frostOpacity * 10.0).toFixed(1);

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
    <filter id="stage-backdrop-blur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${blurPx}" />
    </filter>
  </defs>
  <image id="uploaded-background" href="${bgDataUrl}" x="0" y="0" width="${stageWidth}" height="${stageHeight}" />
  <g id="frosted-backdrop" clip-path="url(#stage-backdrop-clip)">
    <image href="${bgDataUrl}" x="0" y="0" width="${stageWidth}" height="${stageHeight}" filter="url(#stage-backdrop-blur)" />
  </g>
  ${innerPanelSvg}
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
  const shadow = getShadowMetrics(w, h, config.theme);
  const outPad = shadow.pad;

  const cw = w + outPad * 2;
  const ch = h + outPad * 2;

  const pad = 36;
  const sx = Math.floor(panelX - pad);
  const sy = Math.floor(panelY - pad);
  const sw = w + pad * 2;
  const sh = h + pad * 2;

  const sharpBuf = document.createElement("canvas");
  sharpBuf.width = sw;
  sharpBuf.height = sh;
  const sCtx = sharpBuf.getContext("2d", { willReadFrequently: true })!;
  sCtx.fillStyle = config.theme === "grey1200" ? "#121317" : "#FFFFFF";
  sCtx.fillRect(0, 0, sw, sh);
  sCtx.drawImage(bgSource, -sx, -sy, stageWidth, stageHeight);

  const blurBuf = document.createElement("canvas");
  blurBuf.width = sw;
  blurBuf.height = sh;
  const bCtx = blurBuf.getContext("2d", { willReadFrequently: true })!;
  const blurPx =
    config.theme === "white"
      ? 8.0 + config.frostOpacity * 10.0
      : config.theme === "grey1200"
      ? 7.0 + config.frostOpacity * 9.0
      : 7.5 + config.frostOpacity * 10.0;
  bCtx.filter = `blur(${blurPx.toFixed(1)}px) saturate(110%)`;
  bCtx.drawImage(sharpBuf, 0, 0);
  bCtx.filter = "none";

  const blurPixels = bCtx.getImageData(0, 0, sw, sh).data;
  const sharpPixels = sCtx.getImageData(0, 0, sw, sh).data;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cw;
  outCanvas.height = ch;
  const outCtx = outCanvas.getContext("2d")!;
  const outImg = outCtx.createImageData(cw, ch);
  const outData = outImg.data;

  const cx = outPad + w / 2;
  const cy = outPad + h / 2;
  const bx = w / 2;
  const by = h / 2;
  const invSigmaSqrt2 = 1 / (shadow.sigma * Math.SQRT2);

  const meniscusZone =
    config.theme === "white"
      ? Math.min(9, Math.min(w, h) * 0.16)
      : Math.min(15, Math.min(w, h) * 0.24);
  const maxDisplace = config.theme === "white" ? 4.5 : 10.0;

  const sampleBilinear = (
    buf: Uint8ClampedArray,
    fx: number,
    fy: number
  ): [number, number, number] => {
    const cx0 = Math.max(0, Math.min(sw - 1, fx));
    const cy0 = Math.max(0, Math.min(sh - 1, fy));
    const x0 = Math.floor(cx0);
    const y0 = Math.floor(cy0);
    const x1 = Math.min(sw - 1, x0 + 1);
    const y1 = Math.min(sh - 1, y0 + 1);
    const tx = cx0 - x0;
    const ty = cy0 - y0;

    const i00 = (y0 * sw + x0) * 4;
    const i10 = (y0 * sw + x1) * 4;
    const i01 = (y1 * sw + x0) * 4;
    const i11 = (y1 * sw + x1) * 4;

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
      const maskAlpha = 1 - smoothstep(-0.65, 0.65, d);

      let shA = 0;
      if (maskAlpha < 0.999) {
        const dShadow = sdRoundBox(px, py - shadow.offsetY, bx, by, r);
        const falloff = 0.5 * erfcApprox(dShadow * invSigmaSqrt2);
        shA = shadow.alpha * falloff * (1 - maskAlpha);
      }

      if (maskAlpha <= 0.001) {
        if (shA <= 0.001) continue;
        const idx = (y * cw + x) * 4;
        outData[idx] = shadow.r;
        outData[idx + 1] = shadow.g;
        outData[idx + 2] = shadow.b;
        outData[idx + 3] = Math.round(shA * 255);
        continue;
      }

      const localX = x - outPad;
      const localY = y - outPad;
      const uNorm = Math.max(0, Math.min(1, localX / Math.max(1, w - 1)));
      const inwardDist = Math.max(0, -d);
      const [nx, ny] = sdRoundBoxNormal(px, py, bx, by, r);

      const lensFactor = Math.pow(Math.max(0, 1 - inwardDist / meniscusZone), 2.2);
      const displaceMag = lensFactor * maxDisplace;

      const baseSampleX = localX + pad - nx * displaceMag;
      const baseSampleY = localY + pad - ny * displaceMag;

      const dispSpread = config.theme === "white" ? 0.45 : 1.0;
      const edgeClarity = config.theme === "white" ? lensFactor * 0.2 : lensFactor * 0.38;

      const [brR] = sampleBilinear(
        blurPixels,
        baseSampleX - nx * lensFactor * dispSpread,
        baseSampleY - ny * lensFactor * dispSpread
      );
      const [, brG] = sampleBilinear(blurPixels, baseSampleX, baseSampleY);
      const [, , brB] = sampleBilinear(
        blurPixels,
        baseSampleX + nx * lensFactor * dispSpread,
        baseSampleY + ny * lensFactor * dispSpread
      );
      const [shR, shG, shB] = sampleBilinear(sharpPixels, baseSampleX, baseSampleY);

      const refrR = brR * (1 - edgeClarity) + shR * edgeClarity;
      const refrG = brG * (1 - edgeClarity) + shG * edgeClarity;
      const refrB = brB * (1 - edgeClarity) + shB * edgeClarity;

      const [surfR, surfG, surfB, surfA] = evaluateGlassSurface(
        w,
        h,
        uNorm,
        vNorm,
        inwardDist,
        nx,
        ny,
        config.theme,
        config.frostOpacity
      );

      const glassR = surfR * surfA + refrR * (1 - surfA);
      const glassG = surfG * surfA + refrG * (1 - surfA);
      const glassB = surfB * surfA + refrB * (1 - surfA);

      const outA = maskAlpha + shA;
      const idx = (y * cw + x) * 4;
      outData[idx] = Math.round((glassR * maskAlpha + shadow.r * shA) / outA);
      outData[idx + 1] = Math.round((glassG * maskAlpha + shadow.g * shA) / outA);
      outData[idx + 2] = Math.round((glassB * maskAlpha + shadow.b * shA) / outA);
      outData[idx + 3] = Math.round(Math.min(1, outA) * 255);
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}
