/**
 * 通知队列（框架无关）
 *
 * 与实时连接完全解耦：任何模块都能 `notify()`，Toaster 只负责渲染。
 * 队列语义：
 * - 最多同时显示 `maxVisible` 条，超出时挤掉最旧的一条（错误优先保留）。
 * - 相同 `dedupeKey`（默认 level + title）在 `dedupeWindowMs` 内只出现一次，
 *   避免重连抖动把同一条错误刷满屏幕。
 * - 计时器可注入，测试里不用真的等 5 秒。
 */

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationAction {
  label: string
  href: string
}

export interface NotificationInput {
  level: NotificationLevel
  title: string
  description?: string
  /** 毫秒；0 或负数表示不自动关闭 */
  durationMs?: number
  dedupeKey?: string
  action?: NotificationAction
}

export interface NotificationItem extends NotificationInput {
  id: string
  createdAt: number
  expiresAt: number | null
}

export interface NotificationTimers {
  setTimeout: (handler: () => void, timeout: number) => unknown
  clearTimeout: (handle: unknown) => void
}

export interface NotificationStoreOptions {
  maxVisible?: number
  defaultDurationMs?: number
  errorDurationMs?: number
  dedupeWindowMs?: number
  timers?: NotificationTimers
  now?: () => number
}

export interface NotificationStore {
  notify(input: NotificationInput): string | null
  dismiss(id: string): void
  clear(): void
  getSnapshot(): readonly NotificationItem[]
  /** SSR / 首帧 hydration 用；服务端不会有通知 */
  getServerSnapshot(): readonly NotificationItem[]
  subscribe(listener: () => void): () => void
}

const EMPTY: readonly NotificationItem[] = []

const LEVEL_DEFAULT_DURATION: Record<NotificationLevel, number> = {
  info: 5_000,
  success: 4_000,
  warning: 7_000,
  error: 8_000,
}

export function createNotificationStore(options: NotificationStoreOptions = {}): NotificationStore {
  const {
    maxVisible = 3,
    dedupeWindowMs = 5_000,
  } = options
  const now = options.now ?? Date.now
  const timers: NotificationTimers = options.timers ?? {
    setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  }

  let items: readonly NotificationItem[] = []
  const listeners = new Set<() => void>()
  const handles = new Map<string, unknown>()
  const lastDedupe = new Map<string, number>()
  let seq = 0

  function emit(): void {
    for (const listener of listeners) listener()
  }

  function disarm(id: string): void {
    const handle = handles.get(id)
    if (handle !== undefined) {
      timers.clearTimeout(handle)
      handles.delete(id)
    }
  }

  function remove(id: string): void {
    if (!items.some((item) => item.id === id)) return
    disarm(id)
    items = items.filter((item) => item.id !== id)
    emit()
  }

  function arm(item: NotificationItem): void {
    if (item.expiresAt === null) return
    const delay = Math.max(0, item.expiresAt - now())
    handles.set(
      item.id,
      timers.setTimeout(() => {
        handles.delete(item.id)
        remove(item.id)
      }, delay),
    )
  }

  function durationFor(level: NotificationLevel, durationMs?: number): number {
    if (typeof durationMs === 'number') return durationMs
    return LEVEL_DEFAULT_DURATION[level] ?? 5_000
  }

  return {
    notify(input) {
      const title = input.title.trim()
      if (!title) return null

      const key = input.dedupeKey ?? `${input.level}:${title}`
      const timestamp = now()
      const previous = lastDedupe.get(key)
      if (previous !== undefined && timestamp - previous < dedupeWindowMs) return null
      lastDedupe.set(key, timestamp)

      const duration = durationFor(input.level, input.durationMs)
      const item: NotificationItem = {
        ...input,
        title,
        id: `n${++seq}`,
        createdAt: timestamp,
        expiresAt: duration > 0 ? timestamp + duration : null,
      }

      const next = [...items, item]
      // 超员时挤掉最旧的一条，但错误优先保留
      while (next.length > maxVisible) {
        const index = next.findIndex((candidate) => candidate.level !== 'error')
        const [dropped] = next.splice(index === -1 ? 0 : index, 1)
        if (dropped) disarm(dropped.id)
      }

      items = next
      arm(item)
      emit()
      return item.id
    },

    dismiss(id) {
      remove(id)
    },

    clear() {
      for (const item of items) disarm(item.id)
      items = []
      emit()
    },

    getSnapshot() {
      return items
    },

    getServerSnapshot() {
      return EMPTY
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const globalStore = globalThis as typeof globalThis & {
  __folioNotificationStore?: NotificationStore
}

export const notificationStore: NotificationStore = (globalStore.__folioNotificationStore ??=
  createNotificationStore())

/** 供任意模块调用；返回 null 表示被去重或标题为空 */
export function notify(input: NotificationInput): string | null {
  return notificationStore.notify(input)
}
