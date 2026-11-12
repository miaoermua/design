// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscribePanel } from '@/components/reading/subscribe-panel'
import type { SubscribeChannel } from '@/features/interactions'

/**
 * 订阅面板
 *
 * core 的邮件订阅是「发确认邮件」而不是「立即生效」，所以断言里刻意区分：
 * 成功文案只能说已发送确认邮件，不能说订阅成功。
 *
 * 三种方式的能力边界也在这里固定：邮件有表单、RSS 只有地址、频道只是外链，
 * 后两者都不该出现「已订阅」这种站内状态。
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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

function openPanel(props: Partial<Parameters<typeof SubscribePanel>[0]> = {}) {
  render(<SubscribePanel types={['post_c', 'note_c']} channels={[]} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /订阅/ }))
  return screen.getByRole('dialog', { name: '订阅方式' })
}

describe('SubscribePanel 三种订阅方式', () => {
  it('邮件、RSS、频道同时存在时三块都在', () => {
    openPanel({ channels: CHANNELS })

    expect(screen.getByLabelText('邮箱地址')).toBeTruthy()
    expect(screen.getByRole('link', { name: /\/feed\.xml/ }).getAttribute('href')).toBe('/feed.xml')
    expect(screen.getByRole('link', { name: /Telegram 频道/ }).getAttribute('href')).toBe(
      'https://t.me/folio_demo',
    )
  })

  it('频道链接是新窗口打开的外部地址，并带上来源信息', () => {
    openPanel({ channels: CHANNELS })
    const link = screen.getByRole('link', { name: /Telegram 频道/ })

    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('没有配置频道时不渲染频道区块，也不留空标题', () => {
    openPanel()
    expect(screen.queryByText('频道订阅')).toBeNull()
    expect(screen.getByText('RSS')).toBeTruthy()
  })

  it('邮件订阅不可用、只剩频道时，焦点落在面板上而不是丢失', async () => {
    const dialog = openPanel({ types: [], channels: CHANNELS })

    expect(screen.queryByLabelText('邮箱地址')).toBeNull()
    expect(screen.getByRole('link', { name: /Telegram 频道/ })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(dialog))
  })
})

describe('SubscribePanel 邮件订阅', () => {
  it('展开后把焦点交给邮箱输入框', async () => {
    openPanel()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('邮箱地址')))
  })

  it('两种订阅类型都以默认勾选呈现', () => {
    openPanel()
    expect((screen.getByLabelText('新文章') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('新日记') as HTMLInputElement).checked).toBe(true)
  })

  it('一个类型都不选时本地拦下，不发请求', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    openPanel()
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByLabelText('新文章'))
    fireEvent.click(screen.getByLabelText('新日记'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '至少选择一种订阅内容。')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('成功时只声明「确认邮件已发送」，POST body 与所选类型一致', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    openPanel()
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByLabelText('新日记'))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement)

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      '确认邮件已发送，请查收后完成订阅。',
    )
    expect(screen.queryByText('订阅成功')).toBeNull()

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/interactions/subscribe')
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@example.com', types: ['post_c'] })
  })

  it('失败时给出可播报的错误，输入框仍可重试', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

    openPanel()
    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'a@example.com' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '订阅请求失败，请稍后再试。',
    )
    expect((screen.getByLabelText('邮箱地址') as HTMLInputElement).disabled).toBe(false)
  })
})

describe('SubscribePanel 关闭行为', () => {
  it('Escape 关闭并把焦点还给订阅入口', async () => {
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /订阅/ }))
  })
})
