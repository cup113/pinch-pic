import type { CropRect } from './types';

export interface ResizePlan {
  scale: number;
  outW: number;
  outH: number;
}

export async function decodeToBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

export function planResize(
  src: { width: number; height: number },
  maxEdge: number | null,
): ResizePlan {
  const longest = Math.max(src.width, src.height);
  const scale = maxEdge && maxEdge > 0 ? Math.min(1, maxEdge / longest) : 1;
  return {
    scale,
    outW: Math.max(1, Math.round(src.width * scale)),
    outH: Math.max(1, Math.round(src.height * scale)),
  };
}

export async function resizeBitmap(
  src: ImageBitmap,
  outW: number,
  outH: number,
): Promise<ImageBitmap> {
  if (src.width === outW && src.height === outH) return src;
  return await createImageBitmap(src, {
    resizeWidth: outW,
    resizeHeight: outH,
    resizeQuality: 'high',
  });
}

export function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

export interface CropResult {
  data: ImageData;
  rect: CropRect;
}

export async function cropToImageData(
  src: ImageBitmap,
  rect: CropRect,
  scale: number,
): Promise<CropResult> {
  const sx = rect.x / scale;
  const sy = rect.y / scale;
  const sw = rect.width / scale;
  const sh = rect.height / scale;

  const x = clamp(Math.floor(sx), 0, src.width - 1);
  const y = clamp(Math.floor(sy), 0, src.height - 1);
  const width = clamp(Math.round(sw), 1, src.width - x);
  const height = clamp(Math.round(sh), 1, src.height - y);

  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const crop =
    width === src.width && height === src.height
      ? await createImageBitmap(src)
      : await createImageBitmap(src, x, y, width, height, {
          resizeWidth: outW,
          resizeHeight: outH,
          resizeQuality: 'high',
        });

  try {
    return {
      data: bitmapToImageData(crop),
      rect: { x: x * scale, y: y * scale, width: width * scale, height: height * scale },
    };
  } finally {
    crop.close();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
