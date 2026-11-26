/**
 * 契约 → 领域：房间（presence）
 *
 * 只做结构校验与字段归一，不拼站内地址（路由构造属于上层，见 `features/presence`）。
 *
 * 输入是**不可信网络数据**：任何一条不合格行只丢弃自己，不让整份返回变成空；
 * 人数只认「整数且 > 0」，0 人的房间不产出条目（预览只展示有人在看的内容）。
 */

import type { V2ActivityRooms, V2ActivityRoomRef } from '../contracts/v2/activity'
import type { PresenceKind, PresenceRoom } from '../domain/presence'
import { readNumber, readString } from './common'

/**
 * 房间名 → 文章 id。
 *
 * 兼容两种前缀：手写协议的 `article-<id>`（core 的真实房间名）与
 * 响应里 snake_case 之后的 `article_<id>`（实测返回的就是这种）。
 * 不兼容的话 `room_count` 永远匹配不上。
 */
const ARTICLE_ROOM = /^article[-_]([A-Za-z0-9-]{1,64})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `room_count` → id → 连接数。非内容房间（`lang_*`）与非法值一律跳过。 */
function readRoomCounts(value: unknown): Map<string, number> {
  const counts = new Map<string, number>()
  if (!isRecord(value)) return counts

  for (const [key, raw] of Object.entries(value)) {
    const matched = ARTICLE_ROOM.exec(key)
    if (!matched) continue
    const count = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : 0
    if (count <= 0) continue
    // 同一 id 出现多个键（理论上不会）时取较大值，避免互相覆盖成 0
    const id = matched[1]!
    counts.set(id, Math.max(counts.get(id) ?? 0, count))
  }

  return counts
}

function readRows(value: unknown): V2ActivityRoomRef[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord) as V2ActivityRoomRef[]
}

function rowId(row: V2ActivityRoomRef): string | null {
  const raw = row.id
  if (typeof raw === 'string' && raw.length > 0) return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return null
}

function toRoom(row: V2ActivityRoomRef, kind: PresenceKind, viewers: number): PresenceRoom | null {
  const articleId = rowId(row)
  const title = readString(row, 'title', 'title')
  // 没有 id 或标题的行没有可展示的意义：标题为空时留一个空条目只会让人困惑
  if (!articleId || !title) return null

  const slug = readString(row, 'slug', 'slug')
  let categorySlug: string | null = null
  let nid: number | null = null

  if (kind === 'post') {
    const category = row.category
    categorySlug = isRecord(category) ? readString(category, 'slug', 'slug') : null
  } else if (kind === 'note') {
    const value = readNumber(row, 'nid', 'nid')
    nid = value !== null && Number.isInteger(value) && value > 0 ? value : null
  }

  return { kind, articleId, title, categorySlug, slug, nid, viewers }
}

/**
 * 解析 `GET /activity/rooms` 的返回。
 *
 * 顺序按 `objects` 的类型分组，与接口一致：posts → notes → pages。
 * 排序与截断不在这一层（那是展示策略）。
 */
export function toPresenceRooms(raw: unknown): PresenceRoom[] {
  if (!isRecord(raw)) return []

  const counts = readRoomCounts((raw as V2ActivityRooms).room_count ?? raw.roomCount)
  if (counts.size === 0) return []

  const objects = raw.objects
  if (!isRecord(objects)) return []

  const groups: Array<[PresenceKind, unknown]> = [
    ['post', objects.posts],
    ['note', objects.notes],
    ['page', objects.pages],
  ]

  const rooms: PresenceRoom[] = []
  for (const [kind, rows] of groups) {
    for (const row of readRows(rows)) {
      const id = rowId(row)
      if (!id) continue
      const viewers = counts.get(id)
      if (!viewers) continue
      const room = toRoom(row, kind, viewers)
      if (room) rooms.push(room)
    }
  }

  return rooms
}
