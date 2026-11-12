import { describe, expect, it, vi } from 'vitest'
import type { RealtimeState } from '@/lib/realtime/client'
import { createStatusStore, type StatusTimers } from '@/lib/status/store'

function manualTimers() {
  let seq = 0
  const pending = new Map<number, () => void>()
  const timers: StatusTimers = {
    setTimeout: (handler) => {
      const id = ++seq
      pending.set(id, handler)
      return id
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number)
    },
  }
  return {
    timers,
    runAll: () => {
      for (const [id, handler] of [...pending]) {
        pending.delete(id)
        handler()
      }
    },
  }
}

function realtimeState(patch: Partial<RealtimeState> = {}): RealtimeState {
  return { status: 'reconnecting', attempts: 1, retryInMs: 1_000, reason: 'network', ...patch }
}

describe('status store（错误胶囊）', () => {
  it('初始不显示', () => {
    const store = createStatusStore()
    expect(store.getSnapshot().kind).toBeNull()
  })

  it('断网优先于其他状态', () => {
    const store = createStatusStore()
    store.reportApiFailure()
    store.setNetworkOnline(false)
    expect(store.getSnapshot().kind).toBe('offline')

    store.syncRealtime(realtimeState({ status: 'reconnecting', attempts: 5 }))
    expect(store.getSnapshot().kind).toBe('offline')
  })

  it('实时连接第一次抖动不提示', () => {
    const store = createStatusStore({ realtimeGraceAttempts: 2 })
    store.syncRealtime(realtimeState({ attempts: 1 }))
    expect(store.getSnapshot().kind).toBeNull()
  })

  it('连续重试达到阈值后提示，并带重试次数', () => {
    const store = createStatusStore({ realtimeGraceAttempts: 2 })
    store.syncRealtime(realtimeState({ attempts: 3 }))
    expect(store.getSnapshot()).toMatchObject({ kind: 'realtime', attempt: 3 })
  })

  it('主动暂停不算故障', () => {
    const store = createStatusStore({ realtimeGraceAttempts: 1 })
    store.syncRealtime({ status: 'offline', attempts: 4, retryInMs: null, reason: 'paused' })
    expect(store.getSnapshot().kind).toBeNull()
  })

  it('请求失败提示，成功后短暂显示已恢复', () => {
    const clock = manualTimers()
    const store = createStatusStore({ timers: clock.timers, recoveredMs: 4_000 })

    store.reportApiFailure()
    expect(store.getSnapshot().kind).toBe('api')

    store.reportApiSuccess()
    expect(store.getSnapshot().kind).toBe('recovered')

    clock.runAll()
    expect(store.getSnapshot().kind).toBeNull()
  })

  it('没有失败过时成功不会弹「已恢复」', () => {
    const store = createStatusStore()
    store.reportApiSuccess()
    expect(store.getSnapshot().kind).toBeNull()
  })

  it('恢复提示不携带任何请求细节', () => {
    const store = createStatusStore()
    store.setNetworkOnline(false)
    store.setNetworkOnline(true)
    const snapshot = store.getSnapshot()
    expect(snapshot.kind).toBe('recovered')
    expect(snapshot.message).not.toMatch(/http|stack|error|api/i)
  })

  it('状态变化通知订阅者，重复设置相同状态不重复通知', () => {
    const store = createStatusStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.setNetworkOnline(false)
    expect(listener).toHaveBeenCalledTimes(1)
    store.setNetworkOnline(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reset 回到初始状态', () => {
    const store = createStatusStore()
    store.reportApiFailure()
    store.reset()
    expect(store.getSnapshot().kind).toBeNull()
  })

  it('服务端快照始终是隐藏状态', () => {
    const store = createStatusStore()
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot())
    expect(store.getServerSnapshot().kind).toBeNull()
  })
})
