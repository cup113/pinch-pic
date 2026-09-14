<script lang="ts">
  import { jobStore } from '../stores/jobs.svelte';
  import { artifactName, buildZip, downloadBlob } from '../download';
  import { formatBytes, formatPercent, savingsPercent } from '../format';
  import { FORMAT_LABELS, type ImageJob } from '../types';

  let { onselect }: { onselect?: () => void } = $props();

  let zipping = $state(false);

  async function downloadAll() {
    if (jobStore.doneJobs.length === 0 || zipping) return;
    zipping = true;
    try {
      downloadBlob(await buildZip(jobStore.doneJobs), 'pinch-pic.zip');
    } finally {
      zipping = false;
    }
  }

  function downloadOne(job: ImageJob) {
    if (job.artifact) downloadBlob(job.artifact, artifactName(job));
  }
</script>

<section class="flex h-full flex-col bg-white lg:border-r lg:border-ink-200">
  <header class="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-3">
    <div>
      <h2 class="text-sm font-semibold text-ink-900">
        作业 <span class="font-normal text-ink-400">{jobStore.jobs.length}</span>
      </h2>
      {#if jobStore.jobs.length > 0}
        <p class="mt-0.5 text-xs tabular-nums text-ink-500">
          {formatBytes(jobStore.totalOriginal)}
          {#if jobStore.doneJobs.length > 0}
            → {formatBytes(jobStore.totalArtifact)}
          {/if}
        </p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={downloadAll}
        disabled={jobStore.doneJobs.length === 0 || zipping}
        class="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {zipping ? '打包中…' : '全部下载 ZIP'}
      </button>
      <button
        type="button"
        onclick={() => jobStore.clear()}
        disabled={jobStore.jobs.length === 0}
        class="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-500 transition hover:border-ink-300 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        清空
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto">
    {#if jobStore.jobs.length === 0}
      <p class="px-4 py-10 text-center text-xs text-ink-400">还没有图片，拖进来或按 Ctrl+V 粘贴。</p>
    {:else}
      <ul class="divide-y divide-ink-100">
        {#each jobStore.jobs as job (job.id)}
          <li>
            <div
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition
                {jobStore.selectedId === job.id ? 'bg-brand-500/5' : 'hover:bg-ink-50'}"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                onclick={() => {
                  jobStore.select(job.id);
                  onselect?.();
                }}
              >
                <span class="block truncate text-sm text-ink-900">{job.file.name}</span>
                <span class="mt-0.5 block text-xs tabular-nums text-ink-500">
                  {#if job.status === 'done' && job.artifactSize !== null}
                    <s>{formatBytes(job.file.size)}</s>
                    → {formatBytes(job.artifactSize)}
                    <span class="ml-1 text-emerald-600">
                      {formatPercent(savingsPercent(job.file.size, job.artifactSize))}
                    </span>
                  {:else if job.status === 'error'}
                    <span class="text-red-500">{job.error}</span>
                  {:else}
                    {formatBytes(job.file.size)} · 压缩中…
                  {/if}
                </span>
                {#if job.meta}
                  <span class="mt-0.5 block text-xs text-ink-400 tabular-nums">
                    {FORMAT_LABELS[job.params.format]}
                    {#if job.meta.firstFrameOnly}· 已取 GIF 首帧{/if}
                    · {job.meta.width}×{job.meta.height}
                  </span>
                {/if}
              </button>
              <button
                type="button"
                onclick={() => downloadOne(job)}
                disabled={!job.artifact}
                title="下载"
                class="rounded-md border border-ink-200 px-3 py-2 text-xs text-ink-500 transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30 sm:px-2 sm:py-1"
              >
                ↓
              </button>
              <button
                type="button"
                onclick={() => jobStore.remove(job.id)}
                title="移除"
                class="rounded-md px-3 py-2 text-xs text-ink-400 transition hover:text-red-500 sm:px-2 sm:py-1"
              >
                ✕
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
