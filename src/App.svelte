<script lang="ts">
  import { onMount } from 'svelte';
  import JobList from './lib/components/JobList.svelte';
  import ParamPanel from './lib/components/ParamPanel.svelte';
  import PreviewPane from './lib/components/PreviewPane.svelte';
  import { jobStore } from './lib/stores/jobs.svelte';

  let dragging = $state(false);
  let dragDepth = 0;
  let input = $state<HTMLInputElement | undefined>();

  const selected = $derived(jobStore.selected);

  function acceptFiles(list: FileList | null | undefined) {
    if (!list) return;
    const images = Array.from(list).filter((file) => file.type.startsWith('image/'));
    if (images.length > 0) jobStore.addFiles(images);
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
  <header class="flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3">
    <div class="flex items-baseline gap-3">
      <h1 class="text-base font-semibold tracking-tight text-ink-900">pinch-pic</h1>
      <span class="text-xs text-ink-400">WASM 本地编码 · 文件不出本机 · 默认抹除元数据</span>
    </div>
    <button
      type="button"
      onclick={() => input?.click()}
      class="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600"
    >
      添加图片
    </button>
  </header>

  <main class="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_300px]">
    <JobList />
    <PreviewPane job={selected} />
    <ParamPanel job={selected} />
  </main>

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
        松手即可加入队列
      </p>
    </div>
  {/if}
</div>
