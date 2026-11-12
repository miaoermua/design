/**
 * Mix Space API v2 — 评论契约
 *
 * 字段名以**线上响应**为准（v12.10.0 序列化为 snake_case），适配器另外兼容 camelCase。
 *
 *   GET  /comments/ref/:refId?page=&size=&sort=pinned|newest|oldest
 *     → { data: CommentRow[], pagination, readers }
 *   GET  /comments/thread/:rootId?size=&cursor=
 *     → { replies: CommentRow[], remaining, done, next_cursor? }
 *   POST /comments/guest/:refId          （匿名发评论）
 *   POST /comments/guest/reply/:parentId （匿名回复，父级可以是任意层级）
 *
 * 三类内容（post / note / page）都能读；单篇关闭评论在 Core 侧不存在，
 * 只有站点级 `disable_comment`，见 `docs/audits/PHASE-5C-C-COMMENTS-AUDIT.md`。
 */

import type { EntityId, IsoDateString, V2Pagination } from './common'

/**
 * 长线程的窗口信息（实测字段是 `reply_window`，不是 camelCase）
 *
 * 超过阈值时只返回首尾若干条，中间部分要靠 `next_cursor` 打 `/comments/thread`。
 */
export interface V2CommentReplyWindow {
  total?: number
  returned?: number
  threshold?: number
  has_hidden?: boolean
  hidden_count?: number
  next_cursor?: string | null
  nextCursor?: string | null
}

export interface V2CommentRow {
  id: EntityId
  ref_type?: string
  ref_id?: EntityId
  author?: string | null
  mail?: string | null
  url?: string | null
  avatar?: string | null
  text: string
  /**
   * 收件箱读态：0 = Unread / 1 = Read / 2 = Junk。
   * **不是审核状态**，不得据此推断「这条评论还在审核中」。
   */
  state?: number
  parent_comment_id?: EntityId | null
  parentCommentId?: EntityId | null
  root_comment_id?: EntityId | null
  rootCommentId?: EntityId | null
  reply_count?: number
  replyCount?: number
  /** 置顶（管理员行为） */
  pin?: boolean
  is_whispers?: boolean
  is_deleted?: boolean
  created_at: IsoDateString
  createdAt?: IsoDateString
  /** 根评论内嵌的平铺后代（不是树，要用 parent_comment_id 重建） */
  replies?: V2CommentRow[]
  reply_window?: V2CommentReplyWindow | null
  replyWindow?: V2CommentReplyWindow | null
  /**
   * 公开响应会带上 `ip` 与 `agent`（core 的拦截器只删 `mail`）。
   * 契约里保留字段是为了「知道它存在」，适配器绝不会把它带进领域模型。
   */
  ip?: string | null
  agent?: string | null
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

/** `GET /comments/thread/:rootId` —— 长线程的中段回复 */
export interface V2CommentThreadBody {
  replies?: V2CommentRow[]
  remaining?: number
  done?: boolean
  next_cursor?: string | null
  nextCursor?: string | null
}

/** POST 评论 / 回复的请求体（core `CommentSchema`，匿名回复版不含 anchor） */
export interface V2CommentCreateBody {
  author: string
  text: string
  mail: string
  url?: string
}
