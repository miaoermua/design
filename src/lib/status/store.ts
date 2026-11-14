/**
 * 连接/错误状态（错误胶囊的数据源）
 *
 * 只保存「用户需要知道、但不该打断阅读」的状态，按优先级取最高的一条：
 *   离线网络 > 实时连接断开 > 单次请求失败
 * 恢复后短暂显示「已恢复」，然后自动消失。
 *
 * 刻意不保存任何请求细节（URL、状态码、堆栈）：胶囊是给读者的提示，
 * 不是调试面板。
 */

import type { RealtimeState } from '@/lib/realtime/client'

export type StatusKind = 'offline' | 'realtime' | 'api' | 'recovered'

export interface StatusSnapshot {
  kind: StatusKind | null
  /** 面向读者的短句，不含任何内部信息 */
  message: string
  /** 重试次数（实时连接），用于文案「第 N 次重试」 */
  attempt?: number
}

export interface StatusTimers {
  setTimeout: (handler: () => void, timeout: number) => unknown
  clearTimeout: (handle: unknown) => void
}

export interface StatusStoreOptions {
  /** 恢复提示的展示时长 */
  recoveredMs?: number
  /** 实时连接重连几次之后才提示，避免一次抖动就弹胶囊 */
  realtimeGraceAttempts?: number
  timers?: StatusTimers
}

export interface StatusStore {
  getSnapshot(): StatusSnapshot
  /** SSR / 首帧 hydration 用：服务端不展示胶囊 */
  getServerSnapshot(): StatusSnapshot
  subscribe(listener: () => void): () => void
  setNetworkOnline(online: boolean): void
  syncRealtime(state: RealtimeState): void
  reportApiFailure(): void
  reportApiSuccess(): void
  reset(): void
}

const HIDDEN: StatusSnapshot = { kind: null, message: '' }

export function createStatusStore(options: StatusStoreOptions = {}): StatusStore {
  const { recoveredMs = 4_000, realtimeGraceAttempts = 2 } = options
  const timers: StatusTimers = options.timers ?? {
    setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  }

  let online = true
  let realtimeDown = false
  let realtimeAttempt = 0
  let apiFailed = false
  let hadProblem = false
  let snapshot: StatusSnapshot = HIDDEN
  let recoverHandle: unknown = null

  const listeners = new Set<() => void>()

  function clearRecoverTimer(): void {
    if (recoverHandle !== null) {
      timers.clearTimeout(recoverHandle)
      recoverHandle = null
    }
  }

  function compute(): StatusSnapshot {
    if (!online) return { kind: 'offline', message: '网络不可用，正在等待恢复连接' }
    if (realtimeDown) {
      return {
        kind: 'realtime',
        message: '实时连接已断开，正在重试',
        attempt: realtimeAttempt,
      }
    }
    if (apiFailed) return { kind: 'api', message: '未能获取最新内容，页面显示的是稍早的版本' }
    if (hadProblem) return { kind: 'recovered', message: '连接已恢复' }
    return HIDDEN
  }

  function publish(): void {
    const next = compute()
    const same =
      next.kind === snapshot.kind &&
      next.message === snapshot.message &&
      next.attempt === snapshot.attempt
    if (same) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  function scheduleRecoveredHide(): void {
    clearRecoverTimer()
    recoverHandle = timers.setTimeout(() => {
      recoverHandle = null
      if (snapshot.kind === 'recovered') {
        hadProblem = false
        publish()
      }
    }, recoveredMs)
  }

  return {
    getSnapshot() {
      return snapshot
    },

    getServerSnapshot() {
      return HIDDEN
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    setNetworkOnline(next) {
      const wasOffline = !online
      online = next
      if (!next) {
        hadProblem = true
      } else if (wasOffline) {
        scheduleRecoveredHide()
      }
      publish()
    },

    syncRealtime(state) {
      // 'paused'（主动暂停 / 浏览器离线）与 'server-closed'（服务端关掉会话，
      // Manager 不会自动重连）都不在「正在重试」，所以不该弹「正在重试」的胶囊；
      // 这两种情况下页面仍有 HTTP 刷新兜底。
      const retrying = state.reason !== 'paused' && state.reason !== 'server-closed'
      const down =
        state.status === 'reconnecting' ||
        state.status === 'error' ||
        (state.status === 'offline' && retrying)
      realtimeAttempt = state.attempts
      // 服务端能力不满足是终态，立即提示；普通重连仍有宽限次数
      realtimeDown =
        down &&
        (state.status === 'error' ||
          state.status === 'offline' ||
          state.attempts >= realtimeGraceAttempts)
      if (realtimeDown) hadProblem = true
      else if (snapshot.kind === 'realtime') scheduleRecoveredHide()
      publish()
    },

    reportApiFailure() {
      apiFailed = true
      hadProblem = true
      publish()
    },

    reportApiSuccess() {
      if (!apiFailed) return
      apiFailed = false
      scheduleRecoveredHide()
      publish()
    },

    reset() {
      clearRecoverTimer()
      online = true
      realtimeDown = false
      realtimeAttempt = 0
      apiFailed = false
      hadProblem = false
      snapshot = HIDDEN
      for (const listener of listeners) listener()
    },
  }
}

const globalStore = globalThis as typeof globalThis & {
  __folioStatusStore?: StatusStore
}

export const statusStore: StatusStore = (globalStore.__folioStatusStore ??= createStatusStore())
