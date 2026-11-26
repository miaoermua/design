// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
}))

import { FooterPresence } from '@/components/layout/footer-presence'
import { realtimeBus } from '@/lib/realtime/bus'

/**
 * 页脚在线状态 + 悬停预览
 *
 * 这里用**真实的** realtime bus，只喂 `visitor-online` 事件：
 * 组件与 `useRealtimeOnline()` 的接线本身也在测试范围内，
 * 如果哪天快照字段改名，这些用例会直接红。
 */

const entriesPayload = {
  entries: [
    { title: 'AI 把 Adobe 的软件复刻了一遍？', href: '/articles/blog/photocraft', viewers: 2 },
    { title: '关于本站', href: '/pages/about-site', viewers: 1 },
  ],
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(handler)
  vi.stubGlobal('fetch', spy)
  return spy
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

/** 在线人数由总线事件驱动，与生产路径一致 */
function setOnline(count: number) {
  act(() => {
    realtimeBus.emit({ kind: 'visitor-online', online: count, timestamp: null })
  })
}

function hover(container: HTMLElement, type: 'enter' | 'leave', pointerType = 'mouse') {
  const trigger = container.querySelector('.footer-presence')
  if (!trigger) throw new Error('presence trigger not rendered')
  // React 的 onPointerEnter/Leave 由 pointerover/pointerout 合成，直接派发 enter 不会触发
  const fire = type === 'enter' ? fireEvent.pointerOver : fireEvent.pointerOut
  act(() => {
    fire(trigger, { pointerType, relatedTarget: document.body })
  })
}

function focusableTrigger(container: HTMLElement): HTMLElement {
  const trigger = container.querySelector<HTMLElement>('.footer-presence__trigger')
  if (!trigger) throw new Error('presence trigger not rendered')
  return trigger
}

/** jsdom 的 focus() 总带 :focus-visible；触屏场景需要显式关掉它 */
function stubFocusVisible(value: boolean): void {
  const original = HTMLElement.prototype.matches
  vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
    this: HTMLElement,
    selector,
  ) {
    return selector === ':focus-visible' ? value : original.call(this, selector)
  })
}

beforeEach(() => {
  realtimeBus.reset()
  route.pathname = '/'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('在线状态', () => {
  it('没收到 VISITOR_ONLINE 时不渲染任何东西（首帧 / 未连接 / 服务端不支持）', () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)

    expect(container.querySelector('.footer-presence')).toBeNull()
    expect(screen.queryByText(/在线/)).toBeNull()
    // 而且不能顺手打接口
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('收到人数后只显示状态点与人数，不预先展示阅读列表', () => {
    mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    expect(container.querySelector('.footer-presence__count')?.textContent).toBe('3 个在线连接')
    expect(screen.queryByText('AI 把 Adobe 的软件复刻了一遍？')).toBeNull()
  })
})

describe('悬停预览', () => {
  it('悬停才请求接口，展开后按内容聚合展示标题与人数', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    hover(container, 'enter')

    await waitFor(() => {
      expect(screen.getByText('AI 把 Adobe 的软件复刻了一遍？')).toBeTruthy()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/presence')
    expect(screen.getByText('2 个连接')).toBeTruthy()
    expect(screen.getByText('1 个连接')).toBeTruthy()
    // 条目指向站内地址
    const hrefs = [...container.querySelectorAll('.footer-presence__link')].map((link) =>
      link.getAttribute('href'),
    )
    expect(hrefs).toEqual(['/articles/blog/photocraft', '/pages/about-site'])
  })

  it('没有访客内容时给一句空状态，而不是空白浮层', async () => {
    mockFetch(() => jsonResponse({ entries: [] }))
    const { container } = render(<FooterPresence />)
    setOnline(1)

    hover(container, 'enter')
    await waitFor(() => {
      expect(screen.getByText('此刻没有其他在线连接')).toBeTruthy()
    })
  })

  it('接口失败时降级成一句提示，不抛错、不挡住页脚', async () => {
    mockFetch(() => jsonResponse({ entries: [], failed: true }, 500))
    const { container } = render(<FooterPresence />)
    setOnline(2)

    hover(container, 'enter')
    await waitFor(() => {
      expect(screen.getByText('在线连接数据暂时不可用')).toBeTruthy()
    })
    // 状态点仍然在
    expect(container.querySelector('.footer-presence__count')?.textContent).toBe('2 个在线连接')
  })

  it('BFF 静默降级（200 + failed:true）也显示失败提示，不当成空列表', async () => {
    mockFetch(() => jsonResponse({ entries: [], failed: true }))
    const { container } = render(<FooterPresence />)
    setOnline(2)

    hover(container, 'enter')
    await waitFor(() => {
      expect(screen.getByText('在线连接数据暂时不可用')).toBeTruthy()
    })
    expect(screen.queryByText('此刻没有其他在线连接')).toBeNull()
  })

  it('切换页面后旧房间快照立即作废，重新读取当前数据', async () => {
    let calls = 0
    let resolveSecond: ((value: Response) => void) | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        calls += 1
        if (calls === 1) return jsonResponse(entriesPayload)
        return new Promise<Response>((resolve) => {
          resolveSecond = resolve
        })
      }),
    )
    const { container } = render(<FooterPresence />)
    setOnline(3)

    hover(container, 'enter')
    await waitFor(() => {
      expect(screen.getByText('AI 把 Adobe 的软件复刻了一遍？')).toBeTruthy()
    })
    expect(calls).toBe(1)

    act(() => {
      route.pathname = '/notes/1'
      // mock 的 usePathname 不订阅外部变更，用一次总线更新触发同样的重渲染
      setOnline(3)
    })
    await waitFor(() => {
      expect(screen.getByText('读取中…')).toBeTruthy()
    })
    expect(screen.queryByText('AI 把 Adobe 的软件复刻了一遍？')).toBeNull()
    expect(calls).toBe(2)

    await act(async () => {
      resolveSecond?.(await jsonResponse({ entries: [] }))
    })
    await waitFor(() => {
      expect(screen.getByText('此刻没有其他在线连接')).toBeTruthy()
    })
  })

  it('快速移出再移入：旧响应不会覆盖新请求的数据', async () => {
    let calls = 0
    let resolveFirst: ((value: Response) => void) | null = null
    const stale = { entries: [{ title: '旧快照', href: '/stale', viewers: 9 }] }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        calls += 1
        if (calls === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirst = resolve
          })
        }
        return jsonResponse(entriesPayload)
      }),
    )
    const { container } = render(<FooterPresence />)
    setOnline(3)

    hover(container, 'enter')
    hover(container, 'leave')
    hover(container, 'enter')

    await waitFor(() => {
      expect(screen.getByText('AI 把 Adobe 的软件复刻了一遍？')).toBeTruthy()
    })
    expect(calls).toBe(2)

    await act(async () => {
      resolveFirst?.(await jsonResponse(stale))
    })
    expect(screen.queryByText('旧快照')).toBeNull()
    expect(screen.getByText('AI 把 Adobe 的软件复刻了一遍？')).toBeTruthy()
  })

  it('移出后关闭浮层，不再继续刷新', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    hover(container, 'enter')
    await waitFor(() => {
      expect(container.querySelector('.footer-presence__panel')).not.toBeNull()
    })

    hover(container, 'leave')
    expect(container.querySelector('.footer-presence__panel')).toBeNull()

    const calls = fetchSpy.mock.calls.length
    // 关闭后计时器已经清掉：再等一轮也不会多请求
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(fetchSpy).toHaveBeenCalledTimes(calls)
  })

  it('触屏 / 手写笔不展开（移动端只保留状态点）', () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(2)

    hover(container, 'enter', 'touch')
    expect(container.querySelector('.footer-presence__panel')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('接口返回脏数据时整份丢弃，显示不可用而不是渲染坏链接', async () => {
    mockFetch(() =>
      jsonResponse({
        entries: [
          { title: '外部地址', href: 'https://evil.example', viewers: 2 },
          { title: '人数非法', href: '/x', viewers: 0 },
          { title: '正常', href: '/y', viewers: 1 },
        ],
      }),
    )
    const { container } = render(<FooterPresence />)
    setOnline(1)

    hover(container, 'enter')
    await waitFor(() => {
      expect(screen.getByText('正常')).toBeTruthy()
    })

    const hrefs = [...container.querySelectorAll('.footer-presence__link')].map((link) =>
      link.getAttribute('href'),
    )
    expect(hrefs).toEqual(['/y'])
  })
})

describe('键盘可访问性', () => {
  it('Tab 聚焦触发器即展开，不增加点击处理', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    const trigger = focusableTrigger(container)
    expect(trigger.getAttribute('tabindex')).toBe('0')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.footer-presence__panel')).toBeNull()

    act(() => trigger.focus())

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.footer-presence__panel')).not.toBeNull()
    // 没有 onClick 之类的点击展开入口
    expect(trigger.getAttribute('role')).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByText('AI 把 Adobe 的软件复刻了一遍？')).toBeTruthy()
    })
  })

  it('焦点进入浮层保持打开，离开整个区域才关闭', async () => {
    mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    act(() => focusableTrigger(container).focus())
    const link = await screen.findByText('AI 把 Adobe 的软件复刻了一遍？')
    act(() => link.focus())

    expect(container.querySelector('.footer-presence__panel')).not.toBeNull()
    expect(focusableTrigger(container).getAttribute('aria-expanded')).toBe('true')

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    try {
      act(() => outside.focus())
      expect(container.querySelector('.footer-presence__panel')).toBeNull()
      expect(focusableTrigger(container).getAttribute('aria-expanded')).toBe('false')
    } finally {
      outside.remove()
    }
  })

  it('Escape 关闭浮层并把焦点留在触发器上', async () => {
    mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    const trigger = focusableTrigger(container)
    act(() => trigger.focus())
    const link = await screen.findByText('AI 把 Adobe 的软件复刻了一遍？')
    act(() => link.focus())

    fireEvent.keyDown(link, { key: 'Escape' })

    expect(container.querySelector('.footer-presence__panel')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('鼠标 hover 行为保留；键盘焦点在区域内时鼠标移出不关闭', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    const { container } = render(<FooterPresence />)
    setOnline(3)

    hover(container, 'enter')
    await waitFor(() => {
      expect(container.querySelector('.footer-presence__panel')).not.toBeNull()
    })
    // 先确认原来的 hover 移出仍然关闭
    hover(container, 'leave')
    expect(container.querySelector('.footer-presence__panel')).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // 焦点在区域内时，鼠标移出不应抢走键盘用户的浮层
    hover(container, 'enter')
    act(() => focusableTrigger(container).focus())
    hover(container, 'leave')
    expect(container.querySelector('.footer-presence__panel')).not.toBeNull()
  })

  it('触屏聚焦不展开、不请求（移动端只保留状态点）', () => {
    const fetchSpy = mockFetch(() => jsonResponse(entriesPayload))
    stubFocusVisible(false)
    const { container } = render(<FooterPresence />)
    setOnline(2)

    hover(container, 'enter', 'touch')
    act(() => focusableTrigger(container).focus())

    expect(container.querySelector('.footer-presence__panel')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
