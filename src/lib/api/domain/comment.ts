/**
 * 评论的领域模型与树重建（纯函数）
 *
 * Core 的楼中楼是「根 + 平铺后代」：`/comments/ref` 只返回根评论，
 * 后代全都塞在根评论的 `replies` 数组里，**顺序与层级都要靠 `parentCommentId` 重建**。
 * 这里的两件事因此必须做成纯函数：树重建、长线程补页合并。
 */

export interface CommentAuthor {
  name: string
  avatar: string | null
  url: string | null
}

export interface CommentItem {
  id: string
  text: string
  createdAt: string
  author: CommentAuthor
  /** 管理员置顶 */
  pinned: boolean
  parentId: string | null
  /** Core 侧的回复总数（可能大于 `replies.length`，差额在 `hiddenCount`） */
  replyCount: number
  /** 长线程窗口里没有返回的中间回复数量 */
  hiddenCount: number
  /** 取中间回复的游标；为 null 表示没有更多 */
  nextCursor: string | null
  replies: CommentItem[]
}

export interface CommentPage {
  items: CommentItem[]
  /** 根评论总数（来自 `pagination.total`，不是本地数组长度） */
  total: number
  page: number
  totalPages: number
  hasNext: boolean
}

/**
 * 把平铺的一组评论重建成树。
 *
 * 防御三种脏数据，它们在实际站点上都可能出现：
 *   - **父级缺失**：父评论被删除或不在当前页 → 提为根，而不是丢弃（丢了用户就看不到自己的话）
 *   - **自引用**：`parentId === id`
 *   - **环状引用**：A→B→A，沿父链上溯时断边
 */
export function buildReplyTree(nodes: CommentItem[]): CommentItem[] {
  const byId = new Map<string, CommentItem>()
  for (const node of nodes) byId.set(node.id, { ...node, replies: [] })

  const parentOf = new Map<string, string | null>()
  for (const node of nodes) parentOf.set(node.id, node.parentId)

  /** 从 `parentId` 沿父链上溯，若回到 `id` 说明成环 */
  const createsCycle = (id: string, parentId: string): boolean => {
    const seen = new Set<string>([id])
    let cursor: string | null = parentId
    while (cursor) {
      if (seen.has(cursor)) return true
      seen.add(cursor)
      cursor = parentOf.get(cursor) ?? null
    }
    return false
  }

  const roots: CommentItem[] = []

  for (const node of nodes) {
    const target = byId.get(node.id)
    if (!target) continue

    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (!parent || parent.id === node.id || createsCycle(node.id, parent.id)) {
      roots.push(target)
      continue
    }
    parent.replies.push(target)
  }

  return roots
}

/** 前序遍历拍平（不含自身之外的重复项） */
export function flattenCommentTree(nodes: CommentItem[]): CommentItem[] {
  const out: CommentItem[] = []
  const walk = (list: CommentItem[]) => {
    for (const node of list) {
      out.push(node)
      walk(node.replies)
    }
  }
  walk(nodes)
  return out
}

/**
 * 把长线程补回来的中间回复合进已有树。
 *
 * 先去重（按 id）再整体重建，避免「同一个节点出现在两个父级下」；
 * 合并后窗口状态清零——`hiddenCount` 与 `nextCursor` 描述的是「还没取的部分」，
 * 取完了就不该继续提示。
 */
export function mergeThreadReplies(
  root: CommentItem,
  extra: CommentItem[],
  state: { hiddenCount?: number; nextCursor?: string | null } = {},
): CommentItem {
  const existing = flattenCommentTree([root])
  const known = new Set(existing.map((node) => node.id))
  const merged = [...existing, ...extra.filter((node) => !known.has(node.id))]

  const rebuilt = buildReplyTree(merged).find((node) => node.id === root.id)
  if (!rebuilt) return root

  return {
    ...rebuilt,
    hiddenCount: state.hiddenCount ?? 0,
    nextCursor: state.nextCursor ?? null,
  }
}
