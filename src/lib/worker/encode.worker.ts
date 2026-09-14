import { encodeWith } from '../codecs';
import { bitmapToImageData, decodeToBitmap, planResize, resizeBitmap } from '../pipeline';
import { FORMAT_MIME } from '../types';
import { workerScope, type PoolRequest, type PoolResponse } from './protocol';

const scope = workerScope<PoolRequest, PoolResponse>();

scope.onmessage = async (event) => {
  const { jobId, requestId, file, params } = event.data;
  try {
    const source = await decodeToBitmap(file);
    const { outW, outH } = planResize(source, params.maxEdge);
    const scaled = await resizeBitmap(source, outW, outH);
    if (scaled !== source) source.close();

    const data = bitmapToImageData(scaled);
    scaled.close();

    const encoded = await encodeWith(params.format, data, params);
    const blob = new Blob([encoded], { type: FORMAT_MIME[params.format] });

    scope.postMessage({
      type: 'encoded',
      jobId,
      requestId,
      blob,
      meta: {
        width: outW,
        height: outH,
        size: file.size,
        type: file.type,
        firstFrameOnly: file.type === 'image/gif',
      },
    });
  } catch (err) {
    scope.postMessage({
      type: 'error',
      jobId,
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
