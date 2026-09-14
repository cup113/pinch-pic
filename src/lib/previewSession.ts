import type { CompressParams, CropRect, ImageMeta } from './types';
import type { PreviewRequest, PreviewResponse } from './worker/protocol';

export class PreviewSession {
  onPreview: ((bitmap: ImageBitmap, rect: CropRect) => void) | null = null;
  onSource: ((jobId: string, meta: ImageMeta) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  private worker: Worker;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;
  private latestId = 0;
  private jobId: string | null = null;
  private lastBitmap: ImageBitmap | null = null;

  constructor() {
    this.worker = new Worker(new URL('./worker/preview.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<PreviewResponse>) => this.handle(event.data);
  }

  select(jobId: string, file: File): void {
    this.jobId = jobId;
    this.latestId = 0;
    this.clearTimer();
    this.releaseBitmap();
    this.worker.postMessage({ type: 'setSource', jobId, file } satisfies PreviewRequest);
  }

  request(params: CompressParams, rect: CropRect): void {
    if (!this.jobId) return;
    const jobId = this.jobId;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.worker.postMessage({
        type: 'preview',
        jobId,
        requestId: this.nextId++,
        rect,
        params,
      } satisfies PreviewRequest);
    }, 150);
  }

  destroy(): void {
    this.clearTimer();
    this.releaseBitmap();
    this.worker.terminate();
  }

  private handle(message: PreviewResponse): void {
    if (message.type === 'source') {
      this.onSource?.(message.jobId, message.meta);
      return;
    }
    if (message.type === 'error') {
      this.onError?.(message.message);
      return;
    }
    if (message.requestId < this.latestId) {
      message.bitmap.close();
      return;
    }
    this.latestId = message.requestId;
    const previous = this.lastBitmap;
    this.lastBitmap = message.bitmap;
    this.onPreview?.(message.bitmap, message.rect);
    previous?.close();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private releaseBitmap(): void {
    this.lastBitmap?.close();
    this.lastBitmap = null;
  }
}
