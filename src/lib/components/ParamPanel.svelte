<script lang="ts">
  import { jobStore } from '../stores/jobs.svelte';
  import { FORMAT_LABELS, isLossy, type ImageJob, type OutputFormat } from '../types';

  let { job }: { job: ImageJob | null } = $props();

  const FORMATS: OutputFormat[] = ['jpeg', 'webp', 'avif', 'png'];

  function setFormat(format: OutputFormat) {
    if (!job) return;
    jobStore.setParams(job.id, { format, keepExif: format === 'jpeg' ? job.params.keepExif : false });
  }

  function setQuality(quality: number) {
    if (!job) return;
    jobStore.setParams(job.id, { quality });
  }

  function setEffort(effort: number) {
    if (!job) return;
    jobStore.setParams(job.id, { effort });
  }

  function setMaxEdge(raw: string) {
    if (!job) return;
    const parsed = Number.parseInt(raw, 10);
    jobStore.setParams(job.id, { maxEdge: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  }

  function toggleExif(keep: boolean) {
    if (!job) return;
    jobStore.setParams(job.id, { keepExif: keep });
  }

  function applyToAll() {
    if (!job) return;
    jobStore.applyAll(job.params);
  }
</script>

<aside class="flex h-full flex-col gap-5 overflow-y-auto border-l border-ink-200 bg-white p-4">
  <div>
    <h2 class="text-sm font-semibold text-ink-900">参数</h2>
    <p class="mt-1 text-xs text-ink-500">
      {#if job}
        编辑「{job.name}」这一张的参数，其他作业不受影响。
      {:else}
        选择左侧的一张图片后调整参数。
      {/if}
    </p>
  </div>

  {#if job}
    <div class="space-y-2">
      <span class="text-xs font-medium text-ink-600">格式</span>
      <div class="grid grid-cols-4 gap-1 rounded-lg bg-ink-100 p-1">
        {#each FORMATS as format (format)}
          <button
            type="button"
            class="rounded-md px-2 py-1.5 text-xs font-medium transition
              {job.params.format === format
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-ink-500 hover:text-ink-800'}"
            onclick={() => setFormat(format)}
          >
            {FORMAT_LABELS[format]}
          </button>
        {/each}
      </div>
    </div>

    {#if isLossy(job.params.format)}
      <div class="space-y-2">
        <div class="flex items-baseline justify-between">
          <span class="text-xs font-medium text-ink-600">质量</span>
          <span class="text-xs tabular-nums text-ink-500">{job.params.quality}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={job.params.quality}
          oninput={(event) => setQuality(Number(event.currentTarget.value))}
          class="w-full accent-brand-500"
        />
      </div>
    {:else}
      <div class="space-y-2">
        <div class="flex items-baseline justify-between">
          <span class="text-xs font-medium text-ink-600">优化力度</span>
          <span class="text-xs tabular-nums text-ink-500">{job.params.effort}</span>
        </div>
        <input
          type="range"
          min="1"
          max="6"
          value={job.params.effort}
          oninput={(event) => setEffort(Number(event.currentTarget.value))}
          class="w-full accent-brand-500"
        />
        <p class="text-xs text-ink-400">PNG 为无损，只优化体积，不损失画质。</p>
      </div>
    {/if}

    <div class="space-y-2">
      <div class="flex items-baseline justify-between">
        <span class="text-xs font-medium text-ink-600">长边像素</span>
        {#if job.params.maxEdge === null}
          <span class="text-xs text-ink-400">原尺寸</span>
        {/if}
      </div>
      <input
        type="number"
        min="1"
        step="1"
        placeholder="原尺寸"
        value={job.params.maxEdge ?? ''}
        oninput={(event) => setMaxEdge(event.currentTarget.value)}
        class="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm tabular-nums outline-none focus:border-brand-500"
      />
      <p class="text-xs text-ink-400">只缩不放，最长边缩到此值，等比不留白。</p>
    </div>

    {#if job.params.format === 'jpeg'}
      <label class="flex items-start gap-2 rounded-lg bg-ink-50 p-3">
        <input
          type="checkbox"
          checked={job.params.keepExif}
          onchange={(event) => toggleExif(event.currentTarget.checked)}
          class="mt-0.5 accent-brand-500"
        />
        <span class="text-xs text-ink-600">
          保留 EXIF 元数据（含 GPS、拍摄参数）
          <span class="mt-0.5 block text-ink-400">仅 JPEG 输出支持；不勾选则全部抹除，方向已烘进像素。</span>
        </span>
      </label>
    {:else}
      <p class="rounded-lg bg-ink-50 p-3 text-xs text-ink-400">
        默认已抹除全部元数据（含 GPS）；保留 EXIF 仅 JPEG 输出支持。
      </p>
    {/if}

    <button
      type="button"
      onclick={applyToAll}
      class="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
    >
      应用到全部作业
    </button>
  {:else}
    <p class="text-xs text-ink-400">—</p>
  {/if}
</aside>
