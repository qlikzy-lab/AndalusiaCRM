// heic-convert ships without TypeScript types.
declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }
  function convert(options: ConvertOptions): Promise<ArrayBuffer>;
  export = convert;
}
