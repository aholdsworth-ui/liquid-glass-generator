import { LoadedMedia, PanelInstance, getMediaFrameAt, renderExactCompositedFrame } from "./mediaSupport";
import { Gif89Writer, lzwEncodeFrame } from "./gifStudioLzw";
import { buildFramePalette24, ditherFrameFloydSteinberg, GlassRect } from "./gifStudioPalette";

async function seekVideoExact(vid: HTMLVideoElement, tSec: number): Promise<void> {
  const target = Math.max(0, Math.min((vid.duration || 10) - 0.005, tSec));
  if (Math.abs(vid.currentTime - target) <= 0.003) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; vid.removeEventListener("seeked", fin); resolve(); } };
    vid.addEventListener("seeked", fin, { once: true });
    vid.currentTime = target;
    setTimeout(fin, 450);
  });
}

function detectMotionInfo(media: LoadedMedia): { vid: HTMLVideoElement | null; durSec: number } {
  const m: any = media;
  const f0 = (getMediaFrameAt as any)(media, 0);
  const vid: HTMLVideoElement | null =
    (typeof HTMLVideoElement !== "undefined" && f0 instanceof HTMLVideoElement ? f0 : null) ||
    Object.values(m).find((v): v is HTMLVideoElement => typeof HTMLVideoElement !== "undefined" && v instanceof HTMLVideoElement) ||
    null;
  if (vid && Number.isFinite(vid.duration) && vid.duration > 0.1) return { vid, durSec: vid.duration };
  const ms = Number(m.totalDurationMs || m.durationMs || 0);
  if (ms > 50) return { vid, durSec: ms / 1000 };
  const sec = Number(m.durationSec || m.duration || 4);
  return { vid, durSec: sec > 100 ? sec / 1000 : Math.max(0.5, sec) };
}
export async function exportCompositedGif(
  media: LoadedMedia, frameW: number, frameH: number,
  mediaX: number, mediaY: number, scaledW: number, scaledH: number,
  panels: PanelInstance[], primaryOpacity: number, onProgress?: (pct: number) => void
): Promise<Blob> {
  const { vid, durSec } = detectMotionInfo(media);
  const wasPaused = vid ? vid.paused : true;
  const savedTime = vid ? vid.currentTime : 0;
  if (vid) vid.pause();
  const MAX_BYTES = 48.5 * 1024 * 1024;
  try {
    onProgress?.(2);
    let gw = Math.max(2, Math.round(frameW)), gh = Math.max(2, Math.round(frameH));
    let fps = 25;
    const cv = document.createElement("canvas");
    const makeRects = (sc: number): GlassRect[] => panels.map((p: any) => {
      const pw = Number(p.width ?? p.w ?? p.widthInput ?? 400);
      const ph = Number(p.height ?? p.h ?? p.heightInput ?? 200);
      return { x0: (p.x - 16) * sc, y0: (p.y - 16) * sc, x1: (p.x + pw + 16) * sc, y1: (p.y + ph + 16) * sc };
    });
    const measureFrameBytes = async (w: number, h: number, t: number): Promise<number> => {
      cv.width = w; cv.height = h;
      const cx = cv.getContext("2d", { willReadFrequently: true })!;
      if (vid) await seekVideoExact(vid, t);
      await renderExactCompositedFrame(cx, media, t, frameW, frameH, w, h, mediaX, mediaY, scaledW, scaledH, panels, primaryOpacity);
      const rgba = cx.getImageData(0, 0, w, h).data;
      const rc = makeRects(w / Math.max(1, frameW));
      const pal = buildFramePalette24(rgba, w, h, rc);
      const idx = ditherFrameFloydSteinberg(rgba, w, h, pal);
      return lzwEncodeFrame(idx).length + 786;
    };
    const b0 = await measureFrameBytes(gw, gh, durSec * 0.15);
    const b1 = await measureFrameBytes(gw, gh, durSec * 0.65);
    const avgB = Math.max(b0, b1) * 1.04;
    if (avgB * Math.round(durSec * 25) > MAX_BYTES) {
      fps = 20;
      const est20 = avgB * Math.round(durSec * 20);
      if (est20 > MAX_BYTES) {
        const sc = Math.max(0.35, Math.min(1, Math.sqrt((44 * 1024 * 1024) / est20)));
        gw = Math.max(2, Math.round((frameW * sc) / 2) * 2);
        gh = Math.max(2, Math.round((frameH * sc) / 2) * 2);
      }
    }
    const total = Math.max(8, Math.round(durSec * fps));
    cv.width = gw; cv.height = gh;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    const rects = makeRects(gw / Math.max(1, frameW));
    const writer = new Gif89Writer(gw, gh);
    for (let f = 0; f < total; f++) {
      const tSec = (f * durSec) / total;
      if (vid) await seekVideoExact(vid, tSec);
      await renderExactCompositedFrame(ctx, media, tSec, frameW, frameH, gw, gh, mediaX, mediaY, scaledW, scaledH, panels, primaryOpacity);
      const rgba = ctx.getImageData(0, 0, gw, gh).data;
      const pal = buildFramePalette24(rgba, gw, gh, rects);
      const idx = ditherFrameFloydSteinberg(rgba, gw, gh, pal);
      const cs0 = Math.round((f * durSec * 100) / total);
      const cs1 = Math.round(((f + 1) * durSec * 100) / total);
      writer.addFrame(idx, pal, Math.max(2, cs1 - cs0));
      onProgress?.(6 + Math.round(((f + 1) / total) * 93));
      await new Promise<void>((r) => setTimeout(() => r(), 0));
    }
    onProgress?.(100);
    return writer.finish();
  } finally {
    if (vid) { vid.currentTime = savedTime; if (!wasPaused) vid.play().catch(() => {}); }
  }
}
