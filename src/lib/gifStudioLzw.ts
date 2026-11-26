export function encodeGif89aFrames(
  width: number,
  height: number,
  palette: number[][],
  frames: Uint8Array[],
  delayCs: number
): Blob {
  const chunks: Uint8Array[] = [];
  const head = new Uint8Array(13 + 768);
  head.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
  head[6] = width & 0xff;
  head[7] = (width >> 8) & 0xff;
  head[8] = height & 0xff;
  head[9] = (height >> 8) & 0xff;
  head[10] = 0xf7;
  head[11] = 0;
  head[12] = 0;
  for (let i = 0; i < 256; i++) {
    const c = palette[i] || [0, 0, 0];
    head[13 + i * 3] = c[0] & 0xff;
    head[13 + i * 3 + 1] = c[1] & 0xff;
    head[13 + i * 3 + 2] = c[2] & 0xff;
  }
  chunks.push(head);
  chunks.push(new Uint8Array([
    0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50,
    0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00,
  ]));
  const table = new Int32Array(4096 * 256);
  for (let f = 0; f < frames.length; f++) {
    const idx = frames[f];
    chunks.push(new Uint8Array([
      0x21, 0xf9, 0x04, 0x00, delayCs & 0xff, (delayCs >> 8) & 0xff, 0, 0,
      0x2c, 0, 0, 0, 0,
      width & 0xff, (width >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff,
      0x00, 0x08,
    ]));
    table.fill(-1);
    let nextCode = 258;
    let codeSize = 9;
    let bitBuf = 0;
    let bitCnt = 0;
    const out: number[] = [];
    const emit = (code: number) => {
      bitBuf |= code << bitCnt;
      bitCnt += codeSize;
      while (bitCnt >= 8) {
        out.push(bitBuf & 0xff);
        bitBuf >>= 8;
        bitCnt -= 8;
      }
    };
    emit(256);
    if (idx.length > 0) {
      let prefix = idx[0];
      for (let i = 1; i < idx.length; i++) {
        const k = idx[i];
        const key = (prefix << 8) | k;
        const hit = table[key];
        if (hit !== -1) {
          prefix = hit;
        } else {
          emit(prefix);
          if (nextCode < 4096) {
            table[key] = nextCode;
            if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
            nextCode++;
          } else {
            emit(256);
            table.fill(-1);
            nextCode = 258;
            codeSize = 9;
          }
          prefix = k;
        }
      }
      emit(prefix);
    }
    emit(257);
    if (bitCnt > 0) out.push(bitBuf & 0xff);
    let pos = 0;
    while (pos < out.length) {
      const len = Math.min(255, out.length - pos);
      const blk = new Uint8Array(1 + len);
      blk[0] = len;
      for (let j = 0; j < len; j++) blk[1 + j] = out[pos + j];
      chunks.push(blk);
      pos += len;
    }
    chunks.push(new Uint8Array([0]));
  }
  chunks.push(new Uint8Array([0x3b]));
  return new Blob(chunks as any, { type: "image/gif" });
}
