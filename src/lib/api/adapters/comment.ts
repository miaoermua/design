import type { V2CommentRow } from '../contracts/v2/comment'
import type { CommentItem } from '../domain/comment'
import { readField, readNumber, readString, stringOrNull } from './common'

/** 昵称为空时的兜底；不编造「匿名用户」之外的任何东西 */
const FALLBACK_AUTHOR = '匿名'

/** 头像与主页都只放行 http(s)：Core 的字段是自由文本，不能直接当 URL 用 */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

function authorName(value: string | null): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : FALLBACK_AUTHOR
}

/**
 * 评论行 → 领域节点
 *
 * 两条纪律：
 *   1. **不复制 `ip` / `agent` / `mail`**。这三个字段 Core 会公开返回，
 *      但它们是访客隐私，主题侧一个字节都不该留。
 *   2. 不根据 `state` 推断审核状态。`state` 是收件箱读态，
 *      公开列表能拿到就已经是「可展示」的了。
 */
export function toCommentItem(row: V2CommentRow): CommentItem {
  const replyCount = readNumber(row, 'reply_count', 'replyCount') ?? 0
  const window = readField(row, 'reply_window', 'replyWindow') as
    | {
        hidden_count?: number
        hiddenCount?: number
        next_cursor?: string | null
        nextCursor?: string | null
      }
    | null
    | undefined

  const replies = Array.isArray(row.replies) ? row.replies : []
  const hiddenFromWindow = window ? (window.hidden_count ?? window.hiddenCount ?? 0) : null

  return {
    id: String(row.id),
    text: typeof row.text === 'string' ? row.text : '',
    createdAt: readString(row, 'created_at', 'createdAt') ?? '',
    author: {
      name: authorName(stringOrNull(row.author)),
      avatar: safeHttpUrl(stringOrNull(row.avatar)),
      url: safeHttpUrl(stringOrNull(row.url)),
    },
    pinned: Boolean(row.pin),
    parentId: readString(row, 'parent_comment_id', 'parentCommentId'),
    replyCount,
    hiddenCount: hiddenFromWindow ?? Math.max(0, replyCount - replies.length),
    nextCursor: window
      ? (((window.next_cursor ?? window.nextCursor) as string | null) ?? null)
      : null,
    replies: [],
  }
}

/** 根评论连同内嵌后代一起转成扁平节点列表（树由 `buildReplyTree` 重建） */
export function toCommentItems(row: V2CommentRow): CommentItem[] {
  const root = toCommentItem(row)
  const replies = Array.isArray(row.replies) ? row.replies.map(toCommentItem) : []
  return [root, ...replies]
}
