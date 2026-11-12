import { describe, expect, it, vi } from 'vitest'
import { createRealtimeBus } from '@/lib/realtime/bus'
import type { RealtimeState } from '@/lib/realtime/client'

const CONNECTING: RealtimeState = {
  status: 'connecting',
  attempts: 0,
  retryInMs: null,
  reason: null,
}

function online(attempts = 0): RealtimeState {
  return { status: 'online', attempts, retryInMs: null, reason: null }
}

describe('realtime bus', () => {
  it('服务端快照是固定对象，多次读取不变化', () => {
    const bus = createRealtimeBus()
    expect(bus.getServerSnapshot()).toBe(bus.getServerSnapshot())
    expect(bus.getServerSnapshot().state.status).toBe('idle')
    expect(bus.getServerSnapshot().everConnected).toBe(false)
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
    bus.emit({ v: 1, event: 'post.update', payload: { id: 'p1' } })
    expect(good).toHaveBeenCalledTimes(1)
  })

  it('emit 记录最近事件时间', () => {
    const bus = createRealtimeBus()
    expect(bus.getSnapshot().lastEventAt).toBeNull()
    bus.emit({ v: 1, event: 'post.update' })
    expect(typeof bus.getSnapshot().lastEventAt).toBe('number')
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

  it('reset 清空快照与会话', () => {
    const bus = createRealtimeBus()
    const joinArticle = vi.fn(() => () => {})
    bus.attachSession({ joinArticle })
    bus.updateState(online())
    bus.reset()

    expect(bus.getSnapshot().state.status).toBe('idle')
    expect(bus.getSnapshot().everConnected).toBe(false)
    bus.joinArticle('p1')
    expect(joinArticle).not.toHaveBeenCalled()
  })

  it('连接状态不作为订阅前提', () => {
    const bus = createRealtimeBus()
    bus.updateState(CONNECTING)
    expect(bus.getSnapshot().state.status).toBe('connecting')
  })
})
