/**
 * 文章实时更新的决策层（纯逻辑，无 React、无网络）
 *
 * 职责边界：
 * - 只判断「这个事件是不是关于我正在读的这篇文章」；
 * - 只决定「要不要重新取一次详情」，以及在拿到结果后通知谁；
 * - 真正的重新取数由注入的 `refresh` 完成（服务端 Route Handler），
 *   事件 payload 里的正文**不会**直接进入页面。
 *
 * 并发语义：单飞 + 末尾补一次。事件再多，最多同时一个请求，
 * 且不会把旧响应应用到新状态上（token 校验）。
 */

import {
  isSafeSlug,
  readModifiedAt,
  readPostIdFromPayload,
  RealtimeEvents,
  type RealtimeEnvelope,
} from '@/lib/realtime/protocol'

export interface ArticleIdentity {
  id: string
  category: string
  slug: string
  /** 当前页面这次渲染拿到的修改时间；用于丢弃过期事件 */
  modifiedAt: string | null
}

/** 事件里可能给出的新位置；只作为「去哪里找」的线索，必须回查校验 */
export interface ArticleLocation {
  category: string
  slug: string
}

export type ArticleSignal =
  | {
      kind: 'update'
      id: string
      modifiedAt: string | null
      next: ArticleLocation | null
    }
  | { kind: 'removed'; id: string }

export type RefreshOutcome =
  | { status: 'updated' }
  | { status: 'unchanged' }
  | { status: 'moved'; path: string }
  | { status: 'gone' }
  | { status: 'error' }

export interface RefreshRequest {
  id: string
  category: string
  slug: string
  knownModifiedAt: string | null
  next: ArticleLocation | null
}

export type RefreshArticle = (request: RefreshRequest) => Promise<RefreshOutcome>

export interface LiveArticleControllerOptions {
  identity: ArticleIdentity
  refresh: RefreshArticle
  onUpdated: () => void
  onMoved: (path: string) => void
  onGone: () => void
  onError: () => void
}

export interface LiveArticleController {
  handleSignal(signal: ArticleSignal): void
  /** 轮询降级用：即使没有收到事件也可以主动核对一次 */
  check(): void
  isGone(): boolean
  dispose(): void
}

/** 时间戳比较：解析不了的字符串一律当「不更新」，避免拿脏数据打后端 */
export function isNewerThan(candidate: string | null, current: string | null): boolean {
  if (!candidate) return false
  const next = Date.parse(candidate)
  if (!Number.isFinite(next)) return false
  if (!current) return true
  const base = Date.parse(current)
  if (!Number.isFinite(base)) return true
  return next > base
}

function readLocation(payload: unknown): ArticleLocation | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  const slug = record.slug
  const categoryRecord =
    typeof record.category === 'object' && record.category !== null
      ? (record.category as Record<string, unknown>)
      : null
  const category =
    (categoryRecord?.slug as unknown) ??
    (typeof record.categorySlug === 'string' ? record.categorySlug : undefined) ??
    (typeof record.category === 'string' ? record.category : undefined)

  if (!isSafeSlug(slug) || !isSafeSlug(category)) return null
  return { category, slug }
}

/**
 * 把协议信封翻译成业务信号。
 * 不处理的 event 返回 null —— 主题只关心文章增删改，不假装支持评论区实时。
 */
export function toArticleSignal(envelope: RealtimeEnvelope): ArticleSignal | null {
  switch (envelope.event) {
    case RealtimeEvents.postUpdate:
    case RealtimeEvents.postRepublish: {
      const id = readPostIdFromPayload(envelope.payload)
      if (!id) return null
      return {
        kind: 'update',
        id,
        modifiedAt: readModifiedAt(envelope.payload),
        next: readLocation(envelope.payload),
      }
    }
    case RealtimeEvents.postDelete:
    case RealtimeEvents.postUnpublish: {
      const id = readPostIdFromPayload(envelope.payload)
      if (!id) return null
      return { kind: 'removed', id }
    }
    default:
      return null
  }
}

export function createLiveArticleController(
  options: LiveArticleControllerOptions,
): LiveArticleController {
  const { identity, refresh, onUpdated, onMoved, onGone, onError } = options

  let disposed = false
  let gone = false
  let inFlight = false
  let pending = false
  let token = 0

  function apply(outcome: RefreshOutcome): void {
    switch (outcome.status) {
      case 'updated':
        onUpdated()
        break
      case 'moved':
        gone = true
        onMoved(outcome.path)
        break
      case 'gone':
        gone = true
        onGone()
        break
      case 'error':
        onError()
        break
      default:
        break
    }
  }

  async function run(): Promise<void> {
    if (disposed || gone) return
    inFlight = true
    const current = ++token
    try {
      const outcome = await refresh({
        id: identity.id,
        category: identity.category,
        slug: identity.slug,
        knownModifiedAt: identity.modifiedAt,
        next: pendingLocation,
      })
      // 过期响应：组件已卸载、文章已被判定移除，或已有更新的请求
      if (disposed || gone || current !== token) return
      apply(outcome)
    } catch {
      if (!disposed && !gone) onError()
    } finally {
      inFlight = false
      if (pending && !disposed && !gone) {
        pending = false
        void run()
      }
    }
  }

  let pendingLocation: ArticleLocation | null = null

  function request(location: ArticleLocation | null): void {
    if (disposed || gone) return
    if (location) pendingLocation = location
    if (inFlight) {
      pending = true
      return
    }
    void run()
  }

  return {
    handleSignal(signal) {
      if (disposed || gone) return
      if (signal.id !== identity.id) return
      if (signal.kind === 'removed') {
        request(null)
        return
      }
      // 同一版本或更旧的版本：重复投递/乱序投递，不产生请求
      if (signal.modifiedAt && identity.modifiedAt && !isNewerThan(signal.modifiedAt, identity.modifiedAt)) {
        return
      }
      request(signal.next)
    },

    check() {
      request(null)
    },

    isGone() {
      return gone
    },

    dispose() {
      disposed = true
    },
  }
}
