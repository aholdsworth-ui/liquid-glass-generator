export type GlassRect = { x0: number; y0: number; x1: number; y1: number };
const BIN_IDX = new Int32Array(262144);
const LUT_NEAR = new Int16Array(262144);

export function buildFramePalette24(
  rgba: Uint8ClampedArray, w: number, h: number, rects: GlassRect[]
): number[][] {
  const pal: number[][] = [[18, 19, 23], [255, 255, 255]];
  BIN_IDX.fill(-1);
  const sumR: number[] = [], sumG: number[] = [], sumB: number[] = [], wts: number[] = [];
  const addPx = (r: number, g: number, b: number, wt: number) => {
    if (Math.abs(r - 18) <= 2 && Math.abs(g - 19) <= 2 && Math.abs(b - 23) <= 2) return;
    if (r >= 253 && g >= 253 && b >= 253) return;
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let id = BIN_IDX[key];
    if (id === -1) {
      id = wts.length; BIN_IDX[key] = id;
      sumR.push(r * wt); sumG.push(g * wt); sumB.push(b * wt); wts.push(wt);
    } else {
      sumR[id] += r * wt; sumG[id] += g * wt; sumB[id] += b * wt; wts[id] += wt;
    }
  };
  const step = Math.max(2, Math.floor(Math.sqrt((w * h) / 22000)));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      let wt = 1;
      for (let r = 0; r < rects.length; r++) {
        const rc = rects[r];
        if (x >= rc.x0 && x <= rc.x1 && y >= rc.y0 && y <= rc.y1) { wt = 4; break; }
      }
      const i = (y * w + x) << 2;
      addPx(rgba[i], rgba[i + 1], rgba[i + 2], wt);
    }
  }
  const n = wts.length;
  if (n === 0) {
    while (pal.length < 256) pal.push([128, 128, 128]);
    return pal;
  }
  const bins = new Array<{ r: number; g: number; b: number; w: number }>(n);
  for (let i = 0; i < n; i++) {
    const iw = 1 / wts[i];
    bins[i] = { r: sumR[i] * iw, g: sumG[i] * iw, b: sumB[i] * iw, w: wts[i] };
  }
  if (n <= 254) {
    for (let i = 0; i < n; i++) {
      pal.push([Math.round(bins[i].r), Math.round(bins[i].g), Math.round(bins[i].b)]);
    }
    while (pal.length < 256) pal.push([0, 0, 0]);
    return pal;
  }
  type Box = { lo: number; hi: number; axis: 0 | 1 | 2; score: number; wSum: number };
  const calcBox = (lo: number, hi: number): Box => {
    let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0, ws = 0;
    for (let i = lo; i < hi; i++) {
      const c = bins[i]; ws += c.w;
      if (c.r < r0) r0 = c.r; if (c.r > r1) r1 = c.r;
      if (c.g < g0) g0 = c.g; if (c.g > g1) g1 = c.g;
      if (c.b < b0) b0 = c.b; if (c.b > b1) b1 = c.b;
    }
    const dr = (r1 - r0) * 1.4, dg = (g1 - g0) * 1.8, db = (b1 - b0) * 1.0;
    const axis: 0 | 1 | 2 = dg >= dr && dg >= db ? 1 : dr >= db ? 0 : 2;
    const span = Math.max(dr, dg, db);
    const score = hi - lo < 2 ? -1 : span * Math.pow(ws, 0.35);
    return { lo, hi, axis, score, wSum: ws };
  };
  const boxes: Box[] = [calcBox(0, n)];
  while (boxes.length < 254) {
    let bi = 0, bs = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].score > bs) { bs = boxes[i].score; bi = i; }
    }
    if (bs <= 0) break;
    const bx = boxes[bi];
    const sub = bins.slice(bx.lo, bx.hi);
    sub.sort((a, b) => (bx.axis === 0 ? a.r - b.r : bx.axis === 1 ? a.g - b.g : a.b - b.b));
    for (let i = 0; i < sub.length; i++) bins[bx.lo + i] = sub[i];
    let acc = 0, mid = bx.lo + 1;
    for (let i = bx.lo; i < bx.hi - 1; i++) {
      acc += bins[i].w;
      if (acc >= bx.wSum * 0.5) { mid = i + 1; break; }
    }
    boxes[bi] = calcBox(bx.lo, mid);
    boxes.push(calcBox(mid, bx.hi));
  }
  for (let i = 0; i < boxes.length; i++) {
    let sr = 0, sg = 0, sb = 0, sw = 0;
    for (let j = boxes[i].lo; j < boxes[i].hi; j++) {
      const c = bins[j]; sr += c.r * c.w; sg += c.g * c.w; sb += c.b * c.w; sw += c.w;
    }
    pal.push([Math.round(sr / sw), Math.round(sg / sw), Math.round(sb / sw)]);
  }
  while (pal.length < 256) pal.push([0, 0, 0]);
  return pal;
}
export function ditherFrameFloydSteinberg(
  rgba: Uint8ClampedArray, w: number, h: number, pal: number[][]
): Uint8Array {
  LUT_NEAR.fill(-1);
  const out = new Uint8Array(w * h);
  let cr = new Float32Array(w + 2), cg = new Float32Array(w + 2), cb = new Float32Array(w + 2);
  let nr = new Float32Array(w + 2), ng = new Float32Array(w + 2), nb = new Float32Array(w + 2);
  for (let y = 0; y < h; y++) {
    nr.fill(0); ng.fill(0); nb.fill(0);
    const rev = (y & 1) === 1;
    const dir = rev ? -1 : 1;
    for (let step = 0; step < w; step++) {
      const x = rev ? w - 1 - step : step;
      const xi = x + 1, p = y * w + x, i = p << 2;
      const r0 = rgba[i], g0 = rgba[i + 1], b0 = rgba[i + 2];
      if (Math.abs(r0 - 18) <= 1 && Math.abs(g0 - 19) <= 1 && Math.abs(b0 - 23) <= 1 && Math.abs(cr[xi]) < 2) { out[p] = 0; continue; }
      if (r0 >= 254 && g0 >= 254 && b0 >= 254 && Math.abs(cr[xi]) < 2) { out[p] = 1; continue; }
      const er0 = Math.max(-22, Math.min(22, cr[xi]));
      const eg0 = Math.max(-22, Math.min(22, cg[xi]));
      const eb0 = Math.max(-22, Math.min(22, cb[xi]));
      const tr = Math.max(0, Math.min(255, r0 + er0)) | 0;
      const tg = Math.max(0, Math.min(255, g0 + eg0)) | 0;
      const tb = Math.max(0, Math.min(255, b0 + eb0)) | 0;
      const key = ((tr >> 2) << 12) | ((tg >> 2) << 6) | (tb >> 2);
      let best = LUT_NEAR[key];
      if (best === -1) {
        let bd = 1e12; best = 0;
        for (let k = 0; k < 256; k++) {
          const dr = tr - pal[k][0], dg = tg - pal[k][1], db = tb - pal[k][2];
          const d = dr * dr * 2 + dg * dg * 4 + db * db;
          if (d < bd) { bd = d; best = k; }
        }
        LUT_NEAR[key] = best;
      }
      out[p] = best;
      const qr = (tr - pal[best][0]) * 0.85;
      const qg = (tg - pal[best][1]) * 0.85;
      const qb = (tb - pal[best][2]) * 0.85;
      cr[xi + dir] += qr * 0.4375; cg[xi + dir] += qg * 0.4375; cb[xi + dir] += qb * 0.4375;
      nr[xi - dir] += qr * 0.1875; ng[xi - dir] += qg * 0.1875; nb[xi - dir] += qb * 0.1875;
      nr[xi]       += qr * 0.3125; ng[xi]       += qg * 0.3125; nb[xi]       += qb * 0.3125;
      nr[xi + dir] += qr * 0.0625; ng[xi + dir] += qg * 0.0625; nb[xi + dir] += qb * 0.0625;
    }
    let tmp = cr; cr = nr; nr = tmp;
    tmp = cg; cg = ng; ng = tmp;
    tmp = cb; cb = nb; nb = tmp;
  }
  return out;
}
