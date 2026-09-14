import { encodeWith } from '../codecs';
import { cropToImageData, decodeToBitmap, planResize } from '../pipeline';
import { FORMAT_MIME } from '../types';
import { workerScope, type PreviewRequest, type PreviewResponse } from './protocol';

const scope = workerScope<PreviewRequest, PreviewResponse>();

let currentJobId: string | null = null;
let source: ImageBitmap | null = null;

scope.onmessage = async (event) => {
  const message = event.data;

  if (message.type === 'setSource') {
    try {
      source?.close();
      source = await decodeToBitmap(message.file);
      currentJobId = message.jobId;
      scope.postMessage({
        type: 'source',
        jobId: message.jobId,
        meta: {
          width: source.width,
          height: source.height,
          sourceWidth: source.width,
          sourceHeight: source.height,
          size: message.file.size,
          type: message.file.type,
          firstFrameOnly: message.file.type === 'image/gif',
        },
      });
    } catch (err) {
      scope.postMessage({
        type: 'error',
        jobId: message.jobId,
        requestId: 0,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  try {
    if (!source || message.jobId !== currentJobId) throw new Error('预览源尚未就绪');
    const { scale } = planResize(source, message.params.maxEdge);
    const crop = await cropToImageData(source, message.rect, scale);
    const encoded = await encodeWith(message.params.format, crop.data, message.params);
    const blob = new Blob([encoded], { type: FORMAT_MIME[message.params.format] });
    const bitmap = await createImageBitmap(blob);
    scope.postMessage(
      { type: 'preview', jobId: message.jobId, requestId: message.requestId, rect: crop.rect, bitmap },
      [bitmap],
    );
  } catch (err) {
    scope.postMessage({
      type: 'error',
      jobId: message.jobId,
      requestId: message.requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
