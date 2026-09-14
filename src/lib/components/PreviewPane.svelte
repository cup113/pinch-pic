<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { decodeToBitmap, planResize } from '../pipeline';
  import { PreviewSession } from '../previewSession';
  import { FORMAT_LABELS, type CompressParams, type CropRect, type ImageJob } from '../types';

  let { job }: { job: ImageJob | null } = $props();

  let viewW = $state(0);
  let viewH = $state(0);
  let zoom = $state(1);
  let originX = $state(0);
  let originY = $state(0);

  let src = $state<ImageBitmap | null>(null);
  let srcMeta = $state<{ width: number; height: number } | null>(null);
  let preview = $state<{ bitmap: ImageBitmap; rect: CropRect } | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let needsFit = $state(false);

  let canvasL = $state<HTMLCanvasElement | undefined>();
  let canvasR = $state<HTMLCanvasElement | undefined>();

  const session = new PreviewSession();
  let loadedJobId: string | null = null;

  const plan = $derived(srcMeta && job ? planResize(srcMeta, job.params.maxEdge) : null);
  const outW = $derived(plan?.outW ?? 0);
  const outH = $derived(plan?.outH ?? 0);
  const outScale = $derived(plan?.scale ?? 1);

  onMount(() => {
    session.onSource = (_jobId, meta) => {
      srcMeta = { width: meta.width, height: meta.height };
    };
    session.onPreview = (bitmap, rect) => {
      preview = { bitmap, rect };
      error = null;
    };
    session.onError = (message) => {
      error = message;
    };
    return () => session.destroy();
  });

  onDestroy(() => {
    src?.close();
  });

  $effect(() => {
    const current = job;
    if (!current) {
      loadedJobId = null;
      return;
    }
    if (loadedJobId === current.id) return;
    loadedJobId = current.id;
    void loadSource(current);
  });

  $effect(() => {
    if (needsFit && srcMeta && viewW > 0 && viewH > 0) {
      fit();
      needsFit = false;
    }
  });

  $effect(() => {
    const current = job;
    if (!current || !srcMeta || viewW < 1 || viewH < 1) return;
    session.request($state.snapshot(current.params) as CompressParams, visibleRect());
  });

  $effect(() => {
    draw();
  });

  async function loadSource(current: ImageJob): Promise<void> {
    const id = current.id;
    error = null;
    loading = true;
    preview = null;
    session.select(id, current.file);
    try {
      const bitmap = await decodeToBitmap(current.file);
      if (loadedJobId !== id) {
        bitmap.close();
        return;
      }
      src?.close();
      src = bitmap;
      srcMeta = { width: bitmap.width, height: bitmap.height };
      needsFit = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function fit(): void {
    if (!srcMeta) return;
    const current = planResize(srcMeta, job?.params.maxEdge ?? null);
    const z = Math.min(viewW / current.outW, viewH / current.outH, 1);
    zoom = clampZoom(z);
    originX = (current.outW - viewW / zoom) / 2;
    originY = (current.outH - viewH / zoom) / 2;
  }

  function visibleRect(): CropRect {
    const visW = viewW / zoom;
    const visH = viewH / zoom;
    const x = Math.max(0, originX);
    const y = Math.max(0, originY);
    const right = Math.min(outW, originX + visW);
    const bottom = Math.min(outH, originY + visH);
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  }

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    drawPane(canvasL, dpr, (ctx) => {
      if (!src || !srcMeta) return;
      const visW = viewW / zoom;
      const visH = viewH / zoom;
      const left = Math.max(0, originX);
      const top = Math.max(0, originY);
      const right = Math.min(outW, originX + visW);
      const bottom = Math.min(outH, originY + visH);
      const w = right - left;
      const h = bottom - top;
      if (w <= 0 || h <= 0) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        src,
        left / outScale,
        top / outScale,
        w / outScale,
        h / outScale,
        (left - originX) * zoom,
        (top - originY) * zoom,
        w * zoom,
        h * zoom,
      );
    });
    drawPane(canvasR, dpr, (ctx) => {
      if (!preview) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        preview.bitmap,
        (preview.rect.x - originX) * zoom,
        (preview.rect.y - originY) * zoom,
        preview.rect.width * zoom,
        preview.rect.height * zoom,
      );
    });
  }

  function drawPane(
    canvas: HTMLCanvasElement | undefined,
    dpr: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    if (!canvas || viewW < 1 || viewH < 1) return;
    const pxW = Math.round(viewW * dpr);
    const pxH = Math.round(viewH * dpr);
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    paint(ctx);
  }

  function clampZoom(value: number): number {
    return Math.min(8, Math.max(0.02, value));
  }

  function clampOrigin(value: number, outSize: number, visSize: number): number {
    const bound = outSize - visSize;
    return Math.min(Math.max(value, Math.min(0, bound)), Math.max(0, bound));
  }

  function clampOrigins(): void {
    originX = clampOrigin(originX, outW, viewW / zoom);
    originY = clampOrigin(originY, outH, viewH / zoom);
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onPointerDown(event: PointerEvent) {
    if (!srcMeta) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    originX = clampOrigin(originX - (event.clientX - lastX) / zoom, outW, viewW / zoom);
    originY = clampOrigin(originY - (event.clientY - lastY) / zoom, outH, viewH / zoom);
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerUp(event: PointerEvent) {
    dragging = false;
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onWheel(event: WheelEvent) {
    if (!srcMeta || !(event.currentTarget instanceof HTMLElement)) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    const next = clampZoom(zoom * Math.exp(-event.deltaY * 0.0015));
    if (next === zoom) return;
    const outX = originX + px / zoom;
    const outY = originY + py / zoom;
    zoom = next;
    originX = outX - px / zoom;
    originY = outY - py / zoom;
    clampOrigins();
  }

  function zoomToOne() {
    zoom = 1;
    clampOrigins();
  }
</script>

<div class="relative flex h-full min-h-0 flex-col bg-ink-100">
  <header class="flex items-center justify-between gap-2 border-b border-ink-200 bg-white px-4 py-2">
    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold text-ink-800">细节预览</span>
      {#if loading}
        <span class="text-xs text-ink-400">解码中…</span>
      {/if}
      {#if error}
        <span class="text-xs text-red-500">{error}</span>
      {/if}
    </div>
    <div class="flex items-center gap-1">
      <span class="px-1 text-xs tabular-nums text-ink-500">{Math.round(zoom * 100)}%</span>
      <button type="button" onclick={fit} class="rounded-md border border-ink-200 px-2 py-0.5 text-xs text-ink-600 hover:border-brand-500 hover:text-brand-600">适应</button>
      <button type="button" onclick={zoomToOne} class="rounded-md border border-ink-200 px-2 py-0.5 text-xs text-ink-600 hover:border-brand-500 hover:text-brand-600">1:1</button>
    </div>
  </header>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid min-h-0 flex-1 grid-cols-2 gap-px overflow-hidden bg-ink-200"
    bind:clientWidth={viewW}
    bind:clientHeight={viewH}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <div class="checkerboard relative overflow-hidden">
      <canvas bind:this={canvasL} class="block h-full w-full"></canvas>
      <span class="pointer-events-none absolute left-2 top-2 rounded bg-ink-900/70 px-1.5 py-0.5 text-[10px] text-white">原图</span>
    </div>
    <div class="checkerboard relative overflow-hidden" onwheel={onWheel}>
      <canvas bind:this={canvasR} class="block h-full w-full"></canvas>
      <span class="pointer-events-none absolute left-2 top-2 rounded bg-brand-500/80 px-1.5 py-0.5 text-[10px] text-white">
        {#if job}{FORMAT_LABELS[job.params.format]}{/if}
      </span>
    </div>
  </div>

  {#if !job}
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-100/80">
      <p class="text-xs text-ink-400">选择一张图片查看细节预览</p>
    </div>
  {/if}

  <footer class="border-t border-ink-200 bg-white px-4 py-1.5 text-[11px] text-ink-400">
    滚轮缩放 · 拖拽平移 · 右侧为同参数管线的裁剪预览，视觉上与产物一致
  </footer>
</div>
