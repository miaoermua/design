// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArticleRoomJoin } from '@/components/realtime/article-room-join'
import { realtimeBus } from '@/lib/realtime/bus'

/**
 * 房间订阅的时序契约
 *
 * 这里钉的是一个真实踩过的坑：页面 effect 可能早于根布局的
 * `RealtimeRuntime` 执行，那时 `realtimeBus` 还没有 session，
 * 直接 `joinArticle()` 会被静默丢弃，日记/页面于是永远不进房间。
 * 所以组件必须等「连上过」再订阅。
 */

afterEach(() => {
  cleanup()
  realtimeBus.reset()
})

describe('ArticleRoomJoin', () => {
  it('连接建立前不订阅（此时总线还没有 session，调了也会被丢弃）', () => {
    const session = { joinArticle: vi.fn(() => vi.fn()) }
    realtimeBus.attachSession(session)

    render(<ArticleRoomJoin articleId="p1" />)
    expect(session.joinArticle).not.toHaveBeenCalled()
  })

  it('连上之后订阅当前内容，卸载时释放', () => {
    const release = vi.fn()
    const session = { joinArticle: vi.fn(() => release) }
    realtimeBus.attachSession(session)

    const { unmount } = render(<ArticleRoomJoin articleId="p1" />)

    act(() => {
      realtimeBus.updateState({ status: 'online', attempts: 0, reason: null, error: null })
    })
    expect(session.joinArticle).toHaveBeenCalledWith('p1')

    unmount()
    expect(release).toHaveBeenCalled()
  })
})
