// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 的工厂会被提升到文件顶部，通知桩必须跟着一起提升
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))

vi.mock('@/lib/notifications/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notifications/store')>()
  return { ...actual, notify }
})

import { ActionRail, type ActionRailProps } from '@/components/reading/action-rail'
import type { SubscribeOptions } from '@/features/interactions'

/**
 * 操作栏
 *
 * 断言的重点不是「按钮渲染出来了」，而是：请求打到了哪个地址、成功后状态怎么变、
 * 失败有没有白屏、以及有没有偷偷塞进评论这种后端不存在的能力。
 */

const DONATE = { label: '赞赏', qrcodes: [{ name: '微信', url: 'https://a.example/w.png' }] }
const SUBSCRIBE: SubscribeOptions = { enabled: true, types: ['post_c'], channels: [] }

function renderRail(overrides: Partial<ActionRailProps> = {}) {
  return render(
    <ActionRail
      id="42"
      type="Post"
      shareUrl="https://blog.example/posts/42"
      like
      subscribe={{ enabled: false, types: [], channels: [] }}
      donate={null}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  notify.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ActionRail 组成', () => {
  it('只提供 Like / Share / Subscribe / Donate 四项，没有评论入口', () => {
    const { container } = renderRail({ subscribe: SUBSCRIBE, donate: DONATE })
    const labels = Array.from(container.querySelectorAll('button')).map(
      (button) => button.textContent ?? '',
    )

    expect(labels.some((text) => text.includes('喜欢'))).toBe(true)
    expect(labels.some((text) => text.includes('分享'))).toBe(true)
    expect(labels.some((text) => text.includes('订阅'))).toBe(true)
    expect(labels.some((text) => text.includes('赞赏'))).toBe(true)
    expect(screen.queryByText(/评论/)).toBeNull()
  })

  it('订阅能力未开启时不渲染入口，也不发探测请求', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderRail()
    expect(screen.queryByText('订阅')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('只有频道、邮件订阅未开启时入口仍然渲染', () => {
    renderRail({
      subscribe: {
        enabled: false,
        types: [],
        channels: [
          {
            id: 'channel:0',
            title: 'Telegram 频道',
            url: 'https://t.me/folio_demo',
            icon: { type: 'builtin', name: 'telegram' },
            color: null,
          },
        ],
      },
    })

    expect(screen.getByRole('button', { name: /订阅/ })).toBeTruthy()
  })

  it('没有赞赏配置时不渲染 Donate', () => {
    renderRail({ donate: null })
    expect(screen.queryByText('赞赏')).toBeNull()
  })

  it('interactions 关闭时不渲染点赞入口', () => {
    renderRail({ like: false })
    expect(screen.queryByRole('button', { name: /喜欢/ })).toBeNull()
    // 分享不受影响：它不需要后端
    expect(screen.getByRole('button', { name: /分享/ })).toBeTruthy()
  })
})

describe('ActionRail 点赞', () => {
  it('POST 到 /api/interactions/like，成功后切到已喜欢并保持可读', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    renderRail()
    fireEvent.click(screen.getByRole('button', { name: /喜欢/ }))

    await waitFor(() => expect(screen.getByRole('button', { name: /已喜欢/ })).toBeTruthy())
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/interactions/like')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ id: '42', type: 'Post' })
    expect(screen.getByRole('button', { name: /已喜欢/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('已点赞后再点不会重复提交', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    renderRail()
    const like = screen.getByRole('button', { name: /喜欢/ })
    fireEvent.click(like)
    await waitFor(() => expect(screen.getByRole('button', { name: /已喜欢/ })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /已喜欢/ }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('失败时回到未点赞状态并给出错误通知，不假装成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    renderRail()
    fireEvent.click(screen.getByRole('button', { name: /喜欢/ }))

    await waitFor(() => expect(notify).toHaveBeenCalled())
    const button = screen.getByRole('button', { name: /喜欢/ })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }))
  })
})

describe('ActionRail 分享', () => {
  it('没有系统分享能力时复制 canonical 链接并提示成功', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
      share: undefined,
    })

    renderRail()
    fireEvent.click(screen.getByRole('button', { name: /分享/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://blog.example/posts/42'))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' }))
  })

  it('复制失败时提示错误而不是静默', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
      share: undefined,
    })

    renderRail()
    fireEvent.click(screen.getByRole('button', { name: /分享/ }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' })),
    )
  })

  it('用户取消系统分享不视为失败', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    vi.stubGlobal('navigator', { ...window.navigator, share })

    renderRail()
    fireEvent.click(screen.getByRole('button', { name: /分享/ }))

    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(notify).not.toHaveBeenCalled()
  })
})
