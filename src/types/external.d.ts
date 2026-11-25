declare module "gifuct-js" { export function parseGIF(b: ArrayBuffer): any; export function decompressFrames(g: any, p?: boolean): any[]; }
declare module "utif" { export function decode(b: ArrayBuffer): any[]; export function decodeImage(b: ArrayBuffer, i: any): void; export function toRGBA8(i: any): Uint8Array; }
declare module "gifenc" { export function GIFEncoder(o?: any): { writeFrame(idx: Uint8Array|number[], w: number, h: number, o?: any): void; finish(): void; bytes(): Uint8Array; }; }
