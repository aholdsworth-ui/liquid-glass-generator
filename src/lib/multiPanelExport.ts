import {
  PanelShape,
  BackgroundTheme,
  renderRefractedGlassPatch,
  generateStandaloneGlassSvg,
} from "@/lib/liquidGlassEngine";

export interface CompositedPanelSpec {
  shape: PanelShape;
  theme: BackgroundTheme;
  width: number;
  height: number;
  x: number;
  y: number;
}

export function renderMultiPanelArtworkCanvas(
  croppedBg: HTMLCanvasElement,
  tw: number,
  th: number,
  panels: CompositedPanelSpec[],
  frostOpacity: number
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(croppedBg, 0, 0, tw, th);

  for (const p of panels) {
    if (p.width < 24 || p.height < 24) continue;
    const patch = renderRefractedGlassPatch(out, tw, th, p.x, p.y, {
      width: p.width,
      height: p.height,
      shape: p.shape,
      theme: p.theme,
      frostOpacity,
    });
    ctx.drawImage(
      patch,
      Math.round(p.x - (patch.width - p.width) / 2),
      Math.round(p.y - (patch.height - p.height) / 2)
    );
  }
  return out;
}

export function generateMultiPanelArtworkSvg(
  croppedBg: HTMLCanvasElement,
  tw: number,
  th: number,
  panels: CompositedPanelSpec[],
  frostOpacity: number
): string {
  const bgDataUrl = croppedBg.toDataURL("image/png");
  const blurPx = (7.5 + frostOpacity * 10.0).toFixed(1);
  let defs = "";
  let layers = "";

  panels.forEach((p, idx) => {
    if (p.width < 24 || p.height < 24) return;
    const w = Math.round(p.width);
    const h = Math.round(p.height);
    const maxR = Math.min(w, h) / 2;
    const r = p.shape === "circle" || p.shape === "cta-pill" ? maxR : Math.min(20, maxR);
    const px = Math.round(p.x);
    const py = Math.round(p.y);

    defs += `
    <clipPath id="stage-bd-clip-${idx}">
      <rect x="${px}" y="${py}" width="${w}" height="${h}" rx="${r}" ry="${r}" />
    </clipPath>
    <filter id="stage-bd-blur-${idx}" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${blurPx}" />
    </filter>`;

    const namespacedPanel = generateStandaloneGlassSvg({
      width: w,
      height: h,
      shape: p.shape,
      theme: p.theme,
      frostOpacity,
    })
      .replace(/<\?xml.*?\?>\s*/g, "")
      .replace(/id="([^"]+)"/g, `id="p${idx}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#p${idx}-$1)`)
      .replace(/<svg[^>]*>/, `<g id="glass-panel-${idx + 1}" transform="translate(${px}, ${py})">`)
      .replace(/<\/svg>\s*$/, "</g>");

    layers += `
  <g id="frosted-backdrop-${idx + 1}" clip-path="url(#stage-bd-clip-${idx})">
    <image href="${bgDataUrl}" x="0" y="0" width="${tw}" height="${th}" filter="url(#stage-bd-blur-${idx})" />
  </g>
  ${namespacedPanel}`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}" fill="none">
  <defs>${defs}
  </defs>
  <image id="uploaded-background" href="${bgDataUrl}" x="0" y="0" width="${tw}" height="${th}" />${layers}
</svg>`;
}
