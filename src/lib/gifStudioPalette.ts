const BAYER8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

export function buildPalette24(samples: number[][]): number[][] {
  const pal: number[][] = [[18, 19, 23], [255, 255, 255], [0, 0, 0]];
  for (let i = 1; i <= 17; i++) {
    const v = Math.round(24 + (i * 222) / 18);
    pal.push([v, v, Math.min(255, v + 1)]);
  }
  const need = 256 - pal.length;
  const map = new Map<number, number[]>();
  for (let i = 0; i < samples.length; i++) {
    const r = samples[i][0], g = samples[i][1], b = samples[i][2];
    if (Math.abs(r - 18) <= 3 && Math.abs(g - 19) <= 3 && Math.abs(b - 23) <= 3) continue;
    if (r >= 252 && g >= 252 && b >= 252) continue;
    const key = ((r >> 1) << 14) | ((g >> 1) << 7) | (b >> 1);
    const cur = map.get(key);
    if (cur) cur[3]++;
    else map.set(key, [r, g, b, 1]);
  }
  const all = Array.from(map.values());
  if (all.length === 0) {
    while (pal.length < 256) pal.push([128, 128, 128]);
    return pal;
  }
  all.sort((a, b) => b[3] - a[3]);
  const pts = all.slice(0, 3500);
  const m = pts.length;
  const minD = new Float64Array(m).fill(1e12);
  const cents: number[][] = [];
  for (let k = 0; k < need; k++) {
    let pick = 0, bestS = -1;
    for (let i = 0; i < m; i++) {
      const sc = minD[i] * Math.sqrt(pts[i][3]);
      if (sc > bestS) { bestS = sc; pick = i; }
    }
    const c = [pts[pick][0], pts[pick][1], pts[pick][2]];
    cents.push(c);
    for (let i = 0; i < m; i++) {
      const dr = pts[i][0] - c[0], dg = pts[i][1] - c[1], db = pts[i][2] - c[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < minD[i]) minD[i] = d;
    }
  }
  const sums = new Float64Array(need * 3);
  const wts = new Float64Array(need);
  for (let it = 0; it < 5; it++) {
    sums.fill(0);
    wts.fill(0);
    for (let i = 0; i < m; i++) {
      const r = pts[i][0], g = pts[i][1], b = pts[i][2], w = pts[i][3];
      let best = 0, bd = 1e12;
      for (let k = 0; k < need; k++) {
        const dr = r - cents[k][0], dg = g - cents[k][1], db = b - cents[k][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = k; }
      }
      wts[best] += w;
      sums[best * 3] += r * w;
      sums[best * 3 + 1] += g * w;
      sums[best * 3 + 2] += b * w;
    }
    for (let k = 0; k < need; k++) {
      if (wts[k] > 0) {
        cents[k][0] = sums[k * 3] / wts[k];
        cents[k][1] = sums[k * 3 + 1] / wts[k];
        cents[k][2] = sums[k * 3 + 2] / wts[k];
      }
    }
  }
  for (let k = 0; k < need; k++) {
    pal.push([Math.round(cents[k][0]), Math.round(cents[k][1]), Math.round(cents[k][2])]);
  }
  return pal;
}

type Lut = { c1: Int16Array; c2: Int16Array; mix: Uint8Array };
const LUTS = new WeakMap<number[][], Lut>();
export function ditherFrameBlueNoise(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  pal: number[][]
): Uint8Array {
  let lut = LUTS.get(pal);
  if (!lut) {
    lut = { c1: new Int16Array(262144).fill(-1), c2: new Int16Array(262144), mix: new Uint8Array(262144) };
    LUTS.set(pal, lut);
  }
  const { c1, c2, mix } = lut;
  const out = new Uint8Array(w * h);
  const pLen = pal.length;
  for (let y = 0; y < h; y++) {
    const row = (y & 7) << 3;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p << 2;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (Math.abs(r - 18) <= 2 && Math.abs(g - 19) <= 2 && Math.abs(b - 23) <= 2) { out[p] = 0; continue; }
      if (r >= 253 && g >= 253 && b >= 253) { out[p] = 1; continue; }
      const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      if (c1[key] === -1) {
        let b1 = 0, b2 = 0, d1 = 1e12, d2 = 1e12;
        for (let k = 0; k < pLen; k++) {
          const dr = r - pal[k][0], dg = g - pal[k][1], db = b - pal[k][2];
          const d = dr * dr + dg * dg + db * db;
          if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = k; }
          else if (d < d2) { d2 = d; b2 = k; }
        }
        const vx = pal[b2][0] - pal[b1][0];
        const vy = pal[b2][1] - pal[b1][1];
        const vz = pal[b2][2] - pal[b1][2];
        const l2 = vx * vx + vy * vy + vz * vz;
        const dot = (r - pal[b1][0]) * vx + (g - pal[b1][1]) * vy + (b - pal[b1][2]) * vz;
        const t = l2 > 0 && l2 < 2400 ? Math.max(0, Math.min(1, dot / l2)) : 0;
        c1[key] = b1; c2[key] = b2; mix[key] = Math.round(t * 64);
      }
      out[p] = mix[key] > BAYER8[row | (x & 7)] ? c2[key] : c1[key];
    }
  }
  return out;
}
