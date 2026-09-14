# 用 jSquash WASM 编码器，不用 Canvas / WebCodecs

压缩结果的可预期性是本工具的核心卖点：同样的参数在任何浏览器必须产出一致的字节。
Canvas 的编码能力和 quality 映射由浏览器随机决定（Safari 编不出 AVIF、PNG 无质量参数），
WebCodecs 支持参差且为视频流设计。故选择 @jsquash 系列（mozjpeg / oxipng / webp / avif）
跑在 Web Worker 中，参数直接对应编码器原生语义。

## Considered Options

- Canvas API：零依赖，但输出不可预期，无法支持 AVIF
- WebCodecs：原生快，但 Safari/Firefox 覆盖不全，图片管线别扭

## Consequences

- 每个 WASM 1~3MB，必须按格式懒加载（首次使用才拉取）
- AVIF 全量编码秒级耗时，UI 必须有后台队列与进度态
- oxipng 的多线程变体会生成 wasm-bindgen-rayon 子 Worker，打包风险高；改为直接使用单线程包 `@jsquash/oxipng/codec/pkg/squoosh_oxipng.js`
- 换引擎 = 重写整条管线，本决策实质不可逆
