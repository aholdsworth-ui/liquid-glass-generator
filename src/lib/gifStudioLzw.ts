const LZW_TAB = new Int32Array(4096 * 256);

export class Gif89Writer {
  private chunks: Uint8Array[] = [];
  private w: number;
  private h: number;
  private hasHeader = false;
  public byteLength = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private push(arr: Uint8Array) {
    this.chunks.push(arr);
    this.byteLength += arr.length;
  }

  private writeHeader(pal0: number[][]) {
    const b = new Uint8Array(13 + 768 + 19);
    b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
    b[6] = this.w & 0xff; b[7] = (this.w >> 8) & 0xff;
    b[8] = this.h & 0xff; b[9] = (this.h >> 8) & 0xff;
    b[10] = 0xf7; b[11] = 0; b[12] = 0;
    for (let i = 0; i < 256; i++) {
      const c = pal0[i] || [0, 0, 0];
      b[13 + i * 3] = c[0]; b[14 + i * 3] = c[1]; b[15 + i * 3] = c[2];
    }
    b.set([
      0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50,
      0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00,
    ], 13 + 768);
    this.push(b);
    this.hasHeader = true;
  }

  addFrame(indices: Uint8Array, pal: number[][], delayCs: number) {
    if (!this.hasHeader) this.writeHeader(pal);
    const d = Math.max(2, Math.round(delayCs));
    const head = new Uint8Array(18 + 768);
    head.set([0x21, 0xf9, 0x04, 0x04, d & 0xff, (d >> 8) & 0xff, 0, 0], 0);
    head[8] = 0x2c;
    head[13] = this.w & 0xff; head[14] = (this.w >> 8) & 0xff;
    head[15] = this.h & 0xff; head[16] = (this.h >> 8) & 0xff;
    head[17] = 0x87;
    for (let i = 0; i < 256; i++) {
      const c = pal[i] || [0, 0, 0];
      head[18 + i * 3] = c[0]; head[19 + i * 3] = c[1]; head[20 + i * 3] = c[2];
    }
    this.push(head);
    this.push(lzwEncodeFrame(indices));
  }
  finish(): Blob {
    this.push(new Uint8Array([0x3b]));
    return new Blob(this.chunks as any, { type: "image/gif" });
  }
}

export function lzwEncodeFrame(indices: Uint8Array): Uint8Array {
  LZW_TAB.fill(-1);
  const out = new Uint8Array(indices.length + (indices.length >> 5) + 1024);
  let op = 0;
  out[op++] = 8;
  const sub = new Uint8Array(255);
  let sl = 0, bitBuf = 0, bitCnt = 0, codeSize = 9, nextCode = 258;
  const flushSub = () => {
    if (sl > 0) { out[op++] = sl; out.set(sub.subarray(0, sl), op); op += sl; sl = 0; }
  };
  const emit = (code: number) => {
    bitBuf |= code << bitCnt; bitCnt += codeSize;
    while (bitCnt >= 8) {
      sub[sl++] = bitBuf & 0xff; bitBuf >>= 8; bitCnt -= 8;
      if (sl === 255) flushSub();
    }
  };
  emit(256);
  if (indices.length > 0) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const hit = LZW_TAB[key];
      if (hit !== -1) {
        prefix = hit;
      } else {
        emit(prefix);
        if (nextCode < 4096) {
          if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
          LZW_TAB[key] = nextCode++;
        } else {
          emit(256); LZW_TAB.fill(-1); codeSize = 9; nextCode = 258;
        }
        prefix = k;
      }
    }
    emit(prefix);
    if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
  }
  emit(257);
  if (bitCnt > 0) { sub[sl++] = bitBuf & 0xff; }
  flushSub();
  out[op++] = 0;
  return out.slice(0, op);
}
