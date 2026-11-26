export function buildStudioPalette256(samples: number[][]): number[][] {
  const pinned: number[][] = [
    [18, 19, 23], [255, 255, 255], [248, 249, 250], [241, 243, 244],
  ];
  for (let i = 0; i < 32; i++) {
    const v = i < 22 ? 22 + i * 5 : 135 + (i - 22) * 12;
    pinned.push([v, v + (i < 20 ? 1 : 0), Math.min(255, v + 3)]);
  }
  const cents = pinned.map((c) => [c[0], c[1], c[2]]);
  if (!samples.length) {
    while (cents.length < 256) cents.push([128, 128, 128]);
    return cents;
  }
  const minD = new Float32Array(samples.length).fill(1e9);
  const upd = (c: number[]) => {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const d = (s[0]-c[0])**2 + (s[1]-c[1])**2 + (s[2]-c[2])**2;
      if (d < minD[i]) minD[i] = d;
    }
  };
  for (const p of cents) upd(p);
  while (cents.length < 256) {
    let sum = 0, pick = 0;
    for (let i = 0; i < minD.length; i++) sum += minD[i];
    if (sum <= 1) { cents.push([128, 128, 128]); continue; }
    let r = ((cents.length * 0.618034) % 1) * sum;
    for (let i = 0; i < minD.length; i++) {
      if ((r -= minD[i]) <= 0) { pick = i; break; }
    }
    const c = [...samples[pick]];
    cents.push(c); upd(c);
  }
  const pLen = pinned.length, sums = new Float64Array(1024);
  for (let it = 0; it < 8; it++) {
    sums.fill(0);
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let bi = 0, bd = 1e9;
      for (let c = 0; c < 256; c++) {
        const p = cents[c];
        const d = (s[0]-p[0])**2 + (s[1]-p[1])**2 + (s[2]-p[2])**2;
        if (d < bd) { bd = d; bi = c; }
      }
      const o = bi * 4;
      sums[o]+=s[0]; sums[o+1]+=s[1]; sums[o+2]+=s[2]; sums[o+3]+=1;
    }
    for (let c = pLen; c < 256; c++) {
      const n = sums[c * 4 + 3];
      if (n > 0) {
        cents[c] = [sums[c*4]/n, sums[c*4+1]/n, sums[c*4+2]/n];
      }
    }
  }
  return cents.map((c) => c.map((v) => Math.max(0, Math.min(255, Math.round(v)))));
}
export function findPair(pal: number[][], r: number, g: number, b: number): number {
  let c1 = 0, d1 = 1e9;
  for (let i = 0; i < 256; i++) {
    const p = pal[i];
    const d = (r-p[0])**2 + (g-p[1])**2 + (b-p[2])**2;
    if (d < d1) { d1 = d; c1 = i; }
  }
  const A = pal[c1];
  let c2 = c1, best = d1;
  for (let i = 0; i < 256; i++) {
    if (i === c1) continue;
    const B = pal[i];
    const dx = B[0]-A[0], dy = B[1]-A[1], dz = B[2]-A[2];
    const l2 = dx*dx + dy*dy + dz*dz;
    if (l2 < 4) continue;
    const t = Math.max(0, Math.min(1, ((r-A[0])*dx + (g-A[1])*dy + (b-A[2])*dz) / l2));
    const er = (r-(A[0]+dx*t))**2 + (g-(A[1]+dy*t))**2 + (b-(A[2]+dz*t))**2 + l2*0.04;
    if (er < best) { best = er; c2 = i; }
  }
  return c1 | (c2 << 8);
}
export function ditherFrameIgn(
  rgba: Uint8ClampedArray, w: number, h: number, pal: number[][], lut: Int32Array
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x, p = idx * 4;
      const r = rgba[p], g = rgba[p+1], b = rgba[p+2];
      const cell = ((r>>3)<<10) | ((g>>3)<<5) | (b>>3);
      let pk = lut[cell];
      if (pk < 0) pk = lut[cell] = findPair(pal, (r&248)+4, (g&248)+4, (b&248)+4);
      const i1 = pk & 255, i2 = (pk >> 8) & 255;
      const A = pal[i1], B = pal[i2];
      const dx = B[0]-A[0], dy = B[1]-A[1], dz = B[2]-A[2];
      const l2 = dx*dx + dy*dy + dz*dz;
      if (l2 < 4 || (r-A[0])**2+(g-A[1])**2+(b-A[2])**2 <= 3) { out[idx] = i1; continue; }
      const t = ((r-A[0])*dx + (g-A[1])*dy + (b-A[2])*dz) / l2;
      const ign = (52.982919 * ((0.06711056*x + 0.00583715*y) % 1)) % 1;
      out[idx] = t > ign ? i2 : i1;
    }
  }
  return out;
}
