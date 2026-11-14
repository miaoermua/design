// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// 路由实例必须是稳定引用：`LiveArticleUpdater` 的 effect 依赖里带着它
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

// 只拦掉「真正发请求」的那一层，用来数 HTTP 核对次数
const refreshMock = vi.hoisted(() => vi.fn(async () => ({ status: 'unchanged' as const })))
vi.mock('@/features/articles/live/refresh', () => ({ requestArticleRefresh: refreshMock }))

import { LiveArticleUpdater } from '@/features/articles/live/live-updater'
import { realtimeBus } from '@/lib/realtime/bus'
import type { RealtimeState } from '@/lib/realtime/client'

const FIRST = { id: 'p1', category: 'tech', slug: 'hello', modifiedAt: null }
const SECOND = { id: 'p2', category: 'tech', slug: 'world', modifiedAt: null }

const CONNECTING: RealtimeState = { status: 'connecting', attempts: 0, reason: null, error: null }
const ONLINE: RealtimeState = { status: 'online', attempts: 0, reason: null, error: null }
const RECONNECTING: RealtimeState = {
  status: 'reconnecting',
  attempts: 1,
  reason: 'network',
  error: null,
}
const OFFLINE: RealtimeState = { status: 'offline', attempts: 1, reason: 'network', error: null }

function pushState(state: RealtimeState): void {
  act(() => {
    realtimeBus.updateState(state)
  })
}

function recordJoins() {
  const order: string[] = []
  const joinArticle = vi.fn((id: string) => {
    order.push(`join:${id}`)
    return () => order.push(`leave:${id}`)
  })
  realtimeBus.attachSession({ joinArticle })
  return { order, joinArticle }
}

afterEach(() => {
  cleanup()
  realtimeBus.attachSession(null)
  realtimeBus.reset()
  refreshMock.mockClear()
  vi.useRealTimers()
})

describe('LiveArticleUpdater 房间订阅生命周期', () => {
  it('挂载时订阅当前文章房间，卸载时退订', () => {
    const { order, joinArticle } = recordJoins()

    const { unmount } = render(<LiveArticleUpdater identity={FIRST} enabled />)
    expect(joinArticle).toHaveBeenCalledWith('p1')

    unmount()
    expect(order).toEqual(['join:p1', 'leave:p1'])
  })

  it('切换到另一篇文章时先退订旧房间，再订阅新房间', () => {
    const { order } = recordJoins()

    const { rerender } = render(<LiveArticleUpdater identity={FIRST} enabled />)
    rerender(<LiveArticleUpdater identity={SECOND} enabled />)

    expect(order).toEqual(['join:p1', 'leave:p1', 'join:p2'])
  })

  it('同一篇文章的 modifiedAt 变化不重复订阅', () => {
    const { order } = recordJoins()

    const { rerender } = render(<LiveArticleUpdater identity={FIRST} enabled />)
    rerender(
      <LiveArticleUpdater
        identity={{ ...FIRST, modifiedAt: '2024-05-01T00:00:00.000Z' }}
        enabled
      />,
    )

    expect(order).toEqual(['join:p1'])
  })

  it('未启用实时能力时不订阅房间', () => {
    const { joinArticle } = recordJoins()
    render(<LiveArticleUpdater identity={FIRST} enabled={false} />)
    expect(joinArticle).not.toHaveBeenCalled()
  })

  it('连接宿主尚未挂载时挂载不抛错', () => {
    realtimeBus.attachSession(null)
    expect(() => render(<LiveArticleUpdater identity={FIRST} enabled />)).not.toThrow()
  })
})

describe('LiveArticleUpdater 恢复后的 HTTP 核对', () => {
  it('首次连接 connecting → online 不额外核对', () => {
    render(<LiveArticleUpdater identity={FIRST} enabled />)

    pushState(CONNECTING)
    pushState(ONLINE)

    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('offline → connecting → online 恰好核对一次', async () => {
    render(<LiveArticleUpdater identity={FIRST} enabled />)
    pushState(CONNECTING)
    pushState(ONLINE)
    expect(refreshMock).not.toHaveBeenCalled()

    pushState(OFFLINE)
    pushState(CONNECTING)
    pushState(ONLINE)

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
  })

  it('reconnecting → online 恰好核对一次', async () => {
    render(<LiveArticleUpdater identity={FIRST} enabled />)
    pushState(ONLINE)

    pushState(RECONNECTING)
    pushState(ONLINE)

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
  })

  it('同一次恢复重复收到 online 不会重复核对', async () => {
    render(<LiveArticleUpdater identity={FIRST} enabled />)
    pushState(ONLINE)

    pushState(RECONNECTING)
    pushState(ONLINE)
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))

    pushState(ONLINE)
    pushState(ONLINE)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
    })

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('原有 60 秒定时核对继续工作', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    render(<LiveArticleUpdater identity={FIRST} enabled />)
    pushState(ONLINE)
    pushState(OFFLINE)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('页面可见性核对与恢复核对不会背靠背执行两次', async () => {
    render(<LiveArticleUpdater identity={FIRST} enabled />)
    pushState(ONLINE)
    pushState(OFFLINE)

    // 页面重新可见：降级核对先跑一次
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))

    // 同一次恢复随后完成：不再补第二次
    pushState(CONNECTING)
    pushState(ONLINE)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
    })

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
