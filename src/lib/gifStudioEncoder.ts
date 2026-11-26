import { getMediaFrameAt, renderFrameWithPanels } from "./mediaSupport";
import { buildPalette24, ditherFrameBlueNoise } from "./gifStudioPalette";
import { encodeGif89aFrames } from "./gifStudioLzw";

export async function exportCompositedGif(...a: any[]): Promise<Blob> {
  const media = a[0];
  const frameW = Math.max(2, Math.round(Number(a[1]) || 1080));
  const frameH = Math.max(2, Math.round(Number(a[2]) || 1080));
  const is6 = Array.isArray(a[3]);
  const mediaX = is6 ? 0 : Number(a[3] || 0);
  const mediaY = is6 ? 0 : Number(a[4] || 0);
  const scaledW = is6 ? frameW : Number(a[5] || frameW);
  const scaledH = is6 ? frameH : Number(a[6] || frameH);
  const panels: any[] = is6 ? a[3] : Array.isArray(a[7]) ? a[7] : [];
  const primaryOpacity = Number(is6 ? (a[4] ?? 0.5) : (a[8] ?? 0.5));
  const onProgress = typeof (is6 ? a[5] : a[9]) === "function" ? (is6 ? a[5] : a[9]) : undefined;
  const full = document.createElement("canvas");
  full.width = frameW;
  full.height = frameH;
  const fCtx = full.getContext("2d", { willReadFrequently: true })!;
  const sc = Math.min(1, 960 / Math.max(frameW, frameH));
  const gw = Math.max(2, Math.round(frameW * sc));
  const gh = Math.max(2, Math.round(frameH * sc));
  const work = document.createElement("canvas");
  work.width = gw;
  work.height = gh;
  const wCtx = work.getContext("2d", { willReadFrequently: true })!;
  wCtx.imageSmoothingEnabled = true;
  wCtx.imageSmoothingQuality = "high";
  const cand = media?.video || media?.videoEl || media?.source || getMediaFrameAt(media, 0);
  const vid = typeof HTMLVideoElement !== "undefined" && cand instanceof HTMLVideoElement ? cand : null;
  const rawD = Number(media?.durationSec || media?.duration || vid?.duration || 4);
  const dur = Math.max(0.6, Math.min(8, Number.isFinite(rawD) && rawD > 0 ? rawD : 4));
  const fps = 20;
  const total = Math.max(10, Math.round(dur * fps));
  const rects = panels.map((p: any) => {
    const pw = Number(p.w ?? p.width ?? p.widthInput ?? 400);
    const ph = Number(p.h ?? p.height ?? p.heightInput ?? 200);
    const px = Number(p.x ?? 0);
    const py = Number(p.y ?? 0);
    return { x0: (px - 24) * sc, y0: (py - 24) * sc, x1: (px + pw + 24) * sc, y1: (py + ph + 24) * sc };
  });
  if (vid) vid.pause();
  const grab = async (tSec: number) => {
    if (vid) {
      const maxT = Number.isFinite(vid.duration) && vid.duration > 0.05 ? vid.duration - 0.03 : dur;
      const tgt = Math.max(0, Math.min(maxT, tSec));
      if (Math.abs(vid.currentTime - tgt) > 0.015) {
        await new Promise<void>((res) => {
          let ok = false;
          const fin = () => { if (ok) return; ok = true; vid.removeEventListener("seeked", fin); setTimeout(res, 25); };
          vid.addEventListener("seeked", fin);
          setTimeout(fin, 260);
          try { vid.currentTime = tgt; } catch { fin(); }
        });
      }
    }
    const src = getMediaFrameAt(media, tSec * 1000);
    fCtx.clearRect(0, 0, frameW, frameH);
    (renderFrameWithPanels as any)(fCtx, frameW, frameH, src, mediaX, mediaY, scaledW, scaledH, panels, primaryOpacity);
    wCtx.clearRect(0, 0, gw, gh);
    wCtx.drawImage(full, 0, 0, gw, gh);
    return wCtx.getImageData(0, 0, gw, gh).data;
  };
  try {
    const samples: number[][] = [];
    const sCount = Math.min(10, total);
    const stride = Math.max(3, Math.round(Math.sqrt((gw * gh) / 3200)));
    for (let s = 0; s < sCount; s++) {
      const rgba = await grab((s / sCount) * dur);
      for (let y = 0; y < gh; y += stride) {
        for (let x = 0; x < gw; x += stride) {
          const i = (y * gw + x) * 4;
          const col = [rgba[i], rgba[i + 1], rgba[i + 2]];
          const inP = rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
          const reps = inP ? 14 : 1;
          for (let r = 0; r < reps; r++) samples.push(col);
        }
      }
    }
    onProgress?.(18);
    const pal = buildPalette24(samples);
    const idxFrames: Uint8Array[] = [];
    for (let f = 0; f < total; f++) {
      const rgba = await grab((f / fps) * dur);
      idxFrames.push(ditherFrameBlueNoise(rgba, gw, gh, pal));
      if (f % 2 === 0) {
        onProgress?.(20 + Math.round(((f + 1) / total) * 76));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    const blob = encodeGif89aFrames(gw, gh, pal, idxFrames, 5);
    onProgress?.(100);
    return blob;
  } finally {
    if (vid) vid.play?.().catch(() => {});
  }
}
