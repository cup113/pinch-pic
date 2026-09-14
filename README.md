# pinch-pic

浏览器本地批量图片压缩工具。文件全程不出本机：解码、缩放、编码都在 Web Worker 里由 WASM 完成，
页面只加载静态资源，没有任何上传接口。

部署目标：Netlify 静态站（`dist`）。

## 功能

- 批量拖拽 / 文件选择 / 剪贴板粘贴（Ctrl+V）导入
- 输出格式：JPEG（mozjpeg）、WebP、AVIF、PNG（oxipng 无损优化）
- 有损格式调「质量」，PNG 调「优化力度」
- 「长边像素」等比缩放，只缩不放，空值 = 原尺寸
- 默认抹除全部元数据（含 GPS），方向信息烘进像素；JPEG 输出可 opt-in 保留 EXIF
- 每个作业独立参数，可一键「应用到全部」
- 细节预览：拖动中线左右对比原图与同参数管线的裁剪预览，滚轮／双指缩放、拖拽平移
- 单张下载或全部打包 ZIP
- 桌面三栏、移动端底部标签栏（作业／预览／参数）自适应

## 开发

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # svelte-check + tsc
pnpm build      # 输出到 dist/
pnpm preview
```

## 架构

两路编码，共用同一条参数管线（`src/lib/pipeline.ts`），保证预览与产物一致：

- **裁剪预览**：`src/lib/worker/preview.worker.ts`，只编码当前可见区域，150ms 防抖
- **全量编码**：`src/lib/worker/encode.worker.ts`，由 `src/lib/encodePool.ts` 的 Worker 池调度，产出真实体积与产物

WASM 编码器来自 [jSquash](https://github.com/jamsinclair/jSquash)，按格式懒加载；
首次选择某格式时才拉取对应 `.wasm`。

领域术语见 [CONTEXT.md](./CONTEXT.md)，关键决策见 [docs/adr](./docs/adr/)。
