import encodeWebp, { init } from '@jsquash/webp/encode.js';
import type { EncodeOptions } from '@jsquash/webp/meta.js';
import webpWasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import webpSimdWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
import type { CodecAdapter } from './adapter';

const adapter: CodecAdapter = {
  init: async () => {
    await init({
      locateFile: (path: string) => (path.includes('simd') ? webpSimdWasmUrl : webpWasmUrl),
    });
  },
  encode: (data, options) => encodeWebp(data, options as Partial<EncodeOptions>),
};

export default adapter;
