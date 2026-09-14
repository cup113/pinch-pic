import { EncodePool } from '../encodePool';
import { withPreservedExif } from '../exif';
import { DEFAULT_PARAMS, type CompressParams, type ImageJob } from '../types';

function normalizeParams(params: CompressParams): CompressParams {
  const format = params.format;
  return {
    format,
    quality: Math.min(100, Math.max(0, Math.round(params.quality))),
    effort: Math.min(6, Math.max(1, Math.round(params.effort))),
    maxEdge: params.maxEdge && params.maxEdge > 0 ? Math.round(params.maxEdge) : null,
    keepExif: format === 'jpeg' ? params.keepExif : false,
  };
}

function splitName(filename: string): { name: string; ext: string } {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return { name: filename, ext: '' };
  return { name: filename.slice(0, dot), ext: filename.slice(dot + 1).toLowerCase() };
}

class JobStore {
  jobs = $state<ImageJob[]>([]);
  selectedId = $state<string | null>(null);
  globalDefault = $state<CompressParams>({ ...DEFAULT_PARAMS });

  selected = $derived(this.jobs.find((job) => job.id === this.selectedId) ?? null);
  doneJobs = $derived(this.jobs.filter((job) => job.status === 'done' && job.artifact !== null));
  busy = $derived(this.jobs.some((job) => job.status === 'queued' || job.status === 'encoding'));
  totalOriginal = $derived(this.jobs.reduce((sum, job) => sum + job.file.size, 0));
  totalArtifact = $derived(this.doneJobs.reduce((sum, job) => sum + (job.artifactSize ?? 0), 0));

  #pool: EncodePool | null = null;
  #generations = new Map<string, number>();

  addFiles(files: File[]): void {
    const added: ImageJob[] = [];
    for (const file of files) {
      const { name, ext } = splitName(file.name);
      this.jobs.push({
        id: crypto.randomUUID(),
        file,
        name,
        ext,
        meta: null,
        source: null,
        params: { ...this.globalDefault },
        status: 'queued',
        artifact: null,
        artifactSize: null,
        error: null,
      });
      added.push(this.jobs[this.jobs.length - 1]);
    }
    if (!this.selectedId && added.length > 0) this.selectedId = added[0].id;
    for (const job of added) this.#schedule(job);
  }

  select(jobId: string): void {
    this.selectedId = jobId;
  }

  setSourceDims(jobId: string, width: number, height: number): void {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) return;
    if (job.source && job.source.width === width && job.source.height === height) return;
    job.source = { width, height };
  }

  setParams(jobId: string, patch: Partial<CompressParams>): void {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) return;
    job.params = normalizeParams({ ...job.params, ...patch });
    this.#schedule(job);
  }

  applyAll(patch: Partial<CompressParams>): void {
    this.globalDefault = normalizeParams({ ...this.globalDefault, ...patch });
    for (const job of this.jobs) {
      job.params = normalizeParams({ ...job.params, ...patch });
      this.#schedule(job);
    }
  }

  remove(jobId: string): void {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) return;
    this.jobs.splice(index, 1);
    this.#generations.delete(jobId);
    if (this.selectedId === jobId) {
      this.selectedId = this.jobs[Math.min(index, this.jobs.length - 1)]?.id ?? null;
    }
  }

  clear(): void {
    this.jobs = [];
    this.selectedId = null;
    this.#generations.clear();
  }

  #getPool(): EncodePool {
    if (!this.#pool) this.#pool = new EncodePool();
    return this.#pool;
  }

  #schedule(job: ImageJob): void {
    const generation = (this.#generations.get(job.id) ?? 0) + 1;
    this.#generations.set(job.id, generation);
    job.status = 'encoding';
    job.error = null;
    job.artifact = null;
    job.artifactSize = null;
    void this.#run(job, generation);
  }

  async #run(job: ImageJob, generation: number): Promise<void> {
    try {
      const params = $state.snapshot(job.params) as CompressParams;
      const output = await this.#getPool().submit(job.id, job.file, params);
      if (this.#generations.get(job.id) !== generation) return;
      job.meta = output.meta;
      this.setSourceDims(job.id, output.meta.sourceWidth, output.meta.sourceHeight);

      const artifact =
        params.keepExif && params.format === 'jpeg'
          ? await withPreservedExif(job.file, output.blob)
          : output.blob;

      if (this.#generations.get(job.id) !== generation) return;
      job.artifact = artifact;
      job.artifactSize = artifact.size;
      job.status = 'done';
    } catch (error) {
      if (this.#generations.get(job.id) !== generation) return;
      job.error = error instanceof Error ? error.message : String(error);
      job.status = 'error';
    }
  }
}

export const jobStore = new JobStore();
