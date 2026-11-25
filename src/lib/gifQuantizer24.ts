import { GIFEncoder } from "gifenc";

export interface GifRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function colorDistSq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rMean = (r1 + r2) * 0.5;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

export class StudioGifBuilder {
  private w: number;
  private h: number;
  private rects: GifRect[];
  private samples: number[] = [];
  private cornerBg: [number, number, number] = [18, 19, 23];
  private hasCorner = false;
  private palette: Array<[number, number, number]> = [];
  private lut = new Int16Array(128 * 128 * 128).fill(-1);
  private gif = GIFEncoder();

  constructor(w: number, h: number, rects: GifRect[]) {
    this.w = w;
    this.h = h;
    this.rects = rects;
  }

  private inPanel(x: number, y: number): boolean {
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (x >= r.x - 16 && x <= r.x + r.width + 16 && y >= r.y - 16 && y <= r.y + r.height + 16) {
        return true;
      }
    }
    return false;
  }

  addKeySample(rgba: Uint8ClampedArray): void {
    if (!this.hasCorner && rgba.length >= 16) {
      this.cornerBg = [rgba[0], rgba[1], rgba[2]];
      this.hasCorner = true;
    }
    const w = this.w;
    const h = this.h;
    for (let y = 0; y < h; y += 2) {
      const rowOff = y * w;
      for (let x = 0; x < w; x += 2) {
        const inside = this.inPanel(x, y);
        if (!inside && ((x + y) & 14) !== 0) continue;
        const i = (rowOff + x) * 4;
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        const packed = (r << 16) | (g << 8) | b;
        this.samples.push(packed);
        if (inside) {
          this.samples.push(packed);
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          if (chroma >= 8) {
            this.samples.push(packed, packed);
          }
        }
      }
    }
  }

  finalizePalette(): void {
    const anchors: Array<[number, number, number]> = [
      [18, 19, 23],
      [0, 0, 0],
      [255, 255, 255],
      this.cornerBg,
    ];
    for (let v = 14; v <= 106; v += 4) anchors.push([v, v, v]);
    for (let v = 22; v <= 86; v += 8) anchors.push([v, v + 1, v + 3]);
    for (const v of [118, 134, 152, 170, 188, 204, 216, 226, 235, 243, 249, 253]) {
      anchors.push([v, v, v]);
    }
    const pinnedCount = anchors.length;
    const targetBoxes = 256 - pinnedCount;

    let pool = this.samples;
    if (pool.length > 75000) {
      const sub: number[] = [];
      const step = pool.length / 75000;
      for (let i = 0; i < 75000; i++) sub.push(pool[Math.floor(i * step)]);
      pool = sub;
    }
    if (pool.length === 0) pool = [0x121317, 0xffffff];

    const boxes: number[][] = [pool];
    const boxScore = (arr: number[]): { score: number; axis: number } => {
      if (arr.length < 2) return { score: -1, axis: 0 };
      let sr = 0, sg = 0, sb = 0, srr = 0, sgg = 0, sbb = 0;
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const c = arr[i];
        const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        sr += r; sg += g; sb += b;
        srr += r * r; sgg += g * g; sbb += b * b;
      }
      const vr = (srr - (sr * sr) / n) / n;
      const vg = (sgg - (sg * sg) / n) / n;
      const vb = (sbb - (sb * sb) / n) / n;
      const wr = vr * 2.2, wg = vg * 4.0, wb = vb * 1.8;
      const axis = wg >= wr && wg >= wb ? 1 : wr >= wb ? 0 : 2;
      return { score: (wr + wg + wb) * Math.pow(n, 0.62), axis };
    };

    while (boxes.length < targetBoxes) {
      let bestIdx = -1, bestScore = 0, bestAxis = 0;
      for (let i = 0; i < boxes.length; i++) {
        const { score, axis } = boxScore(boxes[i]);
        if (score > bestScore) { bestScore = score; bestIdx = i; bestAxis = axis; }
      }
      if (bestIdx < 0 || bestScore <= 0.5) break;
      const target = boxes[bestIdx];
      const shift = bestAxis === 0 ? 16 : bestAxis === 1 ? 8 : 0;
      target.sort((a, b) => ((a >> shift) & 255) - ((b >> shift) & 255));
      const mid = target.length >> 1;
      boxes.splice(bestIdx, 1, target.slice(0, mid), target.slice(mid));
    }

    const centroids: Array<[number, number, number]> = [...anchors];
    for (const b of boxes) {
      let sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < b.length; i++) {
        sr += (b[i] >> 16) & 255; sg += (b[i] >> 8) & 255; sb += b[i] & 255;
      }
      const n = Math.max(1, b.length);
      centroids.push([Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)]);
    }
    while (centroids.length < 256) centroids.push([18, 19, 23]);

    // 2 fast K-Means passes on adaptive centroids (indices pinnedCount..255)
    const kSub = pool.length > 16000 ? pool.filter((_, idx) => idx % Math.ceil(pool.length / 16000) === 0) : pool;
    for (let pass = 0; pass < 2; pass++) {
      const sumR = new Float64Array(256), sumG = new Float64Array(256), sumB = new Float64Array(256), cnt = new Int32Array(256);
      for (let i = 0; i < kSub.length; i++) {
        const c = kSub[i];
        const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        let best = 0, bestD = 1e18;
        for (let p = 0; p < 256; p++) {
          const cp = centroids[p];
          const d = colorDistSq(r, g, b, cp[0], cp[1], cp[2]);
          if (d < bestD) { bestD = d; best = p; }
        }
        sumR[best] += r; sumG[best] += g; sumB[best] += b; cnt[best]++;
      }
      for (let p = pinnedCount; p < 256; p++) {
        if (cnt[p] > 0) {
          centroids[p] = [Math.round(sumR[p] / cnt[p]), Math.round(sumG[p] / cnt[p]), Math.round(sumB[p] / cnt[p])];
        }
      }
    }
    this.palette = centroids;
    this.lut.fill(-1);
    this.samples = [];
  }

  private nearest(r: number, g: number, b: number): number {
    const cr = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    const cg = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    const cb = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    const key = ((cr >> 1) << 14) | ((cg >> 1) << 7) | (cb >> 1);
    const cached = this.lut[key];
    if (cached >= 0) return cached;
    let best = 0, bestD = 1e18;
    for (let i = 0; i < 256; i++) {
      const p = this.palette[i];
      const d = colorDistSq(cr, cg, cb, p[0], p[1], p[2]);
      if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
    }
    this.lut[key] = best;
    return best;
  }

  writeRgbaFrame(rgba: Uint8ClampedArray, delayMs: number, isFirst: boolean): void {
    const w = this.w, h = this.h;
    const indexed = new Uint8Array(w * h);
    let curErr = new Float32Array((w + 2) * 3);
    let nxtErr = new Float32Array((w + 2) * 3);
    const bg = this.cornerBg;

    for (let y = 0; y < h; y++) {
      nxtErr.fill(0);
      const serp = (y & 1) === 1;
      for (let step = 0; step < w; step++) {
        const x = serp ? w - 1 - step : step;
        const pIdx = y * w + x;
        const i4 = pIdx * 4;
        const r0 = rgba[i4], g0 = rgba[i4 + 1], b0 = rgba[i4 + 2];

        // Snap solid flat background pixels without error bleed
        if (
          (Math.abs(r0 - 18) <= 1 && Math.abs(g0 - 19) <= 1 && Math.abs(b0 - 23) <= 1) ||
          (r0 >= 254 && g0 >= 254 && b0 >= 254) ||
          (r0 <= 1 && g0 <= 1 && b0 <= 1) ||
          (Math.abs(r0 - bg[0]) <= 1 && Math.abs(g0 - bg[1]) <= 1 && Math.abs(b0 - bg[2]) <= 1 && !this.inPanel(x, y))
        ) {
          indexed[pIdx] = this.nearest(r0, g0, b0);
          continue;
        }

        const eIdx = (x + 1) * 3;
        const er = Math.max(-28, Math.min(28, curErr[eIdx]));
        const eg = Math.max(-28, Math.min(28, curErr[eIdx + 1]));
        const eb = Math.max(-28, Math.min(28, curErr[eIdx + 2]));

        const rr = Math.max(0, Math.min(255, r0 + er));
        const gg = Math.max(0, Math.min(255, g0 + eg));
        const bb = Math.max(0, Math.min(255, b0 + eb));

        const chosen = this.nearest(rr, gg, bb);
        indexed[pIdx] = chosen;
        const cp = this.palette[chosen];

        const dr = (rr - cp[0]) * 0.82;
        const dg = (gg - cp[1]) * 0.82;
        const db = (bb - cp[2]) * 0.82;

        // Serpentine Sierra-2-4A: 2/4 forward, 1/4 down-back, 1/4 down
        const fwd = (x + 1 + (serp ? -1 : 1)) * 3;
        const dBack = (x + 1 + (serp ? 1 : -1)) * 3;
        const down = eIdx;

        curErr[fwd] += dr * 0.5; curErr[fwd + 1] += dg * 0.5; curErr[fwd + 2] += db * 0.5;
        nxtErr[dBack] += dr * 0.25; nxtErr[dBack + 1] += dg * 0.25; nxtErr[dBack + 2] += db * 0.25;
        nxtErr[down] += dr * 0.25; nxtErr[down + 1] += dg * 0.25; nxtErr[down + 2] += db * 0.25;
      }
      const tmp = curErr; curErr = nxtErr; nxtErr = tmp;
    }

    this.gif.writeFrame(indexed, w, h, {
      palette: isFirst ? this.palette : undefined,
      delay: delayMs,
      repeat: isFirst ? 0 : undefined,
    });
  }

  finish(): Uint8Array {
    this.gif.finish();
    return this.gif.bytes();
  }
}
