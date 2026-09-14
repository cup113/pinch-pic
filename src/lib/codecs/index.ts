import type { CompressParams, OutputFormat } from '../types';
import type { CodecAdapter } from './adapter';
import jpeg from './jpeg';
import webp from './webp';
import avif from './avif';
import png from './png';

const adapters: Record<OutputFormat, CodecAdapter> = { jpeg, webp, avif, png };
const ready = new Map<OutputFormat, Promise<void>>();

async function adapterFor(format: OutputFormat): Promise<CodecAdapter> {
  let promise = ready.get(format);
  if (!promise) {
    promise = adapters[format].init();
    ready.set(format, promise);
  }
  await promise;
  return adapters[format];
}

function optionsFor(format: OutputFormat, params: CompressParams): Record<string, unknown> {
  switch (format) {
    case 'jpeg':
      return { quality: params.quality, progressive: true };
    case 'webp':
      return { quality: params.quality };
    case 'avif':
      return { quality: params.quality, speed: 6 };
    case 'png':
      return { level: params.effort };
  }
}

export async function encodeWith(
  format: OutputFormat,
  data: ImageData,
  params: CompressParams,
): Promise<ArrayBuffer> {
  const adapter = await adapterFor(format);
  return adapter.encode(data, optionsFor(format, params));
}
