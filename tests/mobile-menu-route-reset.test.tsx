// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NavGroup } from '@/core/navigation'
import type { MessageKey } from '@/lib/i18n/dictionary'

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
 * 移动端菜单与路由的关系
 *
 * 菜单用「在哪个路由打开的」记状态（openAt === pathname），好处是不必在
 * effect 里 setState；代价是只隐藏不卸载时，旧路由的开关值会留到下次回到
 * 该路由——浏览器后退就会把菜单重新弹开。
 *
 * 这里固化的正是这个回归：离开后返回同一路由，菜单必须仍是关闭的。
 */

const messages = {
  'action.menu': '菜单',
  'nav.home': '首页',
  'nav.articles': '文章',
  'nav.noCategories': '暂无分类',
  'nav.categoriesUnavailable': '分类加载失败',
} as unknown as Record<MessageKey, string>

const groups: NavGroup[] = [
  {
    key: 'articles',
    label: 'nav.articles',
    href: '/articles',
    matchPrefixes: ['/articles'],
    emptyLabel: 'nav.noCategories',
    errorLabel: 'nav.categoriesUnavailable',
    status: 'ok',
    items: [],
  },
  {
    key: 'pages',
    label: 'nav.home',
    href: '/',
    matchPrefixes: ['/'],
    emptyLabel: 'nav.noCategories',
    errorLabel: 'nav.categoriesUnavailable',
    status: 'ok',
    items: [],
  },
]

function header() {
  return (
    <SiteHeaderClient
      groups={groups}
      links={[]}
      locale="zh"
      messages={messages}
      searchEnabled={false}
    />
  )
}

const menuButton = () => screen.getByRole('button', { name: messages['action.menu'] })

afterEach(() => {
  cleanup()
  state.pathname = '/articles'
})

describe('移动端菜单：路由变化后不残留开关状态', () => {
  it('打开菜单后离开再返回同一路由，菜单保持关闭', () => {
    const view = render(header())

    fireEvent.click(menuButton())
    expect(menuButton().getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('site-mobile-nav')).not.toBeNull()

    state.pathname = '/about'
    view.rerender(header())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('site-mobile-nav')).toBeNull()

    // 关键断言：回到原路由时不能把之前的「打开过」重新演一遍
    state.pathname = '/articles'
    view.rerender(header())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('site-mobile-nav')).toBeNull()
  })

  it('同一路由内仍可正常开关', () => {
    render(header())

    fireEvent.click(menuButton())
    expect(menuButton().getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(menuButton())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('site-mobile-nav')).toBeNull()
  })
})
