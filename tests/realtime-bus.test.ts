import { describe, expect, it, vi } from 'vitest'
import { createRealtimeBus } from '@/lib/realtime/bus'
import type { RealtimeState } from '@/lib/realtime/client'
import type { RealtimeEvent } from '@/lib/realtime/protocol'

const CONNECTING: RealtimeState = {
  status: 'connecting',
  attempts: 0,
  reason: null,
  error: null,
}

function online(attempts = 0): RealtimeState {
  return { status: 'online', attempts, reason: null, error: null }
}

const update: RealtimeEvent = {
  kind: 'article-update',
  id: 'p1',
  modifiedAt: null,
  next: null,
}

describe('realtime bus', () => {
  it('服务端快照是固定对象，且不含客户端统计', () => {
    const bus = createRealtimeBus()
    expect(bus.getServerSnapshot()).toBe(bus.getServerSnapshot())
    expect(bus.getServerSnapshot().state.status).toBe('idle')
    expect(bus.getServerSnapshot().everConnected).toBe(false)
    expect(bus.getServerSnapshot().online).toBeNull()
    expect(bus.getServerSnapshot().readCounts).toEqual({})
  })

  it('状态变化会通知订阅者', () => {
    const bus = createRealtimeBus()
    const listener = vi.fn()
    bus.subscribe(listener)
    bus.updateState(online())
    expect(listener).toHaveBeenCalledTimes(1)
    expect(bus.getSnapshot().state.status).toBe('online')
    expect(bus.getSnapshot().everConnected).toBe(true)
  })

  it('只有 attempts 变化时不触发重渲染', () => {
    const bus = createRealtimeBus()
    bus.updateState(online())
    const listener = vi.fn()
    bus.subscribe(listener)
    bus.updateState({ ...online(), attempts: 3 })
    expect(listener).not.toHaveBeenCalled()
    expect(bus.getSnapshot().state.attempts).toBe(3)
  })

  it('错误类别变化会通知订阅者', () => {
    const bus = createRealtimeBus()
    bus.updateState(online())
    const listener = vi.fn()
    bus.subscribe(listener)
    bus.updateState({
      status: 'error',
      attempts: 0,
      reason: null,
      error: { kind: 'unsupported-server', message: 'Invalid namespace' },
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('退订后不再收到通知', () => {
    const bus = createRealtimeBus()
    const listener = vi.fn()
    const off = bus.subscribe(listener)
    off()
    bus.updateState(online())
    expect(listener).not.toHaveBeenCalled()
  })

  it('单个订阅者抛错不影响其他订阅者', () => {
    const bus = createRealtimeBus()
    const good = vi.fn()
    bus.onEvent(() => {
      throw new Error('boom')
    })
    bus.onEvent(good)
    bus.emit(update)
    expect(good).toHaveBeenCalledTimes(1)
  })

  it('emit 记录最近事件时间', () => {
    const bus = createRealtimeBus()
    expect(bus.getSnapshot().lastEventAt).toBeNull()
    bus.emit(update)
    expect(typeof bus.getSnapshot().lastEventAt).toBe('number')
  })

  it('VISITOR_ONLINE / VISITOR_OFFLINE 更新已有状态快照里的在线人数', () => {
    const bus = createRealtimeBus()
    bus.emit({ kind: 'visitor-online', online: 7, timestamp: '2024-05-01T00:00:00.000Z' })
    expect(bus.getSnapshot().online).toBe(7)
    bus.emit({ kind: 'visitor-offline', online: 6, timestamp: null })
    expect(bus.getSnapshot().online).toBe(6)
  })

  it('ARTICLE_READ_COUNT_UPDATE 按类型 + id 关联，不同类型同 id 不串数', () => {
    const bus = createRealtimeBus()
    bus.emit({ kind: 'read-count-update', articleType: 'post', id: 'x', count: 10 })
    bus.emit({ kind: 'read-count-update', articleType: 'note', id: 'x', count: 3 })
    bus.emit({ kind: 'read-count-update', articleType: 'post', id: 'x', count: 11 })

    expect(bus.getSnapshot().readCounts).toEqual({ 'post:x': 11, 'note:x': 3 })
  })

  it('非统计事件不改变统计状态', () => {
    const bus = createRealtimeBus()
    bus.emit({ kind: 'visitor-online', online: 4, timestamp: null })
    const before = bus.getSnapshot().readCounts
    bus.emit(update)
    bus.emit({ kind: 'gateway-connect', greeting: 'WebSocket 已连接' })
    expect(bus.getSnapshot().online).toBe(4)
    expect(bus.getSnapshot().readCounts).toBe(before)
  })

  it('没有连接宿主时 joinArticle 是空操作', () => {
    const bus = createRealtimeBus()
    expect(() => bus.joinArticle('p1')()).not.toThrow()
  })

  it('连接宿主注册后 joinArticle 转交给它，并返回退订函数', () => {
    const bus = createRealtimeBus()
    const release = vi.fn()
    const joinArticle = vi.fn(() => release)
    bus.attachSession({ joinArticle })

    const leave = bus.joinArticle('p1')
    expect(joinArticle).toHaveBeenCalledWith('p1')
    leave()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('宿主卸载后不再转交', () => {
    const bus = createRealtimeBus()
    const joinArticle = vi.fn(() => () => {})
    bus.attachSession({ joinArticle })
    bus.attachSession(null)
    bus.joinArticle('p1')
    expect(joinArticle).not.toHaveBeenCalled()
  })

  it('reset 清空快照、统计与会话', () => {
    const bus = createRealtimeBus()
    const joinArticle = vi.fn(() => () => {})
    bus.attachSession({ joinArticle })
    bus.updateState(online())
    bus.emit({ kind: 'visitor-online', online: 9, timestamp: null })
    bus.emit({ kind: 'read-count-update', articleType: 'post', id: 'p1', count: 5 })
    bus.reset()

    expect(bus.getSnapshot().state.status).toBe('idle')
    expect(bus.getSnapshot().everConnected).toBe(false)
    expect(bus.getSnapshot().online).toBeNull()
    expect(bus.getSnapshot().readCounts).toEqual({})
    bus.joinArticle('p1')
    expect(joinArticle).not.toHaveBeenCalled()
  })

  it('连接状态不作为订阅前提', () => {
    const bus = createRealtimeBus()
    bus.updateState(CONNECTING)
    expect(bus.getSnapshot().state.status).toBe('connecting')
  })
})
