/**
 * 实时事件总线与状态快照（进程内单例）
 *
 * 为什么是单例而不是 React Context：
 * - 连接必须全站唯一，放在 `layout` 里用 Provider 包住 `children` 会把整棵
 *   RSC 子树变成客户端组件的 children，没必要。
 * - 文章页的订阅者与连接宿主不在同一棵子树里，模块级单例让两边都能订阅。
 *
 * 这个模块只做状态与事件中转，不 import 任何 React，也不在 import 阶段碰浏览器
 * API —— SSR 引入它是安全的。业务组件拿到的是类型化的 `RealtimeEvent`，
 * 不会看到 Socket.IO 帧或 `message` 事件名。
 */

import type { RealtimeState } from './client'
import { readCountKey, type RealtimeEvent } from './protocol'

export interface RealtimeSnapshot {
  state: RealtimeState
  /** 最近一次收到业务事件的时间戳；没有则为 null */
  lastEventAt: number | null
  /** 已建立过连接（用于区分「还没连」和「连过又断了」） */
  everConnected: boolean
  /** VISITOR_ONLINE / VISITOR_OFFLINE 下发的在线人数；未收到为 null */
  online: number | null
  /** ARTICLE_READ_COUNT_UPDATE：按 `${articleType}:${id}` 关联的阅读数 */
  readCounts: Readonly<Record<string, number>>
}

export type RealtimeEventListener = (event: RealtimeEvent) => void
export type RealtimeStateListener = () => void

const EMPTY_READ_COUNTS: Readonly<Record<string, number>> = Object.freeze({})

const INITIAL_STATE: RealtimeState = {
  status: 'idle',
  attempts: 0,
  reason: null,
  error: null,
}

/** 连接宿主注册给总线的能力；页面组件通过它订阅文章房间 */
export interface RealtimeSession {
  joinArticle(articleId: string): () => void
}

export interface RealtimeBus {
  getSnapshot(): RealtimeSnapshot
  /** SSR / 首帧 hydration 用的稳定快照，避免服务端与客户端快照不一致 */
  getServerSnapshot(): RealtimeSnapshot
  subscribe(listener: RealtimeStateListener): () => void
  onEvent(listener: RealtimeEventListener): () => void
  emit(event: RealtimeEvent): void
  updateState(state: RealtimeState): void
  /** 连接宿主挂载/卸载时注册；重复注册表示旧宿主已被替换 */
  attachSession(session: RealtimeSession | null): void
  /** 加入文章房间；没有连接时返回空操作（重连后由 client 自己补订阅） */
  joinArticle(articleId: string): () => void
  reset(): void
}

const SERVER_SNAPSHOT: RealtimeSnapshot = {
  state: INITIAL_STATE,
  lastEventAt: null,
  everConnected: false,
  online: null,
  readCounts: EMPTY_READ_COUNTS,
}

function createInitialSnapshot(): RealtimeSnapshot {
  return {
    state: INITIAL_STATE,
    lastEventAt: null,
    everConnected: false,
    online: null,
    readCounts: EMPTY_READ_COUNTS,
  }
}

/** 只让已知业务事件影响统计状态，不把原始 data 透传给 UI */
function applyEvent(
  snapshot: RealtimeSnapshot,
  event: RealtimeEvent,
): Pick<RealtimeSnapshot, 'online' | 'readCounts'> {
  switch (event.kind) {
    case 'visitor-online':
    case 'visitor-offline':
      return { online: event.online, readCounts: snapshot.readCounts }
    case 'read-count-update': {
      const key = readCountKey(event.articleType, event.id)
      if (snapshot.readCounts[key] === event.count) {
        return { online: snapshot.online, readCounts: snapshot.readCounts }
      }
      return {
        online: snapshot.online,
        readCounts: { ...snapshot.readCounts, [key]: event.count },
      }
    }
    default:
      return { online: snapshot.online, readCounts: snapshot.readCounts }
  }
}

export function createRealtimeBus(): RealtimeBus {
  let snapshot: RealtimeSnapshot = createInitialSnapshot()
  const stateListeners = new Set<RealtimeStateListener>()
  const eventListeners = new Set<RealtimeEventListener>()
  let session: RealtimeSession | null = null

  function notify(): void {
    for (const listener of stateListeners) listener()
  }

  return {
    getSnapshot() {
      return snapshot
    },

    getServerSnapshot() {
      return SERVER_SNAPSHOT
    },

    subscribe(listener) {
      stateListeners.add(listener)
      return () => {
        stateListeners.delete(listener)
      }
    },

    onEvent(listener) {
      eventListeners.add(listener)
      return () => {
        eventListeners.delete(listener)
      }
    },

    emit(event) {
      const stats = applyEvent(snapshot, event)
      snapshot = {
        ...snapshot,
        ...stats,
        lastEventAt: Date.now(),
      }
      for (const listener of eventListeners) {
        try {
          listener(event)
        } catch {
          // 单个订阅者出错不能影响其他订阅者
        }
      }
      notify()
    },

    updateState(state) {
      const sameStatus = snapshot.state.status === state.status
      const sameReason = snapshot.state.reason === state.reason
      const sameError = snapshot.state.error?.kind === state.error?.kind
      if (sameStatus && sameReason && sameError && snapshot.everConnected) {
        // attempts 变化不触发重渲染：界面上只关心「连上了没有」
        snapshot = { ...snapshot, state }
        return
      }
      snapshot = {
        ...snapshot,
        state,
        everConnected: snapshot.everConnected || state.status === 'online',
      }
      notify()
    },

    attachSession(next) {
      session = next
    },

    joinArticle(articleId) {
      if (!session) return () => {}
      return session.joinArticle(articleId)
    },

    reset() {
      snapshot = createInitialSnapshot()
      session = null
      notify()
    },
  }
}

const globalStore = globalThis as typeof globalThis & {
  __folioRealtimeBus?: RealtimeBus
}

/** 全局单例：HMR 与多次 import 都拿同一个 */
export const realtimeBus: RealtimeBus = (globalStore.__folioRealtimeBus ??= createRealtimeBus())
