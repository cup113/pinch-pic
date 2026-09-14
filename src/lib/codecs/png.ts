import initPng, { optimise_raw } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import type { CodecAdapter } from './adapter';

let ready: Promise<void> | null = null;

const adapter: CodecAdapter = {
  init: () => {
    if (!ready) ready = initPng(oxipngWasmUrl).then(() => undefined);
    return ready;
  },
  async encode(data, options) {
    const level = typeof options.level === 'number' ? options.level : 2;
    const result = optimise_raw(data.data, data.width, data.height, level, false, false);
    return result.buffer as ArrayBuffer;
  },
};

export default adapter;
