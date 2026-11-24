export type BackgroundTheme = "imagery" | "grey1200" | "white";
export type PanelShape = "text-panel" | "circle" | "cta-pill";
export type FormatRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface GlassRenderConfig {
  width: number;
  height: number;
  shape: PanelShape;
  theme: BackgroundTheme;
  frostOpacity: number;
  customRadius?: number;
}

export const FORMAT_DIMENSIONS: Record<FormatRatio, { width: number; height: number; folder: string }> = {
  "1:1": { width: 1080, height: 1080, folder: "1-1" },
  "4:5": { width: 1080, height: 1350, folder: "4-5" },
  "9:16": { width: 1080, height: 1920, folder: "9-16" },
  "16:9": { width: 1920, height: 1080, folder: "16-9" },
};

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

function sdRoundBoxNormal(px: number, py: number, bx: number, by: number, r: number): [number, number] {
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

export function renderStandaloneGlassPanel(config: GlassRenderConfig): HTMLCanvasElement {
  const w = Math.max(16, Math.round(config.width));
  const h = Math.max(16, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, config.customRadius ?? 20);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const cx = w / 2;
  const cy = h / 2;
  const bx = w / 2;
  const by = h / 2;

  const frostSlider = Math.max(0, Math.min(1, config.frostOpacity));
  const baseFrostAlpha =
    config.theme === "grey1200"
      ? 0.03 + frostSlider * 0.128
      : config.theme === "white"
      ? 0.03 + frostSlider * 0.214
      : 0.04 + frostSlider * 0.18;

  const bevelWidth =
    config.theme === "white"
      ? Math.min(6, Math.min(w, h) * 0.12)
      : Math.min(11, Math.min(w, h) * 0.18);

  const light1X = -0.68, light1Y = -0.73;
  const light2X = 0.55, light2Y = 0.83;

  for (let y = 0; y < h; y++) {
    const py = y + 0.5 - cy;
    const vNorm = y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx;
      const uNorm = x / Math.max(1, w - 1);
      const d = sdRoundBox(px, py, bx, by, r);

      const maskAlpha = 1 - smoothstep(-0.65, 0.55, d);
      if (maskAlpha <= 0.001) continue;

      const inwardDist = Math.max(0, -d);
      const [nx, ny] = sdRoundBoxNormal(px, py, bx, by, r);

      const catchTopLeft = Math.max(0, nx * light1X + ny * light1Y);
      const catchBottomRight = Math.max(0, nx * light2X + ny * light2Y);
      const directionalRim =
        0.35 + 0.65 * Math.pow(catchTopLeft, 1.35) + 0.38 * Math.pow(catchBottomRight, 1.65);

      const sheenGrad = 1.0 - 0.22 * vNorm + 0.08 * (1 - uNorm);
      let frostR = 252, frostG = 253, frostB = 255;
      if (config.theme === "white") {
        frostR = 242;
        frostG = 245;
        frostB = 250;
      } else if (config.theme === "grey1200") {
        frostR = 210;
        frostG = 215;
        frostB = 224;
      }
      const frostA = Math.min(0.65, baseFrostAlpha * sheenGrad);

      const meniscusBand = Math.exp(-Math.pow(inwardDist / Math.max(1.8, bevelWidth * 0.45), 1.75));
      let bevelR = 255, bevelG = 255, bevelB = 255, bevelA = 0;

      if (config.theme === "white") {
        const outerKeyline = 1 - smoothstep(0.35, 1.45, inwardDist);
        const innerSpecular =
          smoothstep(0.6, 1.6, inwardDist) * (1 - smoothstep(1.6, bevelWidth, inwardDist));

        const keyA = outerKeyline * (0.16 + 0.08 * catchBottomRight);
        const specA = innerSpecular * (0.20 * directionalRim) + meniscusBand * 0.025;

        const totalRimA = Math.min(0.65, keyA + specA);
        if (totalRimA > 0.001) {
          const keyWeight = keyA / totalRimA;
          bevelR = Math.round(154 * keyWeight + 255 * (1 - keyWeight));
          bevelG = Math.round(162 * keyWeight + 255 * (1 - keyWeight));
          bevelB = Math.round(176 * keyWeight + 255 * (1 - keyWeight));
          bevelA = totalRimA;
        }
      } else if (config.theme === "grey1200") {
        const crispEdge = 1 - smoothstep(0.45, 1.75, inwardDist);
        const sheenLift = Math.round(28 * catchTopLeft);
        bevelR = 132 + sheenLift;
        bevelG = 138 + sheenLift;
        bevelB = 149 + sheenLift;
        bevelA = Math.min(
          0.52,
          crispEdge * (0.24 + 0.24 * directionalRim) + meniscusBand * (0.055 * directionalRim)
        );
      } else {
        const crispEdge = 1 - smoothstep(0.5, 1.85, inwardDist);
        bevelA = Math.min(
          0.90,
          crispEdge * (0.34 + 0.46 * directionalRim) + meniscusBand * (0.10 * directionalRim)
        );
      }

      const outA = bevelA + frostA * (1 - bevelA);
      let outR = 255, outG = 255, outB = 255;
      if (outA > 0.0001) {
        outR = (bevelR * bevelA + frostR * frostA * (1 - bevelA)) / outA;
        outG = (bevelG * bevelA + frostG * frostA * (1 - bevelA)) / outA;
        outB = (bevelB * bevelA + frostB * frostA * (1 - bevelA)) / outA;
      }

      const idx = (y * w + x) * 4;
      data[idx] = Math.round(outR);
      data[idx + 1] = Math.round(outG);
      data[idx + 2] = Math.round(outB);
      data[idx + 3] = Math.round(outA * maskAlpha * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function generateStandaloneGlassSvg(config: GlassRenderConfig): string {
  const w = Math.max(16, Math.round(config.width));
  const h = Math.max(16, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, 20);
  const s = Math.max(0, Math.min(1, config.frostOpacity));

  const baseFrostAlpha =
    config.theme === "grey1200"
      ? 0.03 + s * 0.128
      : config.theme === "white"
      ? 0.03 + s * 0.214
      : 0.04 + s * 0.18;

  const frostColor =
    config.theme === "white" ? "#F2F5FA" : config.theme === "grey1200" ? "#D2D7E0" : "#FCFDFE";
  const topFrostOp = Math.min(0.65, baseFrostAlpha * 1.08).toFixed(4);
  const midFrostOp = Math.min(0.65, baseFrostAlpha * 0.94).toFixed(4);
  const botFrostOp = Math.min(0.65, baseFrostAlpha * 0.82).toFixed(4);

  const innerR = Math.max(0, r - 0.75);
  const bevelR = Math.max(0, r - 2);
  const meniscusStd = config.theme === "white" ? 1.4 : 3.2;
  const meniscusWidth = config.theme === "white" ? 3 : 6;

  let rimDefs = "";
  let rimLayers = "";

  if (config.theme === "white") {
    rimDefs = `
    <linearGradient id="rim-keyline" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9AA2B0" stop-opacity="0.22" />
      <stop offset="50%" stop-color="#9AA2B0" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#8C96A6" stop-opacity="0.24" />
    </linearGradient>
    <linearGradient id="rim-specular" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.48" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.32" />
    </linearGradient>`;
    rimLayers = `
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${bevelR}" ry="${bevelR}" fill="none" stroke="url(#rim-specular)" stroke-width="${meniscusWidth}" filter="url(#meniscus-blur)" />
    <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${Math.max(0, r - 1.5)}" ry="${Math.max(0, r - 1.5)}" fill="none" stroke="url(#rim-specular)" stroke-width="1.2" />
    <rect x="0.6" y="0.6" width="${w - 1.2}" height="${h - 1.2}" rx="${Math.max(0, r - 0.6)}" ry="${Math.max(0, r - 0.6)}" fill="none" stroke="url(#rim-keyline)" stroke-width="1.2" />`;
  } else if (config.theme === "grey1200") {
    rimDefs = `
    <linearGradient id="rim-grey" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A0A6B4" stop-opacity="0.50" />
      <stop offset="50%" stop-color="#848A98" stop-opacity="0.26" />
      <stop offset="100%" stop-color="#969CAA" stop-opacity="0.40" />
    </linearGradient>`;
    rimLayers = `
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${bevelR}" ry="${bevelR}" fill="none" stroke="url(#rim-grey)" stroke-width="${meniscusWidth}" stroke-opacity="0.45" filter="url(#meniscus-blur)" />
    <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${innerR}" ry="${innerR}" fill="none" stroke="url(#rim-grey)" stroke-width="1.5" />`;
  } else {
    rimDefs = `
    <linearGradient id="rim-imagery" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.86" />
      <stop offset="48%" stop-color="#FFFFFF" stop-opacity="0.36" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.64" />
    </linearGradient>`;
    rimLayers = `
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${bevelR}" ry="${bevelR}" fill="none" stroke="url(#rim-imagery)" stroke-width="${meniscusWidth}" stroke-opacity="0.38" filter="url(#meniscus-blur)" />
    <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${innerR}" ry="${innerR}" fill="none" stroke="url(#rim-imagery)" stroke-width="1.5" />`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
  <defs>
    <clipPath id="panel-clip">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" />
    </clipPath>
    <linearGradient id="frost-fill" x1="0%" y1="0%" x2="35%" y2="100%">
      <stop offset="0%" stop-color="${frostColor}" stop-opacity="${topFrostOp}" />
      <stop offset="55%" stop-color="${frostColor}" stop-opacity="${midFrostOp}" />
      <stop offset="100%" stop-color="${frostColor}" stop-opacity="${botFrostOp}" />
    </linearGradient>
    <filter id="meniscus-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${meniscusStd}" />
    </filter>${rimDefs}
  </defs>
  <g id="liquid-glass-panel" clip-path="url(#panel-clip)">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="url(#frost-fill)" />${rimLayers}
  </g>
</svg>`;
}

export function generateCompositedGlassSvg(
  bgImage: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: GlassRenderConfig
): string {
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = stageWidth;
  bgCanvas.height = stageHeight;
  const bCtx = bgCanvas.getContext("2d")!;
  bCtx.drawImage(bgImage, 0, 0, stageWidth, stageHeight);
  const bgDataUrl = bgCanvas.toDataURL("image/png");

  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape, 20);
  const px = Math.round(panelX);
  const py = Math.round(panelY);
  const blurPx =
    config.theme === "white"
      ? (3.5 + config.frostOpacity * 5.5).toFixed(1)
      : config.theme === "grey1200"
      ? (4.5 + config.frostOpacity * 6.0).toFixed(1)
      : (5.5 + config.frostOpacity * 8.5).toFixed(1);

  const innerPanelSvg = generateStandaloneGlassSvg(config)
    .replace(/<\?xml.*?\?>\s*/g, "")
    .replace(/<svg[^>]*>/, `<g id="liquid-glass-vector-panel" transform="translate(${px}, ${py})">`)
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
  bgImage: CanvasImageSource,
  stageWidth: number,
  stageHeight: number,
  panelX: number,
  panelY: number,
  config: GlassRenderConfig
): HTMLCanvasElement {
  const w = Math.max(24, Math.round(config.width));
  const h = Math.max(24, Math.round(config.height));
  const r = getCornerRadius(w, h, config.shape);

  const pad = 32;
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
  sCtx.drawImage(bgImage, -sx, -sy, stageWidth, stageHeight);

  const blurBuf = document.createElement("canvas");
  blurBuf.width = sw;
  blurBuf.height = sh;
  const bCtx = blurBuf.getContext("2d", { willReadFrequently: true })!;
  const blurPx =
    config.theme === "white"
      ? 3.5 + config.frostOpacity * 5.5
      : config.theme === "grey1200"
      ? 4.5 + config.frostOpacity * 6.0
      : 5.5 + config.frostOpacity * 8.5;
  bCtx.filter = `blur(${blurPx.toFixed(1)}px) saturate(112%)`;
  bCtx.drawImage(sharpBuf, 0, 0);
  bCtx.filter = "none";

  const blurPixels = bCtx.getImageData(0, 0, sw, sh).data;
  const sharpPixels = sCtx.getImageData(0, 0, sw, sh).data;

  const surfaceCanvas = renderStandaloneGlassPanel(config);
  const surfacePixels = surfaceCanvas
    .getContext("2d", { willReadFrequently: true })!
    .getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d")!;
  const outImg = outCtx.createImageData(w, h);
  const outData = outImg.data;

  const cx = w / 2;
  const cy = h / 2;
  const bx = w / 2;
  const by = h / 2;

  const meniscusZone =
    config.theme === "white"
      ? Math.min(9, Math.min(w, h) * 0.16)
      : Math.min(15, Math.min(w, h) * 0.24);
  const maxDisplace = config.theme === "white" ? 4.5 : 10.5;

  const sampleBilinear = (buf: Uint8ClampedArray, fx: number, fy: number): [number, number, number] => {
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

    const rCol =
      (buf[i00] * (1 - tx) + buf[i10] * tx) * (1 - ty) +
      (buf[i01] * (1 - tx) + buf[i11] * tx) * ty;
    const gCol =
      (buf[i00 + 1] * (1 - tx) + buf[i10 + 1] * tx) * (1 - ty) +
      (buf[i01 + 1] * (1 - tx) + buf[i11 + 1] * tx) * ty;
    const bCol =
      (buf[i00 + 2] * (1 - tx) + buf[i10 + 2] * tx) * (1 - ty) +
      (buf[i01 + 2] * (1 - tx) + buf[i11 + 2] * tx) * ty;
    return [rCol, gCol, bCol];
  };

  for (let y = 0; y < h; y++) {
    const py = y + 0.5 - cy;
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx;
      const d = sdRoundBox(px, py, bx, by, r);
      const maskAlpha = 1 - smoothstep(-0.65, 0.55, d);
      if (maskAlpha <= 0.001) continue;

      const inwardDist = Math.max(0, -d);
      const [nx, ny] = sdRoundBoxNormal(px, py, bx, by, r);

      const lensFactor = Math.pow(Math.max(0, 1 - inwardDist / meniscusZone), 2.2);
      const displaceMag = lensFactor * maxDisplace;

      const baseSampleX = x + pad - nx * displaceMag;
      const baseSampleY = y + pad - ny * displaceMag;

      const dispSpread = config.theme === "white" ? 0.45 : 1.0;
      const edgeClarity = config.theme === "white" ? lensFactor * 0.25 : lensFactor * 0.42;

      const [brR] = sampleBilinear(blurPixels, baseSampleX - nx * lensFactor * dispSpread, baseSampleY - ny * lensFactor * dispSpread);
      const [, brG] = sampleBilinear(blurPixels, baseSampleX, baseSampleY);
      const [, , brB] = sampleBilinear(blurPixels, baseSampleX + nx * lensFactor * dispSpread, baseSampleY + ny * lensFactor * dispSpread);

      const [shR, shG, shB] = sampleBilinear(sharpPixels, baseSampleX, baseSampleY);

      const refrR = brR * (1 - edgeClarity) + shR * edgeClarity;
      const refrG = brG * (1 - edgeClarity) + shG * edgeClarity;
      const refrB = brB * (1 - edgeClarity) + shB * edgeClarity;

      const sIdx = (y * w + x) * 4;
      const surfA = surfacePixels[sIdx + 3] / 255;

      outData[sIdx] = Math.round(surfacePixels[sIdx] * surfA + refrR * (1 - surfA));
      outData[sIdx + 1] = Math.round(surfacePixels[sIdx + 1] * surfA + refrG * (1 - surfA));
      outData[sIdx + 2] = Math.round(surfacePixels[sIdx + 2] * surfA + refrB * (1 - surfA));
      outData[sIdx + 3] = Math.round(maskAlpha * 255);
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}
