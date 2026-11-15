// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeHomepageMoreItem } from '@/core/config/theme'

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
 * - `subscribe` 不是直接跳 `/feed`，而是展开两条渠道；
 * - 浏览器通知的权限只在用户点那一行时才申请（这里断言 `enable()` 的调用时机）；
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

describe('首页更多：入口渲染', () => {
  it('三种入口都在，链接的站内 / 站外形态不同', () => {
    render(<HomeMore items={[LIKE, SUBSCRIBE, INTERNAL, EXTERNAL]} siteLikeCount={627} />)

    expect(screen.getByRole('button', { name: /点赞/ }).textContent).toContain('627')

    const internal = screen.getByRole('link', { name: '归档' })
    expect(internal.getAttribute('href')).toBe('/archives')
    expect(internal.getAttribute('target')).toBeNull()

    const external = screen.getByRole('link', { name: 'GitHub' })
    expect(external.getAttribute('href')).toBe('https://github.com/miaoermua')
    expect(external.getAttribute('target')).toBe('_blank')
  })

  it('没有点赞数时不渲染计数占位', () => {
    render(<HomeMore items={[LIKE]} siteLikeCount={null} />)
    const button = screen.getByRole('button', { name: /点赞/ })
    expect(button.querySelector('.home-more__count')).toBeNull()
  })
})

describe('首页更多：订阅入口', () => {
  it('默认收起，不渲染任何渠道', () => {
    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} />)

    expect(screen.getByRole('button', { name: '订阅' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: /RSS/ })).toBeNull()
  })

  it('点开后有 RSS 与浏览器通知两条渠道', () => {
    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} />)
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    expect(screen.getByRole('link', { name: /RSS/ }).getAttribute('href')).toBe('/feed')

    const notifyRow = screen.getByRole('button', { name: /浏览器通知/ })
    expect(notifyRow.getAttribute('aria-pressed')).toBe('false')
    // 还没点过，就不该申请过权限
    expect(system.enable).not.toHaveBeenCalled()
  })

  it('Escape 收起面板', () => {
    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} />)
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))
    expect(screen.getByRole('link', { name: /RSS/ })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('link', { name: /RSS/ })).toBeNull()
  })

  it('点开时才读权限状态：不支持时那一行禁用并给出原因', () => {
    system.getState.mockReturnValue('unsupported')
    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} />)
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    const notifyRow = screen.getByRole('button', { name: /浏览器通知/ })
    // 用原生 disabled 断言：本仓库没有引入 jest-dom 的 toBeDisabled
    expect((notifyRow as HTMLButtonElement).disabled).toBe(true)
    expect(notifyRow.textContent).toContain('浏览器不支持')
  })

  it('点击通知行会申请权限，并把结果写回界面', async () => {
    system.getState.mockReturnValue('off')
    system.enable.mockResolvedValue('blocked')

    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} />)
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))
    fireEvent.click(screen.getByRole('button', { name: /浏览器通知/ }))

    await waitFor(() => expect(system.enable).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /浏览器通知/ }).textContent).toContain(
        '浏览器已阻止',
      ),
    )
  })

  it('已开启时再点是关闭，不再次申请权限', async () => {
    system.getState.mockReturnValue('on')

    render(<HomeMore items={[SUBSCRIBE]} siteLikeCount={null} />)
    fireEvent.click(screen.getByRole('button', { name: '订阅' }))

    const notifyRow = screen.getByRole('button', { name: /浏览器通知/ })
    await waitFor(() => expect(notifyRow.getAttribute('aria-pressed')).toBe('true'))

    fireEvent.click(notifyRow)
    expect(system.disable).toHaveBeenCalledTimes(1)
    expect(system.enable).not.toHaveBeenCalled()
  })
})
