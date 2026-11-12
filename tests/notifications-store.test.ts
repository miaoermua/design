import { describe, expect, it, vi } from 'vitest'
import { createNotificationStore, type NotificationTimers } from '@/lib/notifications/store'

function manualTimers() {
  let seq = 0
  const pending = new Map<number, () => void>()
  const timers: NotificationTimers = {
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
    size: () => pending.size,
  }
}

describe('notification store', () => {
  it('默认按级别给不同时长', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 1_000 })
    const info = store.notify({ level: 'info', title: '文章已更新' })
    const error = store.notify({ level: 'error', title: '出错了' })

    const items = store.getSnapshot()
    expect(items.find((item) => item.id === info)?.expiresAt).toBe(6_000)
    expect(items.find((item) => item.id === error)?.expiresAt).toBe(9_000)
  })

  it('显式 durationMs 覆盖默认值，0 表示手动关闭', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    store.notify({ level: 'warning', title: '需要处理', durationMs: 0 })
    expect(store.getSnapshot()[0]?.expiresAt).toBeNull()
  })

  it('相同标题在去重窗口内只出现一次', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    expect(store.notify({ level: 'error', title: '连接失败' })).not.toBeNull()
    expect(store.notify({ level: 'error', title: '连接失败' })).toBeNull()
    expect(store.getSnapshot()).toHaveLength(1)
  })

  it('不同级别同名通知互不去重', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    store.notify({ level: 'info', title: '同步' })
    store.notify({ level: 'success', title: '同步' })
    expect(store.getSnapshot()).toHaveLength(2)
  })

  it('超出 maxVisible 时挤掉最旧的非错误通知', () => {
    const clock = manualTimers()
    const store = createNotificationStore({
      timers: clock.timers,
      now: () => 0,
      maxVisible: 3,
    })
    store.notify({ level: 'info', title: 'a' })
    store.notify({ level: 'info', title: 'b' })
    store.notify({ level: 'error', title: 'c' })
    store.notify({ level: 'info', title: 'd' })

    const titles = store.getSnapshot().map((item) => item.title)
    expect(titles).toEqual(['b', 'c', 'd'])
  })

  it('全是错误时仍按旧到新挤掉', () => {
    const clock = manualTimers()
    const store = createNotificationStore({
      timers: clock.timers,
      now: () => 0,
      maxVisible: 2,
    })
    store.notify({ level: 'error', title: 'a' })
    store.notify({ level: 'error', title: 'b' })
    store.notify({ level: 'error', title: 'c' })
    expect(store.getSnapshot().map((item) => item.title)).toEqual(['b', 'c'])
  })

  it('到时间自动消失', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    store.notify({ level: 'info', title: 'a' })
    clock.runAll()
    expect(store.getSnapshot()).toHaveLength(0)
  })

  it('手动关闭会取消计时器', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    const id = store.notify({ level: 'info', title: 'a' })
    store.dismiss(id!)
    expect(clock.size()).toBe(0)
    clock.runAll()
    expect(store.getSnapshot()).toHaveLength(0)
  })

  it('clear 清空全部并取消计时器', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    store.notify({ level: 'info', title: 'a' })
    store.notify({ level: 'error', title: 'b' })
    store.clear()
    expect(store.getSnapshot()).toHaveLength(0)
    expect(clock.size()).toBe(0)
  })

  it('空标题被拒绝', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    expect(store.notify({ level: 'info', title: '   ' })).toBeNull()
  })

  it('订阅者收到变化，退订后不再收到', () => {
    const clock = manualTimers()
    const store = createNotificationStore({ timers: clock.timers, now: () => 0 })
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.notify({ level: 'info', title: 'a' })
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    store.notify({ level: 'info', title: 'b' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('服务端快照是稳定的空列表', () => {
    const store = createNotificationStore()
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot())
    expect(store.getServerSnapshot()).toHaveLength(0)
  })
})
