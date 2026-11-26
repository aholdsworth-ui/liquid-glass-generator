import { PanelShape, BackgroundTheme, renderRefractedGlassPatch, generateStandaloneGlassSvg } from "./liquidGlassEngine";

export interface GifFrameItem { canvas: HTMLCanvasElement; delay: number; }
export interface LoadedMedia {
  kind: "static" | "video" | "gif-anim";
  isMotion: boolean;
  width: number;
  height: number;
  name: string;
  canvas?: HTMLCanvasElement;
  video?: HTMLVideoElement;
  frames?: GifFrameItem[];
  totalDurationMs?: number;
}
export interface PanelInstance {
  id: string;
  shape: PanelShape;
  theme: BackgroundTheme;
  widthInput: string;
  heightInput: string;
  x: number;
  y: number;
}

export function getMediaFrameAt(media: LoadedMedia, timeMs: number): CanvasImageSource {
  if (media.kind === "video" && media.video) return media.video;
  if (media.kind === "gif-anim" && media.frames && media.frames.length > 0) {
    const total = Math.max(40, media.totalDurationMs || 1000);
    let rem = ((timeMs % total) + total) % total;
    for (const f of media.frames) {
      if (rem < f.delay) return f.canvas;
      rem -= f.delay;
    }
    return media.frames[media.frames.length - 1].canvas;
  }
  return media.canvas!;
}

export async function loadUniversalMediaFile(file: File): Promise<LoadedMedia> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (ext === "psd" || mime.includes("photoshop")) {
    const { readPsd } = await import("ag-psd");
    const psd = readPsd(await file.arrayBuffer());
    const c = document.createElement("canvas");
    c.width = Math.max(16, psd.width || 1080);
    c.height = Math.max(16, psd.height || 1080);
    const ctx = c.getContext("2d")!;
    if (psd.canvas) ctx.drawImage(psd.canvas, 0, 0);
    else if (psd.children) {
      const draw = (ls: any[]) => ls.forEach((l) => {
        if (l.hidden) return;
        if (l.children) draw(l.children);
        else if (l.canvas) { ctx.save(); ctx.globalAlpha = l.opacity ?? 1; ctx.drawImage(l.canvas, l.left || 0, l.top || 0); ctx.restore(); }
      });
      draw(psd.children);
    }
    return { kind: "static", isMotion: false, width: c.width, height: c.height, name: file.name, canvas: c };
  }

  if (ext === "tif" || ext === "tiff" || mime === "image/tiff") {
    const UTIF = await import("utif");
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const w = ifds[0].width, h = ifds[0].height;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const id = ctx.createImageData(w, h);
    id.data.set(UTIF.toRGBA8(ifds[0]));
    ctx.putImageData(id, 0, 0);
    return { kind: "static", isMotion: false, width: w, height: h, name: file.name, canvas: c };
  }

  if (ext === "gif" || mime === "image/gif") {
    try {
      const { parseGIF, decompressFrames } = await import("gifuct-js");
      const parsed = parseGIF(await file.arrayBuffer());
      const raw = decompressFrames(parsed, true);
      if (raw && raw.length > 1) {
        const gw = parsed.lsd.width || raw[0].dims.width, gh = parsed.lsd.height || raw[0].dims.height;
        const acc = document.createElement("canvas"); acc.width = gw; acc.height = gh;
        const aCtx = acc.getContext("2d")!;
        const pat = document.createElement("canvas"), pCtx = pat.getContext("2d")!;
        const frames: GifFrameItem[] = [];
        let total = 0;
        for (const rf of raw) {
          const { width: pw, height: ph, left: px, top: py } = rf.dims;
          const prev = rf.disposalType === 3 ? aCtx.getImageData(0, 0, gw, gh) : null;
          pat.width = pw; pat.height = ph;
          const pd = pCtx.createImageData(pw, ph); pd.data.set(rf.patch); pCtx.putImageData(pd, 0, 0);
          aCtx.drawImage(pat, px, py);
          const snap = document.createElement("canvas"); snap.width = gw; snap.height = gh;
          snap.getContext("2d")!.drawImage(acc, 0, 0);
          const d = Math.max(30, rf.delay || 80);
          frames.push({ canvas: snap, delay: d }); total += d;
          if (rf.disposalType === 2) aCtx.clearRect(px, py, pw, ph);
          else if (rf.disposalType === 3 && prev) aCtx.putImageData(prev, 0, 0);
        }
        return { kind: "gif-anim", isMotion: true, width: gw, height: gh, name: file.name, frames, totalDurationMs: total };
      }
    } catch {}
  }

  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "m4v", "ogv"].includes(ext)) {
    const vid = document.createElement("video");
    vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = "auto";
    vid.src = URL.createObjectURL(file);
    await new Promise<void>((res, rej) => { vid.onloadeddata = () => res(); vid.onerror = () => rej(new Error("Unsupported video")); });
    await vid.play().catch(() => {});
    return { kind: "video", isMotion: true, width: vid.videoWidth || 1920, height: vid.videoHeight || 1080, name: file.name, video: vid };
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Unsupported image")); img.src = url; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 1080; c.height = img.naturalHeight || 1080;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return { kind: "static", isMotion: false, width: c.width, height: c.height, name: file.name, canvas: c };
}

export function renderFrameWithPanels(
  outCtx: CanvasRenderingContext2D, frameW: number, frameH: number, drawable: CanvasImageSource,
  mediaX: number, mediaY: number, scaledW: number, scaledH: number, panels: PanelInstance[], primaryOpacity: number
) {
  const bgBuf = document.createElement("canvas");
  bgBuf.width = frameW; bgBuf.height = frameH;
  const bCtx = bgBuf.getContext("2d")!;
  bCtx.imageSmoothingEnabled = true; bCtx.imageSmoothingQuality = "high";
  bCtx.fillStyle = "#FFFFFF"; bCtx.fillRect(0, 0, frameW, frameH);
  bCtx.drawImage(drawable, mediaX, mediaY, scaledW, scaledH);

  outCtx.clearRect(0, 0, frameW, frameH);
  outCtx.drawImage(bgBuf, 0, 0);

  for (const p of panels) {
    const pw = Math.max(24, parseInt(p.widthInput || "0", 10) || 0);
    const ph = p.shape === "circle" ? pw : Math.max(24, parseInt(p.heightInput || "0", 10) || 0);
    if (pw < 24 || ph < 24) continue;
    const patch = renderRefractedGlassPatch(bgBuf, frameW, frameH, p.x, p.y, {
      width: pw, height: ph, shape: p.shape, theme: p.theme, frostOpacity: primaryOpacity,
    });
    outCtx.drawImage(patch, Math.round(p.x - (patch.width - pw) / 2), Math.round(p.y - (patch.height - ph) / 2));
  }
}

export function exportMultiPanelSvg(
  frameW: number, frameH: number, drawable: CanvasImageSource,
  mediaX: number, mediaY: number, scaledW: number, scaledH: number, panels: PanelInstance[], primaryOpacity: number
): string {
  const bgBuf = document.createElement("canvas");
  bgBuf.width = frameW; bgBuf.height = frameH;
  const bCtx = bgBuf.getContext("2d")!;
  bCtx.fillStyle = "#FFFFFF"; bCtx.fillRect(0, 0, frameW, frameH);
  bCtx.drawImage(drawable, mediaX, mediaY, scaledW, scaledH);
  const bgUrl = bgBuf.toDataURL("image/png");
  const blurPx = (8 + primaryOpacity * 10).toFixed(1);
  let clips = "", blurs = "", overlays = "";
  panels.forEach((p, i) => {
    const pw = Math.max(24, parseInt(p.widthInput || "0", 10) || 0);
    const ph = p.shape === "circle" ? pw : Math.max(24, parseInt(p.heightInput || "0", 10) || 0);
    const maxR = Math.min(pw, ph) / 2;
    const r = p.shape === "circle" || p.shape === "cta-pill" ? maxR : Math.min(20, maxR);
    const px = Math.round(p.x), py = Math.round(p.y);
    clips += `<clipPath id="pc-${i}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${r}" ry="${r}"/></clipPath>`;
    blurs += `<g clip-path="url(#pc-${i})"><image href="${bgUrl}" x="0" y="0" width="${frameW}" height="${frameH}" filter="url(#sb)"/></g>`;
    overlays += generateStandaloneGlassSvg({ width: pw, height: ph, shape: p.shape, theme: p.theme, frostOpacity: primaryOpacity })
      .replace(/<\?xml.*?\?>\s*/g, "").replace(/<svg[^>]*>/, `<g transform="translate(${px},${py})">`).replace(/<\/svg>\s*$/, "</g>");
  });
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}" viewBox="0 0 ${frameW} ${frameH}" fill="none"><defs><filter id="sb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blurPx}"/></filter>${clips}</defs><image href="${bgUrl}" x="0" y="0" width="${frameW}" height="${frameH}"/>${blurs}${overlays}</svg>`;
}

export async function exportCompositedMp4(
  media: LoadedMedia, frameW: number, frameH: number, mediaX: number, mediaY: number,
  scaledW: number, scaledH: number, panels: PanelInstance[], primaryOpacity: number, onProgress: (pct: number) => void
): Promise<Blob> {
  const evenW = Math.max(16, Math.round(frameW / 2) * 2), evenH = Math.max(16, Math.round(frameH / 2) * 2);
  const sx = evenW / frameW, sy = evenH / frameH;
  const sp = panels.map((p) => ({
    ...p, x: p.x * sx, y: p.y * sy,
    widthInput: String(Math.round((parseInt(p.widthInput || "0", 10) || 0) * sx)),
    heightInput: String(Math.round((parseInt(p.heightInput || "0", 10) || 0) * sy)),
  }));
  const recCanvas = document.createElement("canvas"); recCanvas.width = evenW; recCanvas.height = evenH;
  const rCtx = recCanvas.getContext("2d")!;
  const mimes = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const chosen = mimes.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
  const recorder = new MediaRecorder(recCanvas.captureStream(30), { ...(chosen ? { mimeType: chosen } : {}), videoBitsPerSecond: 12_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
  const durSec = media.kind === "video" && media.video ? Math.min(25, Math.max(2, media.video.duration || 5)) : Math.min(20, Math.max(2.5, (media.totalDurationMs || 3000) / 1000));
  if (media.kind === "video" && media.video) { media.video.currentTime = 0; await media.video.play().catch(() => {}); }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (e) => reject(e);
    recorder.onstop = () => resolve(new Blob(chunks, { type: chosen || "video/mp4" }));
    recorder.start(100);
    const startMs = performance.now(), totalMs = durSec * 1000;
    const tick = () => {
      const elapsed = performance.now() - startMs;
      onProgress(Math.min(99, Math.round((elapsed / totalMs) * 100)));
      renderFrameWithPanels(rCtx, evenW, evenH, getMediaFrameAt(media, elapsed), mediaX * sx, mediaY * sy, scaledW * sx, scaledH * sy, sp, primaryOpacity);
      if (elapsed >= totalMs) { onProgress(100); recorder.stop(); } else requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function renderExactCompositedFrame(
  ctx: CanvasRenderingContext2D, media: LoadedMedia, tSec: number,
  frameW: number, frameH: number, outW: number, outH: number,
  mediaX: number, mediaY: number, scaledW: number, scaledH: number,
  panels: PanelInstance[], primaryOpacity: number
): Promise<void> {
  const sx = outW / Math.max(1, frameW), sy = outH / Math.max(1, frameH);
  const sp = panels.map((pn: any) => ({
    ...pn, x: pn.x * sx, y: pn.y * sy,
    ...(pn.width !== undefined ? { width: pn.width * sx } : {}),
    ...(pn.height !== undefined ? { height: pn.height * sy } : {}),
    ...(pn.w !== undefined ? { w: pn.w * sx } : {}),
    ...(pn.h !== undefined ? { h: pn.h * sy } : {}),
  }));
  const src = (getMediaFrameAt as any)(media, tSec * 1000);
  (renderFrameWithPanels as any)(
    ctx, outW, outH, src, mediaX * sx, mediaY * sy,
    scaledW * sx, scaledH * sy, sp, primaryOpacity
  );
}
