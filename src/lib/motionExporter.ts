import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { BgTransform, ResolvedPanel, drawCompositedStageFrame } from "./liquidGlassEngine";

export interface MotionController {
  width: number;
  height: number;
  duration: number;
  getCurrentSource: (nowMs: number) => CanvasImageSource;
  stepFrames: (fps: number, maxSec: number, cb: (src: CanvasImageSource, idx: number, total: number) => Promise<void>) => Promise<void>;
  destroy: () => void;
}

export async function loadMotionFile(file: File): Promise<MotionController> {
  const url = URL.createObjectURL(file);
  const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

  if (isGif && typeof (window as any).ImageDecoder !== "undefined") {
    try {
      const buf = await file.arrayBuffer();
      const dec = new (window as any).ImageDecoder({ data: buf, type: "image/gif" });
      await dec.tracks.ready;
      const count = Math.max(1, dec.tracks.selectedTrack?.frameCount || 1);
      const frames: { canvas: HTMLCanvasElement; startMs: number; durMs: number }[] = [];
      let acc = 0;
      for (let i = 0; i < count; i++) {
        const { image } = await dec.decode({ frameIndex: i, completeFramesOnly: true });
        const c = document.createElement("canvas");
        c.width = image.displayWidth; c.height = image.displayHeight;
        c.getContext("2d")!.drawImage(image, 0, 0);
        const durMs = Math.max(30, Math.round((image.duration || 80000) / 1000));
        image.close();
        frames.push({ canvas: c, startMs: acc, durMs });
        acc += durMs;
      }
      dec.close();
      URL.revokeObjectURL(url);
      const totalMs = Math.max(100, acc);
      const pick = (tMs: number) => {
        const m = ((tMs % totalMs) + totalMs) % totalMs;
        return (frames.find((f) => m >= f.startMs && m < f.startMs + f.durMs) || frames[frames.length - 1]).canvas;
      };
      return {
        width: frames[0].canvas.width, height: frames[0].canvas.height, duration: totalMs / 1000,
        getCurrentSource: (nowMs) => pick(nowMs),
        stepFrames: async (fps, maxSec, cb) => {
          const dur = Math.min(totalMs / 1000, maxSec);
          const total = Math.max(1, Math.round(dur * fps));
          for (let i = 0; i < total; i++) {
            await cb(pick((i / fps) * 1000), i, total);
            await new Promise((r) => setTimeout(r, 0));
          }
        },
        destroy: () => {},
      };
    } catch {}
  }

  if (isGif) {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = url;
    });
    return {
      width: img.naturalWidth, height: img.naturalHeight, duration: 3,
      getCurrentSource: () => img,
      stepFrames: async (fps, maxSec, cb) => {
        const total = Math.max(1, Math.round(Math.min(3, maxSec) * fps));
        for (let i = 0; i < total; i++) { await cb(img, i, total); await new Promise((r) => setTimeout(r, 0)); }
      },
      destroy: () => URL.revokeObjectURL(url),
    };
  }

  const video = document.createElement("video");
  video.src = url; video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
  await new Promise<void>((res, rej) => {
    video.onloadeddata = () => res();
    video.onerror = () => rej(new Error("Unsupported video format"));
  });
  await video.play().catch(() => {});
  const duration = Number.isFinite(video.duration) && video.duration > 0.15 ? video.duration : 5;

  return {
    width: video.videoWidth, height: video.videoHeight, duration,
    getCurrentSource: () => video,
    stepFrames: async (fps, maxSec, cb) => {
      video.pause();
      try {
        const clip = Math.min(duration, maxSec);
        const total = Math.max(1, Math.round(clip * fps));
        for (let i = 0; i < total; i++) {
          const t = Math.min(Math.max(0, duration - 0.02), i / fps);
          if (Math.abs(video.currentTime - t) > 0.008) {
            await new Promise<void>((r) => {
              const timer = setTimeout(r, 400);
              video.onseeked = () => { clearTimeout(timer); r(); };
              video.currentTime = t;
            });
          }
          await cb(video, i, total);
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        video.play().catch(() => {});
      }
    },
    destroy: () => { video.pause(); video.src = ""; URL.revokeObjectURL(url); },
  };
}

export async function exportMotionMp4(
  motion: MotionController, stageW: number, stageH: number, bg: BgTransform, panels: ResolvedPanel[], onProgress: (pct: number) => void
): Promise<Blob> {
  const fps = 24;
  const scaleCap = Math.min(1, 3840 / Math.max(stageW, stageH));
  const encW = Math.max(2, Math.round((stageW * scaleCap) / 2) * 2);
  const encH = Math.max(2, Math.round((stageH * scaleCap) / 2) * 2);
  const rx = encW / stageW, ry = encH / stageH;
  const scaledBg: BgTransform = { scale: bg.scale, offsetX: bg.offsetX * rx, offsetY: bg.offsetY * ry };
  const scaledPanels: ResolvedPanel[] = panels.map((p) => ({ ...p, x: p.x * rx, y: p.y * ry, width: p.width * rx, height: p.height * ry }));

  const work = document.createElement("canvas"); work.width = encW; work.height = encH;
  const wCtx = work.getContext("2d")!;
  const VE = (window as any).VideoEncoder, VF = (window as any).VideoFrame;

  if (VE && VF) {
    let chosen = "";
    for (const c of ["avc1.640034", "avc1.640033", "avc1.640028", "avc1.4d002a", "avc1.420028", "avc1.42001f"]) {
      const sup = await VE.isConfigSupported({ codec: c, width: encW, height: encH, bitrate: 8_000_000, framerate: fps }).catch(() => null);
      if (sup?.supported) { chosen = c; break; }
    }
    if (chosen) {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({ target, video: { codec: "avc", width: encW, height: encH }, fastStart: "in-memory" });
      const encoder = new VE({ output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta), error: (e: any) => console.error(e) });
      encoder.configure({ codec: chosen, width: encW, height: encH, bitrate: 8_000_000, framerate: fps });

      await motion.stepFrames(fps, 30, async (src, i, total) => {
        drawCompositedStageFrame(wCtx, src, motion.width, motion.height, encW, encH, scaledBg, scaledPanels);
        const frame = new VF(work, { timestamp: Math.round((i * 1_000_000) / fps), duration: Math.round(1_000_000 / fps) });
        encoder.encode(frame, { keyFrame: i % 24 === 0 });
        frame.close();
        onProgress(Math.round(((i + 1) / total) * 100));
      });
      await encoder.flush(); encoder.close(); muxer.finalize();
      return new Blob([target.buffer], { type: "video/mp4" });
    }
  }

  const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
  const rec = new MediaRecorder(work.captureStream(fps), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.start();
  await motion.stepFrames(fps, 20, async (src, i, total) => {
    drawCompositedStageFrame(wCtx, src, motion.width, motion.height, encW, encH, scaledBg, scaledPanels);
    onProgress(Math.round(((i + 1) / total) * 100));
    await new Promise((r) => setTimeout(r, 1000 / fps));
  });
  await new Promise<void>((r) => { rec.onstop = () => r(); rec.stop(); });
  return new Blob(chunks, { type: "video/mp4" });
}

export async function exportMotionGif(
  motion: MotionController, stageW: number, stageH: number, bg: BgTransform, panels: ResolvedPanel[], onProgress: (pct: number) => void
): Promise<Blob> {
  const fps = motion.duration > 8 ? 10 : 12;
  const delay = Math.round(1000 / fps);
  const work = document.createElement("canvas"); work.width = stageW; work.height = stageH;
  const wCtx = work.getContext("2d", { willReadFrequently: true })!;
  const gif = GIFEncoder();

  await motion.stepFrames(fps, 15, async (src, i, total) => {
    drawCompositedStageFrame(wCtx, src, motion.width, motion.height, stageW, stageH, bg, panels);
    const rgba = wCtx.getImageData(0, 0, stageW, stageH).data;
    const pal = quantize(rgba, 256, { format: "rgb444" });
    const idx = applyPalette(rgba, pal, "rgb444");
    gif.writeFrame(idx, stageW, stageH, { palette: pal, delay, repeat: 0 });
    onProgress(Math.round(((i + 1) / total) * 100));
  });
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
}
