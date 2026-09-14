<script lang="ts">
  let open = $state(false);
  let wrap = $state<HTMLDivElement | undefined>();

  function onWindowPointerDown(event: PointerEvent) {
    if (!open) return;
    if (wrap && !wrap.contains(event.target as Node)) open = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onKeydown} />

<div class="relative" bind:this={wrap}>
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-label="使用说明"
    aria-expanded={open}
    class="flex h-5 w-5 items-center justify-center rounded-full border border-ink-200 text-[11px] font-medium text-ink-500 transition hover:border-brand-500 hover:text-brand-600"
  >
    ?
  </button>

  {#if open}
    <div
      role="dialog"
      aria-label="使用说明"
      class="fixed inset-x-2 top-14 z-40 space-y-3 rounded-xl border border-ink-200 bg-white p-3 text-xs leading-relaxed text-ink-600 shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72"
    >
      <div>
        <p class="font-medium text-ink-800">隐私</p>
        <p class="mt-0.5">本地 WASM 编码，文件不出本机。</p>
        <p class="mt-0.5">默认抹除全部元数据（含 GPS），方向已烘进像素；仅 JPEG 可选保留 EXIF。</p>
      </div>
      <div>
        <p class="font-medium text-ink-800">预览</p>
        <p class="mt-0.5">滚轮／双指缩放，拖拽平移，拖动中线左右对比。</p>
      </div>
    </div>
  {/if}
</div>
