import * as GifEncMod from "gifenc";
import {
  LoadedMedia,
  PanelInstance,
  renderExactCompositedFrame,
} from "./mediaSupport";
import { buildStudioPalette256, ditherFrameIgn } from "./gifStudioPalette";

export async function exportCompositedGif(
  media: LoadedMedia, frameW: number, frameH: number,
  mediaX: number, mediaY: number, scaledW: number, scaledH: number,
  panels: PanelInstance[], primaryOpacity: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const m: any = media;
  const makeGif: any =
    (GifEncMod as any).GIFEncoder ||
    (GifEncMod as any).default?.GIFEncoder ||
    (GifEncMod as any).default;
  const full = document.createElement("canvas");
  full.width = Math.max(2, Math.round(frameW));
  full.height = Math.max(2, Math.round(frameH));
  const fCtx = full.getContext("2d", { willReadFrequently: true })!;
  const sc = Math.min(1, 1080 / Math.max(full.width, full.height));
  const gw = Math.max(2, Math.round(full.width * sc) & ~1);
  const gh = Math.max(2, Math.round(full.height * sc) & ~1);
  const gCan = sc < 0.999 ? document.createElement("canvas") : full;
  if (gCan !== full) { gCan.width = gw; gCan.height = gh; }
  const gCtx = gCan.getContext("2d", { willReadFrequently: true })!;
  gCtx.imageSmoothingEnabled = true;
  const vid: any = m?.video || m?.videoEl || null;
  const dur = Math.max(0.6, Math.min(8, Number(m?.durationSec || m?.duration || vid?.duration || 4)));
  const total = Math.max(10, Math.round(dur * 20));
  const rects = panels.map((p: any) => { const pw = Number(p.width ?? p.w ?? p.widthInput ?? 400), ph = Number(p.height ?? p.h ?? p.heightInput ?? 200); return { x0: (p.x - 20) * sc, y0: (p.y - 20) * sc, x1: (p.x + pw + 20) * sc, y1: (p.y + ph + 20) * sc }; });
  const grab = async (t: number) => {
    await (renderExactCompositedFrame as any)(
      fCtx, t, media, frameW, frameH, mediaX, mediaY, scaledW, scaledH, panels, primaryOpacity
    );
    if (gCan !== full) { gCtx.clearRect(0, 0, gw, gh); gCtx.drawImage(full, 0, 0, gw, gh); }
    return gCtx.getImageData(0, 0, gw, gh).data;
  };
  try {
    const samples: number[][] = [];
    const sCount = Math.min(8, total);
    const st = Math.max(3, Math.round(Math.sqrt((gw * gh) / 3000)));
    for (let s = 0; s < sCount; s++) {
      const rgba = await grab((s / sCount) * dur);
      for (let y = 0; y < gh; y += st) {
        for (let x = 0; x < gw; x += st) {
          const i = (y * gw + x) * 4;
          const inP = rects.some((rc) => x >= rc.x0 && x <= rc.x1 && y >= rc.y0 && y <= rc.y1);
          for (let k = 0; k < (inP ? 5 : 1); k++) samples.push([rgba[i], rgba[i+1], rgba[i+2]]);
        }
      }
      onProgress?.(Math.round(((s + 1) / sCount) * 20));
    }
    const pal = buildStudioPalette256(samples);
    const lut = new Int32Array(32768).fill(-1);
    const gif = makeGif();
    for (let f = 0; f < total; f++) {
      const idx = ditherFrameIgn(await grab((f / total) * dur), gw, gh, pal, lut);
      gif.writeFrame(idx, gw, gh, { palette: pal, delay: 50, repeat: 0 });
      if (f % 2 === 0) {
        onProgress?.(20 + Math.round(((f + 1) / total) * 79));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    gif.finish();
    onProgress?.(100);
    return new Blob([gif.bytes() as any], { type: "image/gif" });
  } finally {
    if (vid) vid.play?.().catch(() => {});
  }
}
