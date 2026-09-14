import encodeAvif, { init } from '@jsquash/avif/encode.js';
import type { EncodeOptions } from '@jsquash/avif/meta.js';
import avifWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import avifMtWasmUrl from '@jsquash/avif/codec/enc/avif_enc_mt.wasm?url';
import type { CodecAdapter } from './adapter';

const adapter: CodecAdapter = {
  init: async () => {
    await init({
      locateFile: (path: string) => (path.includes('_mt') ? avifMtWasmUrl : avifWasmUrl),
    });
  },
  encode: (data, options) =>
    encodeAvif(data, options as Partial<EncodeOptions> & { bitDepth?: 8 }),
};

export default adapter;
