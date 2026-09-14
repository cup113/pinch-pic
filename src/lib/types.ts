export type OutputFormat = 'jpeg' | 'webp' | 'avif' | 'png';

export const LOSSY_FORMATS: readonly OutputFormat[] = ['jpeg', 'webp', 'avif'];

export function isLossy(format: OutputFormat): boolean {
  return LOSSY_FORMATS.includes(format);
}

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  jpeg: 'JPEG',
  webp: 'WebP',
  avif: 'AVIF',
  png: 'PNG',
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
  png: 'png',
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
};

export interface CompressParams {
  format: OutputFormat;
  quality: number;
  effort: number;
  maxEdge: number | null;
  keepExif: boolean;
}

export const DEFAULT_PARAMS: CompressParams = {
  format: 'webp',
  quality: 80,
  effort: 2,
  maxEdge: null,
  keepExif: false,
};

export interface ImageMeta {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  size: number;
  type: string;
  firstFrameOnly: boolean;
}

export interface ImageSize {
  width: number;
  height: number;
}

export type JobStatus = 'queued' | 'encoding' | 'done' | 'error';

export interface ImageJob {
  id: string;
  file: File;
  name: string;
  ext: string;
  meta: ImageMeta | null;
  source: ImageSize | null;
  params: CompressParams;
  status: JobStatus;
  artifact: Blob | null;
  artifactSize: number | null;
  error: string | null;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
