import { zip } from 'fflate';
import { FORMAT_EXTENSIONS, type ImageJob } from './types';

export function artifactName(job: ImageJob): string {
  return `${job.name}.${FORMAT_EXTENSIONS[job.params.format]}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function buildZip(jobs: ImageJob[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();

  for (const job of jobs) {
    if (!job.artifact) continue;
    entries[uniqueName(artifactName(job), used)] = new Uint8Array(await job.artifact.arrayBuffer());
  }

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data)));
  });

  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  let index = 2;
  let candidate = `${stem}-${index}${ext}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${ext}`;
  }
  used.add(candidate);
  return candidate;
}
