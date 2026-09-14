export interface CodecAdapter {
  init(): Promise<void>;
  encode(data: ImageData, options: Record<string, unknown>): Promise<ArrayBuffer>;
}
