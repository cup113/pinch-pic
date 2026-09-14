import type { CompressParams, CropRect, ImageMeta } from '../types';

export interface WorkerScope<Req, Res> {
  onmessage: ((event: MessageEvent<Req>) => void) | null;
  postMessage: (message: Res, transfer?: Transferable[]) => void;
}

export function workerScope<Req, Res>(): WorkerScope<Req, Res> {
  return self as unknown as WorkerScope<Req, Res>;
}

export interface PoolRequest {
  type: 'encode';
  jobId: string;
  requestId: number;
  file: File;
  params: CompressParams;
}

export type PoolResponse =
  | { type: 'encoded'; jobId: string; requestId: number; blob: Blob; meta: ImageMeta }
  | { type: 'error'; jobId: string; requestId: number; message: string };

export type PreviewRequest =
  | { type: 'setSource'; jobId: string; file: File }
  | { type: 'preview'; jobId: string; requestId: number; rect: CropRect; params: CompressParams };

export type PreviewResponse =
  | { type: 'source'; jobId: string; meta: ImageMeta }
  | { type: 'preview'; jobId: string; requestId: number; rect: CropRect; bitmap: ImageBitmap }
  | { type: 'error'; jobId: string; requestId: number; message: string };
