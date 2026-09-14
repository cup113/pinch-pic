<script lang="ts">
  import { planResize } from '../pipeline';
  import { jobStore } from '../stores/jobs.svelte';
  import { FORMAT_LABELS, isLossy, type ImageJob, type OutputFormat } from '../types';

  let { job, compact = false }: { job: ImageJob; compact?: boolean } = $props();

  const FORMATS: OutputFormat[] = ['jpeg', 'webp', 'avif', 'png'];

  const sourceLong = $derived(job.source ? Math.max(job.source.width, job.source.height) : null);
  const sliderMax = $derived(sourceLong ?? 4096);
  const edgeValue = $derived(job.params.maxEdge ?? sliderMax);
  const outputSize = $derived(job.source ? planResize(job.source, job.params.maxEdge) : null);
  const lossy = $derived(isLossy(job.params.format));

  const fractions = $derived.by(() => {
    if (!sourceLong) return [] as { label: string; value: number }[];
    return [
      { label: '1/2', value: Math.round(sourceLong / 2) },
      { label: '1/4', value: Math.round(sourceLong / 4) },
    ];
  });

  const presets = $derived.by(() => {
    if (!sourceLong) return [] as number[];
    const values: number[] = [];
    for (let n = 1; n <= 5; n++) values.push(384 * n);
    for (let value = 2304; value <= sourceLong; value += 768) values.push(value);
    return values.filter((value) => value <= sourceLong);
  });

  function setFormat(format: OutputFormat) {
    jobStore.setParams(job.id, { format, keepExif: format === 'jpeg' ? job.params.keepExif : false });
  }

  function setQuality(quality: number) {
    jobStore.setParams(job.id, { quality });
  }

  function setEffort(effort: number) {
    jobStore.setParams(job.id, { effort });
  }

  function setEdge(value: number | null) {
    jobStore.setParams(job.id, { maxEdge: value });
  }

  function setEdgeFromSlider(raw: number) {
    setEdge(raw >= sliderMax ? null : raw);
  }

  function setMaxEdge(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    setEdge(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }

  function toggleExif(keep: boolean) {
    jobStore.setParams(job.id, { keepExif: keep });
  }

  const chip = 'rounded-md border px-2 py-1 text-xs transition';
  const chipOff = 'border-ink-200 text-ink-600 hover:border-brand-500 hover:text-brand-600';
  const chipOn = 'border-brand-500 bg-brand-500/10 text-brand-600';
</script>

{#snippet formatPicker()}
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
{/snippet}

{#snippet qualityOrEffort()}
  <div class="flex min-w-[150px] flex-1 items-center gap-2">
    <span class="shrink-0 text-xs text-ink-500">{lossy ? '质量' : '力度'}</span>
    {#if lossy}
      <input
        type="range"
        min="0"
        max="100"
        value={job.params.quality}
        oninput={(event) => setQuality(Number(event.currentTarget.value))}
        class="min-w-0 flex-1 accent-brand-500"
      />
      <span class="w-8 shrink-0 text-right text-xs tabular-nums text-ink-500">{job.params.quality}</span>
    {:else}
      <input
        type="range"
        min="1"
        max="6"
        value={job.params.effort}
        oninput={(event) => setEffort(Number(event.currentTarget.value))}
        class="min-w-0 flex-1 accent-brand-500"
      />
      <span class="w-8 shrink-0 text-right text-xs tabular-nums text-ink-500">{job.params.effort}</span>
    {/if}
  </div>
{/snippet}

{#snippet edgeSlider()}
  {#if sourceLong && sourceLong > 64}
    <input
      type="range"
      min="64"
      max={sliderMax}
      step="1"
      value={edgeValue}
      oninput={(event) => setEdgeFromSlider(Number(event.currentTarget.value))}
      class="w-full accent-brand-500"
    />
  {:else}
    <span class="text-xs text-ink-400">正在测量原图尺寸…</span>
  {/if}
{/snippet}

{#snippet edgeChips(includeReset: boolean)}
  <div class="flex flex-wrap gap-1">
    {#if includeReset}
      <button
        type="button"
        onclick={() => setEdge(null)}
        class="{chip} {job.params.maxEdge === null ? chipOn : chipOff}"
      >
        原尺寸
      </button>
    {/if}
    {#each fractions as fraction (fraction.label)}
      <button
        type="button"
        onclick={() => setEdge(fraction.value)}
        class="{chip} tabular-nums {job.params.maxEdge === fraction.value ? chipOn : chipOff}"
      >
        {fraction.label}
      </button>
    {/each}
    {#each presets as value (value)}
      <button
        type="button"
        onclick={() => setEdge(value)}
        class="{chip} tabular-nums {job.params.maxEdge === value ? chipOn : chipOff}"
      >
        {value}
      </button>
    {/each}
  </div>
{/snippet}

{#if compact}
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <div class="w-44 shrink-0">{@render formatPicker()}</div>
      {@render qualityOrEffort()}
    </div>
    <div class="flex items-center gap-2">
      <span class="shrink-0 text-xs text-ink-500">长边</span>
      {#if outputSize}
        <span class="shrink-0 text-xs tabular-nums text-ink-600">{outputSize.outW}×{outputSize.outH}</span>
      {/if}
      <div class="min-w-[80px] flex-1">{@render edgeSlider()}</div>
      <button
        type="button"
        onclick={() => setEdge(null)}
        class="shrink-0 rounded-md border px-2 py-1 text-xs transition {job.params.maxEdge === null ? chipOn : chipOff}"
      >
        原尺寸
      </button>
    </div>
    <div class="-mx-1 overflow-x-auto px-1 pb-0.5">{@render edgeChips(false)}</div>
  </div>
{:else}
  <div class="flex flex-col gap-5">
    <div class="space-y-2">
      <span class="text-xs font-medium text-ink-600">格式</span>
      {@render formatPicker()}
    </div>

    {@render qualityOrEffort()}
    {#if !lossy}
      <p class="-mt-3 text-xs text-ink-400">PNG 为无损，只优化体积，不损失画质。</p>
    {/if}

    <div class="space-y-3">
      <div class="flex items-baseline justify-between">
        <span class="text-xs font-medium text-ink-600">长边像素</span>
        {#if outputSize}
          <span class="text-xs tabular-nums text-ink-500">{outputSize.outW}×{outputSize.outH}</span>
        {:else if job.params.maxEdge === null}
          <span class="text-xs text-ink-400">原尺寸</span>
        {/if}
      </div>

      {#if sourceLong && sourceLong > 64}
        {@render edgeSlider()}
        <div class="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            placeholder="原尺寸"
            value={job.params.maxEdge ?? ''}
            oninput={(event) => setMaxEdge(event.currentTarget.value)}
            class="w-24 rounded-lg border border-ink-200 px-2 py-1 text-sm tabular-nums outline-none focus:border-brand-500"
          />
          <span class="text-xs text-ink-400">px · 留空 = 原尺寸</span>
        </div>
        {@render edgeChips(true)}
        <p class="text-xs text-ink-400">只缩不放，等比不留白。</p>
      {:else}
        <p class="text-xs text-ink-400">正在测量原图尺寸…</p>
      {/if}
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
  </div>
{/if}
