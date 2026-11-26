/**
 * 房间（presence）模型
 *
 * 数据来源只有一处：Core 的 `GET /activity/rooms`。它返回的是
 * **Socket.IO 房间 → 连接数**，房间名由 `buildArticleRoomName()` 生成，
 * 形如 `article-<雪花 id>`；`lang:<lang>` 这类非内容房间也在同一份返回里。
 *
 * 这里刻意只保留「内容身份 + 人数」，不保留任何访客信息：
 * 接口本身也不下发 sessionId / IP / UA，主题不自行推断。
 */

/** 房间对应的内容类型；core 的 `objects` 按这三类分别返回 */
export type PresenceKind = 'post' | 'note' | 'page'

export interface PresenceRoom {
  kind: PresenceKind
  /** 房间名里的实体 id（雪花 id）。日记的 URL 用的是 nid，不是它 */
  articleId: string
  title: string
  /** 文章分类 slug；只有 post 可能有 */
  categorySlug: string | null
  /** post / page 的 slug；note 为 null */
  slug: string | null
  /** 日记自增 nid；只有 note 有 */
  nid: number | null
  /**
   * 房间内连接数（core 按 socket 计，**不去重**）。
   * 同一个人开两个标签页会算 2，与全站 `online` 的口径不同。
   */
  viewers: number
}

/** 预览框直接渲染的一行：已经解析好站内地址，客户端不再拼 URL */
export interface PresenceEntry {
  title: string
  href: string
  viewers: number
}
