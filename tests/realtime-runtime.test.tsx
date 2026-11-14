// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => {
  const client = {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    joinArticle: vi.fn(() => () => {}),
    getState: vi.fn(() => ({ status: 'idle', attempts: 0, reason: null, error: null })),
    setLang: vi.fn(),
  }
  const release = vi.fn(() => true)
  const acquire = vi.fn((_options: { origin: string | null; lang: string }) => ({
    client,
    release,
  }))
  return { client, acquire, release }
})

vi.mock('@/lib/realtime/client', () => ({ acquireRealtimeClient: harness.acquire }))

import { RealtimeRuntime } from '@/components/realtime/realtime-runtime'
import { realtimeBus } from '@/lib/realtime/bus'

const ORIGIN = 'https://api.example.com'

beforeEach(() => {
  harness.acquire.mockClear()
  harness.release.mockClear()
  harness.client.start.mockClear()
  harness.client.pause.mockClear()
  harness.client.resume.mockClear()
  harness.client.setLang.mockClear()
  harness.client.joinArticle.mockClear()
})

afterEach(() => {
  cleanup()
  realtimeBus.attachSession(null)
})

describe('RealtimeRuntime', () => {
  it('挂载时获取连接、挂上会话并启动一次', () => {
    render(<RealtimeRuntime origin={ORIGIN} lang="zh" />)

    expect(harness.acquire).toHaveBeenCalledTimes(1)
    expect(harness.acquire.mock.calls[0]![0]).toMatchObject({ origin: ORIGIN, lang: 'zh' })
    expect(harness.client.start).toHaveBeenCalledTimes(1)

    realtimeBus.joinArticle('post-1')
    expect(harness.client.joinArticle).toHaveBeenCalledWith('post-1')
  })

  it('语言变化只改握手 query，不重建连接实例（房间订阅不丢）', () => {
    const { rerender } = render(<RealtimeRuntime origin={ORIGIN} lang="zh" />)

    rerender(<RealtimeRuntime origin={ORIGIN} lang="en" />)

    // 关键：没有重新 acquire，也就不会 stop 掉旧连接、不会清空 room 集合
    expect(harness.acquire).toHaveBeenCalledTimes(1)
    expect(harness.release).not.toHaveBeenCalled()
    expect(harness.client.setLang).toHaveBeenCalledWith('en')

    // 文章房间的业务通道仍然指向同一个 client
    realtimeBus.joinArticle('post-2')
    expect(harness.client.joinArticle).toHaveBeenCalledWith('post-2')
  })

  it('浏览器 offline 暂停、online 恢复：这是当前唯一的自动恢复入口', () => {
    render(<RealtimeRuntime origin={ORIGIN} lang="zh" />)

    window.dispatchEvent(new Event('offline'))
    expect(harness.client.pause).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('online'))
    expect(harness.client.resume).toHaveBeenCalledTimes(1)
  })

  it('origin 为 null 时不建立连接，把状态同步为 idle', () => {
    render(<RealtimeRuntime origin={null} lang="zh" />)
    expect(harness.acquire).not.toHaveBeenCalled()
    expect(harness.client.start).not.toHaveBeenCalled()
  })

  it('卸载时释放引用，连接停止后摘掉会话', () => {
    const { unmount } = render(<RealtimeRuntime origin={ORIGIN} lang="zh" />)
    unmount()

    expect(harness.release).toHaveBeenCalledTimes(1)
    realtimeBus.joinArticle('post-3')
    expect(harness.client.joinArticle).not.toHaveBeenCalled()
  })
})
