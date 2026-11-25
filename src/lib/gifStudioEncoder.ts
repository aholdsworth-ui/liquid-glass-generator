import { LoadedMedia, PanelInstance, getMediaFrameAt, renderFrameWithPanels } from "./mediaSupport";
import { StudioGifBuilder } from "./gifQuantizer24";

export async function exportCompositedGif(
  media: any, frameW: number, frameH: number, mediaX: number, mediaY: number,
  scaledW: number, scaledH: number, panels: PanelInstance[], primaryOpacity: number, onProgress: (pct: number) => void
): Promise<Blob> {
  const w = Math.max(16, Math.round(frameW));
  const h = Math.max(16, Math.round(frameH));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const dur = Math.max(0.5, Math.min(10, (media.durationSec || media.duration || (media.gifTotalMs ? media.gifTotalMs / 1000 : 0) || media.video?.duration || 4) || 4));
  const fps = 15;
  const totalFrames = Math.max(8, Math.round(dur * fps));
  const delayMs = Math.round(1000 / fps);

  const rects = (panels as any[]).map((p: any) => ({ x: p.x, y: p.y, width: p.width, height: p.height }));
  const builder = new StudioGifBuilder(w, h, rects);

  const sampleCount = Math.min(10, totalFrames);
  for (let s = 0; s < sampleCount; s++) {
    const t = (s / Math.max(1, sampleCount - 1)) * Math.max(0, dur - 0.04);
    const frameSrc = await getMediaFrameAt(media, t);
    (renderFrameWithPanels as any)(ctx, frameSrc, frameW, frameH, mediaX, mediaY, scaledW, scaledH, panels, primaryOpacity);
    builder.addKeySample(ctx.getImageData(0, 0, w, h).data);
    onProgress?.(Math.round(((s + 1) / sampleCount) * 20));
    await new Promise((r) => setTimeout(r, 0));
  }

  builder.finalizePalette();

  for (let f = 0; f < totalFrames; f++) {
    const t = (f / totalFrames) * dur;
    const frameSrc = await getMediaFrameAt(media, t);
    (renderFrameWithPanels as any)(ctx, frameSrc, frameW, frameH, mediaX, mediaY, scaledW, scaledH, panels, primaryOpacity);
    builder.writeRgbaFrame(ctx.getImageData(0, 0, w, h).data, delayMs, f === 0);
    onProgress?.(20 + Math.round(((f + 1) / totalFrames) * 80));
    if (f % 2 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  const bytes = builder.finish();
  const blob = new Blob([bytes.buffer as ArrayBuffer as any], { type: "image/gif" });
  
  return blob;
}
