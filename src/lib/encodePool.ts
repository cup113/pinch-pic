import type { CompressParams, ImageMeta } from './types';
import type { PoolRequest, PoolResponse } from './worker/protocol';

interface Task {
  request: PoolRequest;
  resolve: (output: EncodeOutput) => void;
  reject: (error: Error) => void;
}

export interface EncodeOutput {
  blob: Blob;
  meta: ImageMeta;
}

export class EncodePool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Task[] = [];
  private tasks = new Map<number, Task>();
  private nextId = 1;

  constructor(size = defaultPoolSize()) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./worker/encode.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<PoolResponse>) => this.handle(worker, event.data);
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  submit(jobId: string, file: File, params: CompressParams): Promise<EncodeOutput> {
    const request: PoolRequest = { type: 'encode', jobId, requestId: this.nextId++, file, params };
    return new Promise<EncodeOutput>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.drain();
    });
  }

  destroy(): void {
    for (const worker of this.workers) worker.terminate();
  }

  private drain(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const task = this.queue.shift()!;
      const worker = this.idle.pop()!;
      this.tasks.set(task.request.requestId, task);
      worker.postMessage(task.request);
    }
  }

  private handle(worker: Worker, message: PoolResponse): void {
    const task = this.tasks.get(message.requestId);
    if (task) {
      this.tasks.delete(message.requestId);
      if (message.type === 'encoded') task.resolve({ blob: message.blob, meta: message.meta });
      else task.reject(new Error(message.message));
    }
    if (!this.idle.includes(worker)) {
      this.idle.push(worker);
      this.drain();
    }
  }
}

function defaultPoolSize(): number {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(4, cores - 1));
}
