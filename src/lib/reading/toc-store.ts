/**
 * 阅读页目录同步存储（Reading → Mobile Nav Menu）
 *
 * 文章详情页 / 日记详情页在服务端解析出 `TocItem[]` 后，通过客户端的
 * `<TocSync items={...} />` 把当前页的目录写进这个 store，离开页面时清空。
 * 顶栏菜单 (`SiteHeaderClient` → `SiteNavMenu`) 订阅此 store，在移动端展开
 * 菜单时即可展示「本文目录」结构线，而不必把整个 layout 拆进每个详情页。
 *
 * ## 为什么要「所有权令牌」
 *
 * 清空和写入来自**不同页面**的两个组件实例。客户端路由切换时，新页面挂载
 * 与旧页面卸载不保证在同一个提交里（Suspense 边界会让新树先落地）。若旧实例
 * 的清理函数无条件清空，就会把新页面刚写进去的目录一并抹掉——表现是
 * 「从一篇文章跳到另一篇，菜单里的目录时有时无」。
 *
 * 因此每次挂载领一个令牌：写入时连同令牌一起记账，清理时只允许清掉
 * **自己那一份**。令牌不匹配就说明已经有更新的页面接管了这块状态。
 */

import type { TocItem } from '@/lib/content/markdown'

type Listener = () => void

const EMPTY: TocItem[] = []
const listeners = new Set<Listener>()

/** 当前有效的目录与它的所有者 */
let current: { items: TocItem[]; token: symbol } | null = null

function emit() {
  for (const listener of listeners) listener()
}

export const tocStore = {
  getSnapshot(): TocItem[] {
    return current?.items ?? EMPTY
  },
  getServerSnapshot(): TocItem[] {
    return EMPTY
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /**
   * 写入当前页的目录。
   *
   * 少于两节视为「没有目录」：菜单里为一行标题腾出一整块并不划算，
   * 与侧栏 / 正文内目录折叠的 `items.length >= 2` 同一口径。
   */
  setItems(items: TocItem[], token: symbol = Symbol('toc')): void {
    const next = items.length >= 2 ? items : EMPTY
    if (current?.token === token && current.items === next) return
    current = { items: next, token }
    emit()
  },
  /** 只清自己那一份；传令牌可避免误清后挂载的新页面 */
  clear(token?: symbol): void {
    if (!current) return
    if (token && current.token !== token) return
    current = null
    emit()
  },
}
