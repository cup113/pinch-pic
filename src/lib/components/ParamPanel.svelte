<script lang="ts">
  import { jobStore } from '../stores/jobs.svelte';
  import ParamsEditor from './ParamsEditor.svelte';
  import type { ImageJob } from '../types';

  let { job }: { job: ImageJob | null } = $props();

  function applyToAll() {
    if (job) jobStore.applyAll(job.params);
  }
</script>

<aside class="flex h-full flex-col gap-5 overflow-y-auto border-ink-200 bg-white p-4 lg:border-l">
  <h2 class="text-sm font-semibold text-ink-900">参数</h2>

  {#if job}
    <ParamsEditor {job} />

    <button
      type="button"
      onclick={applyToAll}
      class="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
    >
      应用到全部图片
    </button>
  {/if}
</aside>
