/**
 * 正文作用域定位（客户端增强器共用）
 *
 * `<Prose>` 把增强器紧跟正文之后渲染，所以正常情况下「紧邻的前一个 `.prose`」就是
 * 当前正文。找不到时退化为「文档里第一个还没被同类增强器接管的 `.prose`」，
 * 保证一页多个正文（日记列表）时各增强器不会互相抢节点。
 *
 * 只返回节点，不写标记：`flag` 由调用方自己按下，卸载时自己摘掉。
 */
const PROSE_SELECTOR = '.prose'

export function locateProseScope(marker: HTMLElement | null, flag: string): HTMLElement | null {
  let node = marker?.previousElementSibling ?? null
  while (node) {
    if (node.matches(PROSE_SELECTOR)) return node as HTMLElement
    node = node.previousElementSibling
  }

  for (const candidate of Array.from(document.querySelectorAll<HTMLElement>(PROSE_SELECTOR))) {
    if (candidate.dataset[flag] !== 'true') return candidate
  }

  return null
}
