/**
 * Mix Space API v2 — 评论契约
 *
 * 本项目当前为只读站点：评论功能在 Feature Registry 中默认关闭，
 * 这里仍按线上字段（snake_case）声明读取侧契约，便于未来启用时不必重新猜字段。
 *
 *   GET /comments/ref/:refId?page=&size=&sort=pinned|newest|oldest&hasAnchor=&around=
 *     → { data: CommentRow[], pagination, readers: Record<readerId, Reader> }
 */

import type { EntityId, IsoDateString, V2Pagination } from './common'

export interface V2CommentRow {
  id: EntityId
  ref_type?: string
  ref_id?: EntityId
  author?: string | null
  mail?: string | null
  url?: string | null
  avatar?: string | null
  text: string
  state?: number
  parent_comment_id?: EntityId | null
  root_comment_id?: EntityId | null
  reply_count?: number
  pin?: boolean
  is_whispers?: boolean
  created_at: IsoDateString
}

export interface V2Reader {
  id: EntityId
  name?: string
  avatar?: string | null
  [key: string]: unknown
}

export interface V2CommentsBody {
  data: V2CommentRow[]
  pagination: V2Pagination
  readers?: Record<string, V2Reader>
}
