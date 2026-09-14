import piexif from 'piexifjs';

export async function withPreservedExif(original: File, encoded: Blob): Promise<Blob> {
  try {
    const originalDataUrl = await readAsDataUrl(original);
    const exif = piexif.load(originalDataUrl);
    if (exif['0th']) exif['0th'][piexif.ImageIFD.Orientation] = 1;
    const dumped = piexif.dump(exif);
    const encodedDataUrl = await readAsDataUrl(encoded);
    return dataUrlToBlob(piexif.insert(dumped, encodedDataUrl));
  } catch {
    return encoded;
  }
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /:(.*?);/.exec(header)?.[1] ?? 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
