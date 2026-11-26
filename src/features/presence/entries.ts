/**
 * 房间 → 预览条目
 *
 * 这一层只做两件上层才有资格做的事：
 *   1. **拼站内地址**：路由形状集中在 `lib/routes`，数据层不 import 它；
 *      缺分类的文章、缺 nid 的日记、缺 slug 的页面在这里被丢掉，而不是猜一个地址。
 *   2. **按内容聚合 + 排序 + 截断**：接口按房间返回，同一内容理论上只会有
 *      一个房间；仍然按 href 合并（人数相加），避免出现两行同一个标题。
 *
 * 截断上限是刻意的：页脚预览是「谁在读」，不是排行榜。超过五条之后
 * 多出来的信息对读者没有价值，只会把浮层撑高。
 */

import type { PresenceEntry, PresenceRoom } from '@/lib/api'
import { articlePath, notePath, pagePath } from '@/lib/routes'

/** 预览最多展示几条内容 */
export const PRESENCE_MAX_ENTRIES = 5

/**
 * 房间对应的站内地址；无法构造时返回 null（该条目丢弃）。
 *
 * - 文章：必须有分类 slug 与文章 slug，否则 `articlePath` 返回 null；
 * - 日记：URL 用自增 `nid`（`/notes/:nid`），不是房间里的雪花 id；
 * - 页面：`about` 归到 `/about` 固定入口，其余走 `/pages/:slug`。
 */
export function presenceRoomHref(room: PresenceRoom): string | null {
  switch (room.kind) {
    case 'post':
      return room.slug ? articlePath(room.categorySlug, room.slug) : null
    case 'note':
      return room.nid !== null ? notePath(room.nid) : null
    case 'page':
      return room.slug ? pagePath(room.slug) : null
    default:
      return null
  }
}

export function toPresenceEntries(rooms: readonly PresenceRoom[]): PresenceEntry[] {
  const byHref = new Map<string, PresenceEntry>()

  for (const room of rooms) {
    const href = presenceRoomHref(room)
    if (!href) continue

    const existing = byHref.get(href)
    if (existing) {
      existing.viewers += room.viewers
      continue
    }
    byHref.set(href, { title: room.title, href, viewers: room.viewers })
  }

  return [...byHref.values()]
    .sort((a, b) => b.viewers - a.viewers || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, PRESENCE_MAX_ENTRIES)
}
