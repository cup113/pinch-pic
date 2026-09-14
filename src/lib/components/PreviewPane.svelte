<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { artifactName, downloadBlob } from '../download';
  import { formatBytes, savingsLabel, savingsTone, savingsPercent } from '../format';
  import { decodeToBitmap, planResize } from '../pipeline';
  import { PreviewSession } from '../previewSession';
  import { jobStore } from '../stores/jobs.svelte';
  import ParamsEditor from './ParamsEditor.svelte';
  import { FORMAT_LABELS, type CompressParams, type CropRect, type ImageJob, type ImageSize } from '../types';

  let { job }: { job: ImageJob | null } = $props();

  let viewW = $state(0);
  let viewH = $state(0);
  let zoom = $state(1);
  let originX = $state(0);
  let originY = $state(0);
  let dividerFrac = $state(0.5);
  let nearDivider = $state(false);
  let mode = $state<'none' | 'pan' | 'divider' | 'pinch'>('none');

  let src = $state<ImageBitmap | null>(null);
  let srcMeta = $state<ImageSize | null>(null);
  let preview = $state<{ bitmap: ImageBitmap; rect: CropRect } | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);

  let canvas = $state<HTMLCanvasElement | undefined>();
  let stage = $state<HTMLDivElement | undefined>();

  const session = new PreviewSession();
  let loadedJobId: string | null = null;
  let srcJobId: string | null = null;
  let lastOutW = 0;
  let lastOutH = 0;

  const plan = $derived(srcMeta && job ? planResize(srcMeta, job.params.maxEdge) : null);
  const outW = $derived(plan?.outW ?? 0);
  const outH = $derived(plan?.outH ?? 0);
  const outScale = $derived(plan?.scale ?? 1);
  const cursor = $derived(
    mode === 'pan' ? 'cursor-grabbing' : nearDivider ? 'cursor-col-resize' : 'cursor-grab',
  );

  onMount(() => {
    session.onSource = (jobId, meta) => {
      srcMeta = { width: meta.width, height: meta.height };
      jobStore.setSourceDims(jobId, meta.sourceWidth, meta.sourceHeight);
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
    const current = job;
    if (!current || !srcMeta || viewW < 1 || viewH < 1) return;
    if (srcJobId !== current.id) return;
    const w = outW;
    const h = outH;
    if (w < 1 || h < 1) return;

    if (lastOutW < 1) {
      lastOutW = w;
      lastOutH = h;
      fit();
      return;
    }

    if (w === lastOutW && h === lastOutH) return;

    const grow = w / lastOutW;
    zoom = clampZoom(zoom / grow);
    originX *= grow;
    originY *= grow;
    lastOutW = w;
    lastOutH = h;
    clampOrigins();
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
    lastOutW = 0;
    lastOutH = 0;
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
      srcJobId = id;
      jobStore.setSourceDims(id, bitmap.width, bitmap.height);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function fit(): void {
    if (!srcMeta) return;
    const current = planResize(srcMeta, job?.params.maxEdge ?? null);
    const z = Math.min(viewW / current.outW, viewH / current.outH);
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
    const el = canvas;
    if (!el || viewW < 1 || viewH < 1) return;

    const dpr = window.devicePixelRatio || 1;
    const pxW = Math.round(viewW * dpr);
    const pxH = Math.round(viewH * dpr);
    if (el.width !== pxW) el.width = pxW;
    if (el.height !== pxH) el.height = pxH;

    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);

    drawSource(ctx);

    const dividerX = dividerFrac * viewW;
    if (preview) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(dividerX, 0, viewW - dividerX, viewH);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        preview.bitmap,
        (preview.rect.x - originX) * zoom,
        (preview.rect.y - originY) * zoom,
        preview.rect.width * zoom,
        preview.rect.height * zoom,
      );
      ctx.restore();
    }

    drawDivider(ctx, dividerX);
  }

  function drawSource(ctx: CanvasRenderingContext2D): void {
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
  }

  function drawDivider(ctx: CanvasRenderingContext2D, x: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x - 1, 0, 2, viewH);
    ctx.fillStyle = 'rgba(17,24,39,0.18)';
    ctx.fillRect(x + 1, 0, 1, viewH);

    const cy = viewH / 2;
    ctx.beginPath();
    ctx.arc(x, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(17,24,39,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(55,65,81,0.85)';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + dir * 8, cy);
      ctx.lineTo(x + dir * 3, cy - 4);
      ctx.lineTo(x + dir * 3, cy + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
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

  function panBy(dx: number, dy: number): void {
    originX = clampOrigin(originX + dx, outW, viewW / zoom);
    originY = clampOrigin(originY + dy, outH, viewH / zoom);
  }

  function zoomAbout(px: number, py: number, next: number): void {
    const value = clampZoom(next);
    if (value === zoom) return;
    const outX = originX + px / zoom;
    const outY = originY + py / zoom;
    zoom = value;
    originX = outX - px / zoom;
    originY = outY - py / zoom;
    clampOrigins();
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let lastX = 0;
  let lastY = 0;
  let lastDist = 0;
  let lastMidX = 0;
  let lastMidY = 0;

  function toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = stage?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }

  function capture(pointerId: number, on: boolean): void {
    if (!stage) return;
    try {
      if (on) stage.setPointerCapture(pointerId);
      else if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
    } catch {
      /* pointer already released */
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (!srcMeta || !stage) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capture(event.pointerId, true);

    if (pointers.size === 1) {
      const dividerX = dividerFrac * viewW;
      if (Math.abs(toLocal(event.clientX, event.clientY).x - dividerX) <= 16) {
        mode = 'divider';
      } else {
        mode = 'pan';
        lastX = event.clientX;
        lastY = event.clientY;
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      mode = 'pinch';
      lastDist = Math.hypot(b.x - a.x, b.y - a.y);
      lastMidX = (a.x + b.x) / 2;
      lastMidY = (a.y + b.y) / 2;
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) {
      if (srcMeta) nearDivider = Math.abs(toLocal(event.clientX, event.clientY).x - dividerFrac * viewW) <= 16;
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const local = toLocal(midX, midY);
      if (lastDist > 0) {
        zoomAbout(local.x, local.y, zoom * (dist / lastDist));
        panBy(-(midX - lastMidX) / zoom, -(midY - lastMidY) / zoom);
      }
      lastDist = dist;
      lastMidX = midX;
      lastMidY = midY;
      return;
    }

    if (mode === 'divider') {
      dividerFrac = Math.min(1, Math.max(0, toLocal(event.clientX, event.clientY).x / Math.max(1, viewW)));
      return;
    }

    if (mode === 'pan') {
      panBy(-(event.clientX - lastX) / zoom, -(event.clientY - lastY) / zoom);
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }

  function onPointerUp(event: PointerEvent) {
    pointers.delete(event.pointerId);
    capture(event.pointerId, false);
    if (pointers.size === 0) {
      mode = 'none';
    } else if (pointers.size === 1) {
      const [only] = [...pointers.values()];
      lastX = only.x;
      lastY = only.y;
      mode = 'pan';
    }
  }

  function onWheel(event: WheelEvent) {
    if (!srcMeta) return;
    event.preventDefault();
    const local = toLocal(event.clientX, event.clientY);
    zoomAbout(local.x, local.y, zoom * Math.exp(-event.deltaY * 0.0015));
  }

  function zoomToOne() {
    zoom = 1;
    clampOrigins();
  }

  function resetDivider() {
    dividerFrac = 0.5;
  }

  function download() {
    if (job?.artifact) downloadBlob(job.artifact, artifactName(job));
  }
</script>

<div class="relative flex h-full min-h-0 flex-col bg-ink-100">
  <header class="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-white px-3 py-2 sm:px-4">
    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold text-ink-800">细节预览</span>
      {#if loading}
        <span class="text-xs text-ink-400">解码中…</span>
      {/if}
      {#if error}
        <span class="text-xs text-red-500">{error}</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if job && job.artifactSize !== null}
        {@const savings = savingsPercent(job.file.size, job.artifactSize)}
        <span class="text-xs tabular-nums text-ink-500">
          {formatBytes(job.artifactSize)}
          <span class={savingsTone(savings)}>{savingsLabel(savings)}</span>
        </span>
      {:else if job}
        <span class="text-xs text-ink-400">压缩中…</span>
      {/if}
      <button
        type="button"
        onclick={download}
        disabled={!job?.artifact}
        class="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        下载
      </button>
    </div>
  </header>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={stage}
    bind:clientWidth={viewW}
    bind:clientHeight={viewH}
    class="checkerboard relative min-h-0 flex-1 touch-none overflow-hidden {cursor}"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onpointerleave={() => (nearDivider = false)}
    onwheel={onWheel}
  >
    <canvas bind:this={canvas} class="block h-full w-full"></canvas>

    <span class="pointer-events-none absolute left-2 top-2 rounded bg-ink-900/70 px-1.5 py-0.5 text-[10px] text-white">原图</span>
    <span class="pointer-events-none absolute right-2 top-2 rounded bg-brand-500/80 px-1.5 py-0.5 text-[10px] text-white">
      {#if job}{FORMAT_LABELS[job.params.format]}{/if}
    </span>

    {#if !job}
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-100/80">
        <p class="text-xs text-ink-400">选择一张图片查看细节预览</p>
      </div>
    {/if}
  </div>

  {#if job}
    <div class="border-t border-ink-200 bg-white px-3 py-2 sm:px-4">
      <ParamsEditor {job} compact />
    </div>
  {/if}

  <footer class="flex items-center justify-end gap-2 border-t border-ink-200 bg-white px-3 py-1.5 sm:px-4">
    <div class="flex items-center gap-1">
      <span class="px-1 text-xs tabular-nums text-ink-500">{Math.round(zoom * 100)}%</span>
      <button type="button" onclick={fit} class="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-600 transition hover:border-brand-500 hover:text-brand-600">适应</button>
      <button type="button" onclick={zoomToOne} class="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-600 transition hover:border-brand-500 hover:text-brand-600">1:1</button>
      <button type="button" onclick={resetDivider} class="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-600 transition hover:border-brand-500 hover:text-brand-600">中线</button>
    </div>
  </footer>
</div>
