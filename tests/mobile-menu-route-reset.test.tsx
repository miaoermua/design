// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNav } from '@/core/navigation'
import { dictionary } from '@/lib/i18n/dictionary'

const state = vi.hoisted(() => ({ pathname: '/articles' }))

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { SiteHeaderClient } from '@/components/layout/site-header-client'

/**
 * 菜单与路由的关系
 *
 * 菜单用「在哪个路由打开的」记状态（openAt === pathname），好处是不必在
 * effect 里 setState；代价是只隐藏不卸载时，旧路由的开关值会留到下次回到
 * 该路由——浏览器后退就会把菜单重新弹开。
 *
 * 这里固化的正是这个回归：离开后返回同一路由，菜单必须仍是关闭的。
 */

const messages = dictionary('zh-CN')

/** 菜单与顶栏消费的同一棵树 */
const nav = buildNav({
  '/articles': {
    entryLabel: 'nav.allArticles',
    emptyLabel: 'nav.noCategories',
    errorLabel: 'nav.categoriesUnavailable',
    status: 'ok',
    items: [],
  },
})

function header() {
  return (
    <SiteHeaderClient
      nav={nav}
      siteName="Folio"
      avatarUrl={null}
      locale="zh-CN"
      messages={messages}
      searchEnabled={false}
    />
  )
}

const menuButton = () => screen.getByRole('button', { name: messages['action.menu'] })
const panel = () => document.getElementById('site-nav-menu')

beforeEach(() => {
  // 关闭动画依赖 prefers-reduced-motion 判断；这里给出「不减弱动效」的 matchMedia
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  state.pathname = '/articles'
})

describe('菜单：路由变化后不残留开关状态', () => {
  it('打开菜单后离开再返回同一路由，菜单保持关闭', () => {
    const view = render(header())

    fireEvent.click(menuButton())
    expect(menuButton().getAttribute('aria-expanded')).toBe('true')
    expect(panel()).not.toBeNull()

    state.pathname = '/about'
    view.rerender(header())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()

    // 关键断言：回到原路由时不能把之前的「打开过」重新演一遍
    state.pathname = '/articles'
    view.rerender(header())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()
  })

  it('再次点击触发按钮收起，并在收起动画结束后移出 DOM', async () => {
    render(header())

    fireEvent.click(menuButton())
    expect(panel()).not.toBeNull()

    fireEvent.click(menuButton())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')

    // 关闭有约 140ms 的反向动画：期间仍在 DOM 里（已对辅助技术隐藏），动画结束后卸载
    await waitFor(() => expect(panel()).toBeNull())
  })
})
