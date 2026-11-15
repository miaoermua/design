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
