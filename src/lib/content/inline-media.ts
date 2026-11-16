/**
 * 已渲染正文里出现过的媒体地址
 *
 * core 的 `images` 是把正文里**所有**图片抽出来存到笔记上的（`::: gallery` /
 * `::: carousel` 里的图也在其中）。详情页如果在文末再把 `images` 铺一遍，
 * 用相册的日记就会把同一批图重复显示两次。
 *
 * 这里扫一遍渲染后的 HTML，页面据此只补「正文里没出现过」的附件。
 * 只用渲染结果、不重新解析 Markdown：正文到底渲染成什么由渲染管线决定，
 * 在这里再猜一遍迟早会和渲染器走岔。
 *
 * 只读 `<img>` / `<video>` 的 `src`：相册的 `<a href>` 指向同一张图，
 * 不必重复登记。属性值是 `escapeAttribute` 转义过的，取出来要解回原样再比对。
 */

import { safeUrl } from './sanitize'

/** 值里只会出现这四种实体（`escapeAttribute` 的产物），不做通用实体解码 */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
}

const MEDIA_SRC = /<(?:img|video)\b[^>]*?\ssrc="([^"]*)"/gi
function decodeAttribute(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot);/g, (entity) => ENTITIES[entity] ?? entity)
}

export function inlineMediaSources(html: string): Set<string> {
  const sources = new Set<string>()

  for (const match of html.matchAll(MEDIA_SRC)) {
    const src = decodeAttribute(match[1] ?? '').trim()
    if (src) sources.add(src)
  }

  return sources
}

/* ── 源码级取图（不渲染）─────────────────────────────────────────
 *
 * 列表页只需要「一张代表图」，但**不能**为此跑一遍完整渲染：那是 Shiki 高亮
 * 与 KaTeX 解析的开销，一条日记几百张图时尤其致命（实测单篇 475 张正文图）。
 *
 * 这里直接在 Markdown 源码上扫，只做「找出第一个图片地址」这一件事。
 * 与渲染管线的关系是：**允许多找**（宁可选到一张图，也不漏），
 * 但**不允许错找**（地址必须能过 `safeUrl`，否则跳过）。
 */

/** 行内图片：`![alt](src "title")`，alt 允许一层方括号，src 允许一层圆括号 */
const INLINE_IMAGE =
  /!\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*<?((?:[^\s<>()]|\([^\s()]*\))+)>?(?:\s+["'][^"']*["'])?\s*\)/g

/** 引用式图片：`![alt][ref]` / `![alt][]` */
const REFERENCE_IMAGE = /!\[((?:[^[\]]|\[[^\]]*\])*)\]\[([^\]]*)\]/g

/** 引用式定义：`[ref]: https://…` */
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*<?([^\s<>]+)>?/gm

/** 原始 HTML 图片：`<img src="…">` */
const HTML_IMAGE = /<img\b[^>]*?\bsrc=["']([^"']+)["']/gi

/**
 * 抹掉代码，避免把示例里的 `![](…)` 当成真图。
 * 用等长空白替换而不是删除，位次比较（谁在前面）才仍然准确。
 */
function blankOut(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (match) => ' '.repeat(match.length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => ' '.repeat(match.length))
    .replace(/`[^`\n]*`/g, (match) => ' '.repeat(match.length))
}

/**
 * Markdown 源码里的第一张图片地址；没有就返回 null。
 *
 * 「第一张」按**在原文中的位置**判定，不按匹配类型排序——先出现的图片才是
 * 作者心里的封面。行内式、引用式、原始 HTML 三种写法混用时也一样。
 */
export function firstImageSource(markdown: string): string | null {
  const text = blankOut(markdown)
  const candidates: Array<{ at: number; src: string }> = []

  const definitions = new Map<string, string>()
  for (const match of text.matchAll(REFERENCE_DEFINITION)) {
    const label = (match[1] ?? '').trim().toLowerCase()
    const src = match[2]?.trim()
    if (label && src) definitions.set(label, src)
  }

  for (const match of text.matchAll(INLINE_IMAGE)) {
    const src = match[2]?.trim()
    if (src) candidates.push({ at: match.index ?? 0, src })
  }

  for (const match of text.matchAll(REFERENCE_IMAGE)) {
    // `![alt][]` 用 alt 当 label
    const label = (match[2]?.trim() || match[1]?.trim() || '').toLowerCase()
    const src = definitions.get(label)
    if (src) candidates.push({ at: match.index ?? 0, src })
  }

  for (const match of text.matchAll(HTML_IMAGE)) {
    const src = decodeAttribute(match[1] ?? '').trim()
    if (src) candidates.push({ at: match.index ?? 0, src })
  }

  candidates.sort((a, b) => a.at - b.at)

  for (const candidate of candidates) {
    // 与渲染管线同一道安全闸：`javascript:` / `data:` 之类不进入列表
    const safe = safeUrl(candidate.src, 'image')
    if (safe) return safe
  }

  return null
}

/* ── 附件宽高索引（给正文图补 width/height，消 CLS）───────────────
 *
 * core 的 `images` 带回 `width` / `height`（实测 236/236 条日记附件、3/3 条
 * 文章附件都带）。正文图缺这两个属性时，浏览器只能等图片下载完才知道占多大，
 * 于是每张图落地都把下面的内容往下推一次 —— 一篇 475 张图的长日记滚起来是
 * 持续的位移抖动。
 *
 * 索引只收**两个值都有效**的条目：浏览器要从 `width` + `height` 推出
 * `aspect-ratio`，只给一个反而会按默认 300×150 之类兜底，比不给更糟。
 *
 * 匹配是**精确地址相等**，不做「同文件名」之类的模糊配对：
 * 两个目录下的 `cover.webp` 是两张不同的图，猜错会把图撑成长条。
 * 因此拿不到尺寸的图保持原样（宁可它继续有 CLS，也不要一张比例错误的图）。
 */

/** 一张图在版面上需要的最小信息 */
export interface ImageSize {
  width: number
  height: number
}

/**
 * 从附件列表建 `src → 宽高` 索引。
 *
 * 只取 `kind === 'image'`：视频附件的 `width/height` 是视频轨道的尺寸，
 * 套到 `<img>` 上（比如视频的封面图）会是错的。
 */
export function imageSizeIndex(
  images:
    readonly { src: string; width?: number; height?: number; kind?: string }[] | null | undefined,
): Map<string, ImageSize> {
  const index = new Map<string, ImageSize>()

  for (const image of images ?? []) {
    if (!image || typeof image.src !== 'string') continue
    if (image.kind && image.kind !== 'image') continue
    const { width, height } = image
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    if (!width || !height || width <= 0 || height <= 0) continue
    if (index.has(image.src)) continue
    index.set(image.src, { width: Math.round(width), height: Math.round(height) })
  }

  return index
}
