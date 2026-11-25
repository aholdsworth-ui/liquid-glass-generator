import { GIFEncoder } from "gifenc";
import { LoadedMedia, PanelInstance, getMediaFrameAt, renderFrameWithPanels } from "./mediaSupport";

const BAYER_4X4 = [
  -4.5,  0.3, -3.3,  1.5,
   2.7, -2.1,  3.9, -0.9,
  -2.7,  2.1, -3.9,  0.9,
   4.5, -0.3,  3.3, -1.5,
];

function buildPinnedNeutralPalette(samples: number[][]): number[][] {
  const greySteps = [
    0, 5, 10, 14, 18, 22, 26, 30, 35, 40, 46, 52, 59, 67,
    76, 86, 97, 109, 122, 136, 150, 165, 180, 195, 210, 225, 240, 255,
  ];
  const pinned: number[][] = greySteps.map((g) => [g, g, g]);
  pinned.push([18, 19, 23], [24, 26, 31], [32, 35, 42], [44, 47, 55]);

  const chroma = samples.filter(([r, g, b]) => {
    for (let i = 0; i < pinned.length; i++) {
      const p = pinned[i];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      if (dr * dr + dg * dg + db * db <= 36) return false;
    }
    return true;
  });

  const targetBoxes = 256 - pinned.length;
  if (chroma.length === 0) {
    while (pinned.length < 256) pinned.push([0, 0, 0]);
    return pinned;
  }

  const boxes: number[][][] = [chroma];
  while (boxes.length < targetBoxes) {
    let bestIdx = -1, bestScore = 1, bestAxis = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (let j = 0; j < box.length; j++) {
        const c = box[j];
        if (c[0] < rMin) rMin = c[0]; if (c[0] > rMax) rMax = c[0];
        if (c[1] < gMin) gMin = c[1]; if (c[1] > gMax) gMax = c[1];
        if (c[2] < bMin) bMin = c[2]; if (c[2] > bMax) bMax = c[2];
      }
      const rSpan = (rMax - rMin) * 0.95, gSpan = (gMax - gMin) * 1.05, bSpan = (bMax - bMin) * 0.85;
      const score = Math.max(rSpan, gSpan, bSpan) * Math.pow(box.length, 0.35);
      if (score > bestScore) {
        bestScore = score; bestIdx = i;
        bestAxis = gSpan >= rSpan && gSpan >= bSpan ? 1 : rSpan >= bSpan ? 0 : 2;
      }
    }
    if (bestIdx === -1) break;
    const chosen = boxes.splice(bestIdx, 1)[0];
    chosen.sort((a, b) => a[bestAxis] - b[bestAxis]);
    const mid = chosen.length >> 1;
    boxes.push(chosen.slice(0, mid), chosen.slice(mid));
  }

  for (const box of boxes) {
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < box.length; i++) { sr += box[i][0]; sg += box[i][1]; sb += box[i][2]; }
    const n = Math.max(1, box.length);
    pinned.push([Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)]);
  }
  while (pinned.length < 256) pinned.push([0, 0, 0]);
  return pinned.slice(0, 256);
}

function build64CubeLut(palette: number[][]): Uint8Array {
  const lut = new Uint8Array(64 * 64 * 64);
  let ptr = 0;
  for (let r6 = 0; r6 < 64; r6++) {
    const r = (r6 << 2) | (r6 >> 4);
    for (let g6 = 0; g6 < 64; g6++) {
      const g = (g6 << 2) | (g6 >> 4);
      for (let b6 = 0; b6 < 64; b6++) {
        const b = (b6 << 2) | (b6 >> 4);
        let best = 0, bestDist = 1e12;
        for (let i = 0; i < 256; i++) {
          const p = palette[i];
          const dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) >> 1;
          const dist = (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
          if (dist < bestDist) { bestDist = dist; best = i; if (dist === 0) break; }
        }
        lut[ptr++] = best;
      }
    }
  }
  return lut;
}

async function seekVideoTo(video: HTMLVideoElement, sec: number): Promise<void> {
  const target = Math.max(0, Math.min(Math.max(0, (video.duration || 5) - 0.03), sec));
  if (Math.abs(video.currentTime - target) < 0.01) return;
  await new Promise<void>((resolve) => {
    let doneFlag = false;
    const done = () => { if (doneFlag) return; doneFlag = true; video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done);
    video.currentTime = target;
    setTimeout(done, 320);
  });
}

export async function exportCompositedGif(
  media: LoadedMedia, frameW: number, frameH: number, mediaX: number, mediaY: number,
  scaledW: number, scaledH: number, panels: PanelInstance[], primaryOpacity: number, onProgress: (pct: number) => void
): Promise<Blob> {
  const capScale = Math.min(1, 960 / Math.max(frameW, frameH));
  const gw = Math.max(32, Math.round((frameW * capScale) / 2) * 2);
  const gh = Math.max(32, Math.round((frameH * capScale) / 2) * 2);
  const sx = gw / frameW, sy = gh / frameH;

  const sp = panels.map((p) => ({
    ...p, x: p.x * sx, y: p.y * sy,
    widthInput: String(Math.max(24, Math.round((parseInt(p.widthInput || "0", 10) || 0) * sx))),
    heightInput: String(Math.max(24, Math.round((parseInt(p.heightInput || "0", 10) || 0) * sy))),
  }));

  const work = document.createElement("canvas"); work.width = gw; work.height = gh;
  const wCtx = work.getContext("2d", { willReadFrequently: true })!;
  const fps = 15, delayMs = Math.round(1000 / fps);
  const durSec = media.kind === "video" && media.video
    ? Math.min(12, Math.max(1.5, media.video.duration || 5))
    : Math.min(12, Math.max(1.5, (media.totalDurationMs || 3000) / 1000));
  const totalFrames = Math.max(8, Math.round(durSec * fps));

  if (media.kind === "video" && media.video) media.video.pause();

  try {
    const samples: number[][] = [];
    const sampleCount = Math.min(8, totalFrames), pixelTotal = gw * gh;
    const stride = Math.max(1, Math.floor(pixelTotal / 8500));

    for (let s = 0; s < sampleCount; s++) {
      const tSec = (s / sampleCount) * durSec;
      if (media.kind === "video" && media.video) await seekVideoTo(media.video, tSec);
      renderFrameWithPanels(wCtx, gw, gh, getMediaFrameAt(media, tSec * 1000), mediaX * sx, mediaY * sy, scaledW * sx, scaledH * sy, sp, primaryOpacity);
      const rgba = wCtx.getImageData(0, 0, gw, gh).data;
      for (let p = 0; p < pixelTotal; p += stride) { const o = p * 4; samples.push([rgba[o], rgba[o + 1], rgba[o + 2]]); }
      onProgress(Math.round(((s + 1) / sampleCount) * 18));
      await new Promise((r) => setTimeout(r, 0));
    }

    const palette = buildPinnedNeutralPalette(samples);
    const lut = build64CubeLut(palette);
    const gif = GIFEncoder();
    const indexed = new Uint8Array(pixelTotal);

    for (let f = 0; f < totalFrames; f++) {
      const tSec = (f / totalFrames) * durSec;
      if (media.kind === "video" && media.video) await seekVideoTo(media.video, tSec);
      renderFrameWithPanels(wCtx, gw, gh, getMediaFrameAt(media, tSec * 1000), mediaX * sx, mediaY * sy, scaledW * sx, scaledH * sy, sp, primaryOpacity);
      const rgba = wCtx.getImageData(0, 0, gw, gh).data;

      let ptr = 0;
      for (let y = 0; y < gh; y++) {
        const rowOff = (y & 3) << 2;
        for (let x = 0; x < gw; x++) {
          const o = ptr << 2;
          const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
          const baseIdx = lut[((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2)];
          const pc = palette[baseIdx];
          if (Math.abs(r - pc[0]) <= 2 && Math.abs(g - pc[1]) <= 2 && Math.abs(b - pc[2]) <= 2) {
            indexed[ptr] = baseIdx;
          } else {
            const d = BAYER_4X4[rowOff + (x & 3)];
            const rd = Math.max(0, Math.min(255, Math.round(r + d)));
            const gd = Math.max(0, Math.min(255, Math.round(g + d)));
            const bd = Math.max(0, Math.min(255, Math.round(b + d)));
            indexed[ptr] = lut[((rd >> 2) << 12) | ((gd >> 2) << 6) | (bd >> 2)];
          }
          ptr++;
        }
      }
      gif.writeFrame(indexed, gw, gh, f === 0 ? { palette, delay: delayMs, repeat: 0 } : { delay: delayMs });
      onProgress(18 + Math.round(((f + 1) / totalFrames) * 82));
      if (f % 3 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    gif.finish();
    const raw = gif.bytes();
    const out = new Uint8Array(raw.length);
    out.set(raw);
    return new Blob([out.buffer], { type: "image/gif" });
  } finally {
    if (media.kind === "video" && media.video) media.video.play().catch(() => {});
  }
}
