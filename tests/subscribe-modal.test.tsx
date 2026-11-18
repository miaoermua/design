// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscribeChannel } from '@/features/interactions'

/**
 * 公有订阅弹窗（`SubscribeModal`）的独立测试
 *
 * 这个文件只测**弹窗本身**。入口层（阅读侧栏 / 首页 More）的接线在
 * `subscribe-panel.test.tsx` / `home-more.test.tsx` 里，不在这里重复。
 *
 * 收紧原则：断言尽量落到**具体元素与属性**，不用
 * `activeElement?.closest('[role="dialog"]')` 这种「只要在弹窗里就算过」
 * 的宽松写法——那会让焦点跑错地方也能通过。
 */

const system = vi.hoisted(() => ({
  getState: vi.fn(() => 'off'),
  enable: vi.fn(async () => 'on'),
  disable: vi.fn(),
}))

const notifySpy = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/lib/notifications/system', () => ({
  systemNotifications: system,
}))

vi.mock('@/lib/notifications/store', () => ({
  notify: notifySpy,
}))

import { SubscribeModal } from '@/components/ui/subscribe-modal'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  system.getState.mockReset().mockReturnValue('off')
  system.enable.mockReset().mockResolvedValue('on')
  system.disable.mockReset()
  notifySpy.mockReset().mockReturnValue(true)
})

const CHANNELS: SubscribeChannel[] = [
  {
    id: 'channel:0',
    title: 'Telegram 频道',
    url: 'https://t.me/folio_demo',
    icon: { type: 'builtin', name: 'telegram' },
    color: '#0088CC',
  },
]

/** 受控包装：把 open 状态与触发按钮一起渲染，才能测「关闭后焦点回到谁」 */
function Harness({
  types = ['post_c', 'note_c'],
  channels = [],
  initialOpen = false,
}: {
  types?: ('post_c' | 'note_c')[]
  channels?: SubscribeChannel[]
  initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <div>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        打开订阅
      </button>
      <SubscribeModal
        types={types}
        channels={channels}
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={triggerRef}
      />
    </div>
  )
}

const openVia = () => fireEvent.click(screen.getByRole('button', { name: '打开订阅' }))

describe('SubscribeModal：显隐与语义', () => {
  it('默认关闭时不渲染任何 dialog 节点', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).toBeNull()
    // 关闭态也不该渲染渠道/邮件表单，避免隐藏内容被读屏或 Tab 碰到
    expect(screen.queryByPlaceholderText('name@example.com')).toBeNull()
  })

  it('点击触发按钮后出现 dialog，并带 aria-modal 与可访问名称', () => {
    render(<Harness />)
    openVia()

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // 名称来自标题，而不是 hardcode 的 aria-label
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByRole('heading').id)
    expect(screen.getByRole('heading').textContent).toBe('订阅更新')
  })

  it('点关闭按钮关闭，并把焦点还给触发按钮', async () => {
    render(<Harness />)
    openVia()

    fireEvent.click(screen.getByRole('button', { name: '关闭订阅窗口' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: '打开订阅' })),
    )
  })

  it('Escape 关闭，并把焦点还给触发按钮', async () => {
    render(<Harness />)
    openVia()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: '打开订阅' })),
    )
  })

  it('点击遮罩关闭', () => {
    const { container } = render(<Harness />)
    openVia()

    const backdrop = container.ownerDocument.querySelector('.folio-dialog__backdrop')
    expect(backdrop).not.toBeNull()
    // 直接点 backdrop 本身（不是 panel 内部）才触发关闭
    fireEvent.mouseDown(backdrop as Element)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('SubscribeModal：焦点管理', () => {
  it('打开后焦点落在 dialog 面板本身，读屏会先播报标题与导语', async () => {
    render(<Harness />)
    openVia()

    // 精确断言：activeElement 就是 panel，不是「只要在 panel 里」
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')))
    expect((document.activeElement as HTMLElement).tabIndex).toBe(-1)
  })

  it('Tab 在弹窗内循环，不会跑到背后的页面', () => {
    render(<Harness />)
    openVia()

    const dialog = screen.getByRole('dialog')
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    expect(focusables.length).toBeGreaterThan(1)

    // 落在最后一个元素上再按 Tab → 回到第一个
    const last = focusables[focusables.length - 1]
    last.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(focusables[0])

    // 落在第一个元素上按 Shift+Tab → 回到最后一个
    focusables[0].focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})

describe('SubscribeModal：四种渠道', () => {
  it('邮件可用 + 有频道时，四块齐全', () => {
    render(<Harness channels={CHANNELS} />)
    openVia()

    expect(screen.getByText('邮件')).toBeTruthy()
    expect(screen.getByText('RSS 订阅')).toBeTruthy()
    expect(screen.getByText('浏览器通知')).toBeTruthy()
    expect(screen.getByText('频道订阅')).toBeTruthy()
  })

  it('types 为空时不渲染邮件表单，其余三块仍在', () => {
    render(<Harness types={[]} channels={CHANNELS} />)
    openVia()

    expect(screen.queryByPlaceholderText('name@example.com')).toBeNull()
    expect(screen.getByText('RSS 订阅')).toBeTruthy()
    expect(screen.getByText('浏览器通知')).toBeTruthy()
    expect(screen.getByText('频道订阅')).toBeTruthy()
  })

  it('channels 为空时不渲染频道块', () => {
    render(<Harness channels={[]} />)
    openVia()

    expect(screen.queryByText('频道订阅')).toBeNull()
  })

  it('RSS 是新窗口打开的外链，并带 rel 防护', () => {
    render(<Harness />)
    openVia()

    const link = screen.getByRole('link', { name: /feed/ })
    expect(link.getAttribute('href')).toBe('/feed')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('频道是新窗口外链，保留配置的强调色', () => {
    render(<Harness channels={CHANNELS} />)
    openVia()

    const link = screen.getByRole('link', { name: /Telegram 频道/ })
    expect(link.getAttribute('href')).toBe('https://t.me/folio_demo')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('style')).toContain('rgb(0, 136, 204)')
  })
})

describe('SubscribeModal：邮件订阅状态机', () => {
  it('一个类型都不选时本地拦下，不发请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    openVia()

    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'reader@example.com' },
    })
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: '发送确认邮件' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '至少选择一种订阅内容。')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('成功只声明「确认邮件已发送」，POST body 与所选类型一致', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    openVia()

    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'reader@example.com' },
    })
    // 只保留「新文章」一项
    const [, noteBox] = screen.getAllByRole('checkbox')
    fireEvent.click(noteBox)
    fireEvent.click(screen.getByRole('button', { name: '发送确认邮件' }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('确认邮件已发送，请查收后完成订阅。')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/interactions/subscribe')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'reader@example.com',
      types: ['post_c'],
    })
  })

  it('失败时给出可播报的错误，输入框仍可重试', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )

    render(<Harness />)
    openVia()

    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'reader@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送确认邮件' }))

    expect((await screen.findByRole('alert')).textContent).toBe('订阅请求失败，请稍后再试。')
    const input = screen.getByPlaceholderText('name@example.com') as HTMLInputElement
    expect(input.disabled).toBe(false)
    expect(screen.getByRole('button', { name: '发送确认邮件' })).toBeTruthy()
  })
})

describe('SubscribeModal：浏览器通知状态机', () => {
  const toggle = () =>
    screen.getByRole('button', { name: /未开启|已开启|浏览器已阻止|浏览器不支持/ })

  it('未开启时 aria-pressed=false，点击后申请权限并翻转状态', async () => {
    system.getState.mockReturnValue('off')
    system.enable.mockResolvedValue('on')

    render(<Harness />)
    openVia()

    const button = toggle()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)

    await waitFor(() => expect(system.enable).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toggle().getAttribute('aria-pressed')).toBe('true'))
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'success', title: '已开启浏览器通知' }),
    )
  })

  it('已开启时再点是关闭，不再次申请权限', async () => {
    system.getState.mockReturnValue('on')

    render(<Harness />)
    openVia()

    fireEvent.click(toggle())

    expect(system.disable).toHaveBeenCalledTimes(1)
    expect(system.enable).not.toHaveBeenCalled()
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info', title: '已关闭浏览器通知' }),
    )
  })

  it('被浏览器阻止时按钮禁用，并给出常驻警告', async () => {
    system.getState.mockReturnValue('off')
    system.enable.mockResolvedValue('blocked')

    render(<Harness />)
    openVia()

    fireEvent.click(toggle())

    await waitFor(() => expect((toggle() as HTMLButtonElement).disabled).toBe(true))
    expect(toggle().textContent).toBe('浏览器已阻止')
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning', durationMs: 0 }),
    )
  })

  it('浏览器不支持时按钮禁用并说明原因', () => {
    system.getState.mockReturnValue('unsupported')

    render(<Harness />)
    openVia()

    const button = toggle()
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.textContent).toBe('浏览器不支持')
  })
})
