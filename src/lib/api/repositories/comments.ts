import { postV2, requestV2 } from '../client/http'
import { expectObject } from '../adapters/common'
import { toCommentItem, toCommentItems } from '../adapters/comment'
import { buildReplyTree, type CommentPage } from '../domain/comment'
import type {
  V2CommentCreateBody,
  V2CommentsBody,
  V2CommentThreadBody,
} from '../contracts/v2/comment'
import type { V2Aggregate } from '../contracts/v2'

/** core 的排序值：pinned = 置顶优先（默认），newest / oldest 按时间 */
export type CommentSort = 'pinned' | 'newest' | 'oldest'

/** 匿名评论的提交体（对外只暴露这一个类型，路由层不必去碰契约目录） */
export type CommentInput = V2CommentCreateBody

export interface CommentOptions {
  /** 站点级总开关。单篇关闭评论在 Core v12 不存在，不要伪装成有这个粒度 */
  disabled: boolean
  /** 站点是否允许匿名（游客）评论 */
  allowGuest: boolean
}

/**
 * 站点级评论开关
 *
 * 来自 `GET /aggregate` 的 `comment_options`，与站点身份同一个请求
 * （Next 的 fetch 缓存会按 URL 去重，这里不会多发一次）。
 *
 * 失败时返回「关闭」：能力未知时不该给出一个能点的表单。
 */
export async function getCommentOptions(): Promise<CommentOptions> {
  try {
    const body = await requestV2<unknown>('/aggregate', { revalidate: 600, tags: ['site'] })
    const aggregate = expectObject<V2Aggregate>(body, '/aggregate')
    const options = aggregate.comment_options ?? {}

    return {
      disabled: (options.disable_comment ?? options.disableComment) === true,
      allowGuest: (options.allow_guest_comment ?? options.allowGuestComment) !== false,
    }
  } catch {
    return { disabled: true, allowGuest: false }
  }
}

export interface ListCommentsOptions {
  page?: number
  size?: number
  sort?: CommentSort
}

/**
 * `GET /comments/ref/:id` —— 根评论分页
 *
 * 每个根评论的 `replies` 是**平铺**的后代，这里统一拍平成节点再重建树。
 * `total` 取 `pagination.total`（根评论数），不用本地数组长度冒充。
 */
export async function listComments(
  refId: string,
  options: ListCommentsOptions = {},
): Promise<CommentPage> {
  const page = Math.max(1, options.page ?? 1)
  const size = Math.min(50, Math.max(1, options.size ?? 20))
  const sort = options.sort ?? 'pinned'

  const body = await requestV2<V2CommentsBody>(`/comments/ref/${refId}`, {
    query: { page, size, sort },
    revalidate: 30,
    tags: [`comments:${refId}`],
  })

  const rows = Array.isArray(body.data) ? body.data : []
  const items = buildReplyTree(rows.flatMap(toCommentItems))
  const pagination = body.pagination

  return {
    items,
    total: pagination?.total ?? items.length,
    page: pagination?.current_page ?? page,
    totalPages: pagination?.total_page ?? 1,
    hasNext: pagination?.has_next_page ?? false,
  }
}

export interface ThreadReplies {
  items: ReturnType<typeof toCommentItem>[]
  /** 还没取回的中间回复数量 */
  remaining: number
  nextCursor: string | null
}

/**
 * `GET /comments/thread/:rootId` —— 长线程中段补页
 *
 * 只有根评论的 `reply_window.has_hidden` 为真时才需要调用。
 */
export async function listThreadReplies(
  rootId: string,
  options: { cursor?: string | null; size?: number } = {},
): Promise<ThreadReplies> {
  const body = await requestV2<V2CommentThreadBody>(`/comments/thread/${rootId}`, {
    query: { cursor: options.cursor ?? undefined, size: options.size ?? 10 },
    revalidate: 0,
  })

  const rows = Array.isArray(body.replies) ? body.replies : []
  return {
    items: rows.map(toCommentItem),
    remaining: body.remaining ?? 0,
    nextCursor: body.next_cursor ?? body.nextCursor ?? null,
  }
}

/**
 * `POST /comments/guest/:refId` —— 匿名发表评论
 *
 * 幂等窗口 20 秒：同样内容在 20 秒内重复提交，core 会返回
 * 「Whoops, you already said this」。所以界面必须做按钮 loading，
 * 不能靠「没反应就再点」。
 */
export async function createGuestComment(refId: string, input: V2CommentCreateBody): Promise<void> {
  await postV2<unknown>(`/comments/guest/${refId}`, input)
}

/** `POST /comments/guest/reply/:parentId` —— 匿名回复（父级可以是任意层级） */
export async function replyToGuestComment(
  parentId: string,
  input: V2CommentCreateBody,
): Promise<void> {
  await postV2<unknown>(`/comments/guest/reply/${parentId}`, input)
}
