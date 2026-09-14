import encodeJpeg, { init } from '@jsquash/jpeg/encode.js';
import type { EncodeOptions } from '@jsquash/jpeg/meta.js';
import mozjpegWasmUrl from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import type { CodecAdapter } from './adapter';

const adapter: CodecAdapter = {
  init: async () => {
    await init({ locateFile: () => mozjpegWasmUrl });
  },
  encode: (data, options) => encodeJpeg(data, options as Partial<EncodeOptions>),
};

export default adapter;
