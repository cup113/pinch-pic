<script lang="ts">
  import { onMount } from 'svelte';
  import InfoPopover from './lib/components/InfoPopover.svelte';
  import JobList from './lib/components/JobList.svelte';
  import ParamPanel from './lib/components/ParamPanel.svelte';
  import PreviewPane from './lib/components/PreviewPane.svelte';
  import { jobStore } from './lib/stores/jobs.svelte';

  type Tab = 'jobs' | 'preview' | 'params';
  const TABS: { id: Tab; label: string }[] = [
    { id: 'jobs', label: '图片' },
    { id: 'preview', label: '预览' },
    { id: 'params', label: '参数' },
  ];

  let dragging = $state(false);
  let dragDepth = 0;
  let tab = $state<Tab>('jobs');
  let input = $state<HTMLInputElement | undefined>();

  const selected = $derived(jobStore.selected);

  function acceptFiles(list: FileList | null | undefined) {
    if (!list) return;
    const images = Array.from(list).filter((file) => file.type.startsWith('image/'));
    if (images.length > 0) {
      jobStore.addFiles(images);
      tab = 'jobs';
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth = 0;
    dragging = false;
    acceptFiles(event.dataTransfer?.files);
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault();
    dragDepth += 1;
    dragging = true;
  }

  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dragging = false;
  }

  function onPaste(event: ClipboardEvent) {
    acceptFiles(event.clipboardData?.files);
  }

  onMount(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });
</script>

<svelte:window ondragover={(event) => event.preventDefault()} ondrop={onDrop} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex h-full flex-col" ondragenter={onDragEnter} ondragleave={onDragLeave}>
  <header class="flex items-center justify-between gap-2 border-b border-ink-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
    <div class="flex min-w-0 items-center gap-2">
      <h1 class="text-base font-semibold tracking-tight text-ink-900">pinch-pic</h1>
      <InfoPopover />
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onclick={() => input?.click()}
        class="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600"
      >
        添加图片
      </button>
      <a
        href="https://github.com/cup113/pinch-pic"
        target="_blank"
        rel="noreferrer"
        title="GitHub 仓库"
        aria-label="GitHub 仓库"
        class="shrink-0 rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" class="h-5 w-5 fill-current">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
      </a>
    </div>
  </header>

  <main class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)_300px]">
    <div class="min-h-0 overflow-hidden {tab !== 'jobs' ? 'hidden lg:block' : ''}">
      <JobList onselect={() => (tab = 'preview')} />
    </div>
    <div class="min-h-0 overflow-hidden {tab !== 'preview' ? 'hidden lg:block' : ''}">
      <PreviewPane job={selected} />
    </div>
    <div class="min-h-0 overflow-hidden {tab !== 'params' ? 'hidden lg:block' : ''}">
      <ParamPanel job={selected} />
    </div>
  </main>

  <nav class="grid grid-cols-3 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
    {#each TABS as item (item.id)}
      <button
        type="button"
        onclick={() => (tab = item.id)}
        aria-current={tab === item.id ? 'page' : undefined}
        class="flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition
          {tab === item.id ? 'text-brand-600' : 'text-ink-500 hover:text-ink-800'}"
      >
        {item.label}
        {#if item.id === 'jobs' && jobStore.jobs.length > 0}
          <span class="text-ink-400">{jobStore.jobs.length}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <input
    bind:this={input}
    type="file"
    accept="image/*"
    multiple
    class="hidden"
    onchange={(event) => {
      acceptFiles(event.currentTarget.files);
      event.currentTarget.value = '';
    }}
  />

  {#if dragging}
    <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand-500/10 backdrop-blur-sm">
      <p class="rounded-xl border-2 border-dashed border-brand-500 bg-white/90 px-8 py-6 text-sm font-medium text-brand-600">
        松手即可添加
      </p>
    </div>
  {/if}
</div>
