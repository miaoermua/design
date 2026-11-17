// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeHomepageMoreItem } from '@/core/config/theme'
import type { SubscribeOptions } from '@/features/interactions'

const system = vi.hoisted(() => ({
  getState: vi.fn(() => 'off'),
  enable: vi.fn(async () => 'on'),
  disable: vi.fn(),
  notify: vi.fn(() => true),
}))

vi.mock('@/lib/notifications/system', () => ({
  systemNotifications: system,
}))

import { HomeMore } from '@/components/home/home-more'

/**
 * 首页「更多」
 *
 * 重点不是"三个按钮都渲染出来了"，而是：
 * - `subscribe` 点击后打开公有订阅弹窗（SubscribeModal）；
 * - 浏览器通知的权限只在弹窗内用户点那一行时才申请；
 * - `link` 的站内 / 站外分别用 `<a>` 的两种形态。
 */

afterEach(cleanup)

beforeEach(() => {
  system.getState.mockReset().mockReturnValue('off')
  system.enable.mockReset().mockResolvedValue('on')
  system.disable.mockReset()
  system.notify.mockReset().mockReturnValue(true)
})

const LIKE: ThemeHomepageMoreItem = {
  title: '点赞',
  type: 'like',
  url: null,
  icon: null,
  color: null,
}
const SUBSCRIBE: ThemeHomepageMoreItem = {
  title: '订阅',
  type: 'subscribe',
  url: null,
  icon: null,
  color: null,
}
const INTERNAL: ThemeHomepageMoreItem = {
  title: '归档',
  type: 'link',
  url: '/archives',
  icon: null,
  color: null,
}
const EXTERNAL: ThemeHomepageMoreItem = {
  title: 'GitHub',
  type: 'link',
  url: 'https://github.com/miaoermua',
  icon: null,
  color: null,
}

const SUBSCRIBE_OPTIONS: SubscribeOptions = {
  enabled: true,
  types: ['post_c', 'note_c'],
  channels: [],
}

describe('首页更多：入口渲染', () => {
  it('三种入口都在，链接的站内 / 站外形态不同', () => {
    render(
      <HomeMore
        items={[LIKE, SUBSCRIBE, INTERNAL, EXTERNAL]}
        siteLikeCount={627}
        subscribeOptions={SUBSCRIBE_OPTIONS}
      />,
    )

    expect(screen.getByRole('button', { name: /点赞/ }).textContent).toContain('627')

    const internal = screen.getByRole('link', { name: '归档' })
    expect(internal.getAttribute('href')).toBe('/archives')
    expect(internal.getAttribute('target')).toBeNull()

    const external = screen.getByRole('link', { name: 'GitHub' })
    expect(external.getAttribute('href')).toBe('https://github.com/miaoermua')
    expect(external.getAttribute('target')).toBe('_blank')
  })

  it('没有点赞数时不渲染计数占位', () => {
    render(<HomeMore items={[LIKE]} siteLikeCount={null} subscribeOptions={null} />)
    const button = screen.getByRole('button', { name: /点赞/ })
    expect(button.querySelector('.home-more__count')).toBeNull()
  })
})

describe('首页更多：订阅入口', () => {
  it('订阅按钮存在，点击后打开弹窗', () => {
    render(
      <HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={SUBSCRIBE_OPTIONS} />,
    )

    const button = screen.getByRole('button', { name: '订阅' })
    expect(button).toBeTruthy()

    fireEvent.click(button)

    // 弹窗打开后应该有模态 dialog
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
  })

  it('弹窗内有 RSS 链接', () => {
    render(
      <HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={SUBSCRIBE_OPTIONS} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    expect(screen.getByRole('link', { name: /feed/ }).getAttribute('href')).toBe('/feed')
  })

  it('弹窗内有浏览器通知开关', () => {
    render(
      <HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={SUBSCRIBE_OPTIONS} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    const notifyToggle = screen.getByRole('button', { name: /未开启/ })
    expect(notifyToggle).toBeTruthy()
    expect(notifyToggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('不支持时通知开关禁用并给出原因', () => {
    system.getState.mockReturnValue('unsupported')
    render(
      <HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={SUBSCRIBE_OPTIONS} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    const notifyToggle = screen.getByRole('button', { name: /浏览器不支持/ })
    expect((notifyToggle as HTMLButtonElement).disabled).toBe(true)
  })

  it('点击通知开关会申请权限', async () => {
    system.getState.mockReturnValue('off')
    system.enable.mockResolvedValue('blocked')

    render(
      <HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={SUBSCRIBE_OPTIONS} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))
    fireEvent.click(screen.getByRole('button', { name: /未开启/ }))

    await waitFor(() => expect(system.enable).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: /浏览器已阻止/ })).toBeTruthy())
  })

  it('已开启时再点是关闭，不再次申请权限', async () => {
    system.getState.mockReturnValue('on')

    render(
      <HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={SUBSCRIBE_OPTIONS} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    const notifyToggle = screen.getByRole('button', { name: /已开启/ })
    await waitFor(() => expect(notifyToggle.getAttribute('aria-pressed')).toBe('true'))

    fireEvent.click(notifyToggle)
    expect(system.disable).toHaveBeenCalledTimes(1)
    expect(system.enable).not.toHaveBeenCalled()
  })

  it('subscribeOptions 为 null 时弹窗内无邮件表单', () => {
    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} subscribeOptions={null} />)
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    // 无邮件类型时不应渲染邮件输入框
    expect(screen.queryByPlaceholderText('name@example.com')).toBeNull()
  })
})
