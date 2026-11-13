// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NavGroup } from '@/core/navigation'
import type { MessageKey } from '@/lib/i18n/dictionary'

const state = vi.hoisted(() => ({ pathname: '/articles', search: '' }))

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
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

import { NavSelector } from '@/components/layout/nav-selector'

/**
 * 顶栏目录选择器
 *
 * 覆盖五种输入路径：鼠标悬停、点击钉住、点外部关闭、Escape 关闭并还焦点、
 * 方向键在条目间移动。空态与错误态各自有独立断言——它们不是同一条文案。
 */

const messages = {
  'nav.home': '首页',
  'nav.directory': '展开更多',
  'nav.articles': '文章',
  'nav.noCategories': '暂无分类',
  'nav.categoriesUnavailable': '分类加载失败',
  'nav.noPages': '暂无页面',
  'nav.pagesUnavailable': '页面加载失败',
  'action.close': '关闭',
} as unknown as Record<MessageKey, string>

const group: NavGroup = {
  key: 'articles',
  label: 'nav.articles',
  href: '/articles',
  matchPrefixes: ['/articles'],
  emptyLabel: 'nav.noCategories',
  errorLabel: 'nav.categoriesUnavailable',
  status: 'ok',
  items: [
    { href: '/articles/tech', label: '技术' },
    { href: '/articles/notes', label: '随笔' },
  ],
}

function renderSelector(overrides: Partial<NavGroup> = {}) {
  return render(<NavSelector group={{ ...group, ...overrides }} messages={messages} />)
}

const homeGroup: NavGroup = {
  ...group,
  key: 'pages',
  label: 'nav.home',
  href: '/',
  matchPrefixes: ['/', '/pages'],
  emptyLabel: 'nav.noPages',
  errorLabel: 'nav.pagesUnavailable',
  items: [
    { href: '/pages', label: '页面' },
    { href: '/pages/site', label: '站点' },
  ],
}

function renderHomeSelector() {
  return render(<NavSelector group={homeGroup} messages={messages} />)
}

const trigger = () => screen.getByRole('link', { name: '文章' })
const menuButton = () => screen.getByRole('button', { name: /^(展开更多|关闭): 文章$/ })

beforeEach(() => {
  state.pathname = '/articles'
  state.search = ''
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('首页导航入口', () => {
  it('首页文本保留真实首页链接，菜单由相邻更多按钮打开', () => {
    state.pathname = '/'
    renderHomeSelector()
    const homeLink = screen.getByRole('link', { name: '首页' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })

    homeLink.dispatchEvent(click)

    expect(homeLink.getAttribute('href')).toBe('/')
    expect(click.defaultPrevented).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '展开更多: 首页' }))
    expect(screen.getAllByRole('link', { name: '首页' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: '页面' }).getAttribute('href')).toBe('/pages')
    expect(screen.getByRole('link', { name: '站点' })).toBeTruthy()
  })

  it('进入 Pages 后入口显示当前页面名，但点击仍回到首页', () => {
    state.pathname = '/pages'
    renderHomeSelector()
    const currentLink = screen.getByRole('link', { name: '页面' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })

    expect(currentLink.getAttribute('href')).toBe('/')
    currentLink.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '展开更多: 页面' }))
    const pagesItem = screen
      .getAllByRole('link', { name: '页面' })
      .find((link) => link.getAttribute('href') === '/pages')
    expect(pagesItem?.getAttribute('aria-current')).toBe('page')
  })
})

describe('NavSelector 展开与收起', () => {
  it('默认收起：保留真实列表链接，并在独立按钮上暴露 aria-expanded=false', () => {
    renderSelector()
    expect(trigger().getAttribute('href')).toBe('/articles')
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })

  it('主入口链接点击保留默认导航，更多按钮独立展开子菜单', () => {
    renderSelector()
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })

    trigger().dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(trigger().getAttribute('href')).toBe('/articles')
    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })

  it('点击展开后只列出分组子项并按视口限制高度', () => {
    renderSelector()
    fireEvent.click(menuButton())

    expect(menuButton().getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('link', { name: '全部文章' })).toBeNull()
    expect(screen.getByRole('link', { name: '技术' }).getAttribute('href')).toBe('/articles/tech')
    expect(screen.getByRole('link', { name: '技术' }).closest('ul')?.className).toContain(
      'max-h-[min(70dvh,32rem)]',
    )
    expect(trigger().querySelector('svg')).toBeNull()
  })

  it('Escape 关闭并把焦点还给触发按钮', () => {
    renderSelector()
    fireEvent.click(menuButton())
    expect(screen.getByRole('link', { name: '技术' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('点击面板外部关闭', () => {
    renderSelector()
    fireEvent.click(menuButton())

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })

  it('点击条目后收起', () => {
    renderSelector()
    fireEvent.click(menuButton())
    fireEvent.click(screen.getByRole('link', { name: '技术' }))

    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })
})

describe('NavSelector 安全悬停区', () => {
  it('指针移向导航面板时保持展开', () => {
    const { container } = renderSelector()
    const root = container.firstElementChild as HTMLDivElement

    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    const panelId = menuButton().getAttribute('aria-controls')
    const panel = panelId ? document.getElementById(panelId) : null
    expect(panel).toBeTruthy()

    fireEvent.pointerLeave(root, { pointerType: 'mouse', relatedTarget: panel })

    expect(menuButton().getAttribute('aria-expanded')).toBe('true')
  })

  it('离开后延迟收起，重新进入会取消关闭', () => {
    vi.useFakeTimers()
    const { container } = renderSelector()
    const root = container.firstElementChild as HTMLDivElement

    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    fireEvent.pointerLeave(root, { pointerType: 'mouse', relatedTarget: document.body })
    act(() => vi.advanceTimersByTime(100))
    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(180))
    expect(menuButton().getAttribute('aria-expanded')).toBe('true')

    fireEvent.pointerLeave(root, { pointerType: 'mouse', relatedTarget: document.body })
    act(() => vi.advanceTimersByTime(180))
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
  })
})

describe('NavSelector 键盘', () => {
  it('ArrowDown 展开并聚焦第一个条目', async () => {
    renderSelector()
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: '技术' })))
  })

  it('ArrowDown / ArrowUp 在条目间移动并循环', async () => {
    renderSelector()
    fireEvent.click(menuButton())
    const items = [screen.getByRole('link', { name: '技术' }), screen.getByRole('link', { name: '随笔' })]

    items[0]?.focus()
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    // 末尾继续向下回到第一条
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])

    // 第一条继续向上回到末尾
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[1])
  })

  it('Home / End 跳到首尾', () => {
    renderSelector()
    fireEvent.click(menuButton())
    const first = screen.getByRole('link', { name: '技术' })
    const last = screen.getByRole('link', { name: '随笔' })

    last.focus()
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' })
    expect(document.activeElement).toBe(last)
  })
})

describe('NavSelector 选中态与状态', () => {
  it('当前路径命中分组时触发按钮带激活底色', () => {
    renderSelector()
    expect(trigger().className).toContain('bg-[var(--accent-wash)]')
  })

  it('未命中分组时不带激活底色', () => {
    state.pathname = '/about'
    renderSelector()
    expect(trigger().className).not.toContain('bg-[var(--accent-wash)]')
  })

  it('当前条目用 aria-current 标出，而不是只靠颜色', () => {
    state.pathname = '/articles/tech'
    renderSelector()

    fireEvent.click(menuButton())

    expect(screen.getByRole('link', { name: '技术' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '随笔' }).getAttribute('aria-current')).toBeNull()
  })

  it('带查询串的条目按完整 href 比对当前选中', () => {
    state.pathname = '/articles'
    state.search = 'page=2'
    renderSelector({
      items: [
        { href: '/articles', label: '第一页' },
        { href: '/articles?page=2', label: '第二页' },
      ],
    })

    fireEvent.click(menuButton())

    expect(screen.getByRole('link', { name: '第二页' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '第一页' }).getAttribute('aria-current')).toBeNull()
  })

  it('位于分组根路径时主链接就是当前页，菜单不重复出现全部入口', () => {
    state.pathname = '/articles'
    renderSelector()
    fireEvent.click(menuButton())

    expect(trigger().getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('link', { name: '全部文章' })).toBeNull()
  })

  it('分页子页仍高亮主列表入口，但子菜单不重复当前列表', () => {
    state.pathname = '/articles'
    state.search = 'page=3'
    renderSelector()
    fireEvent.click(menuButton())

    expect(trigger().getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('link', { name: '全部文章' })).toBeNull()
  })

  it('空数据时给出空态文案，不在子菜单重复主入口', () => {
    renderSelector({ status: 'empty', items: [] })
    fireEvent.click(menuButton())

    expect(screen.getByText('暂无分类')).toBeTruthy()
    expect(trigger().getAttribute('href')).toBe('/articles')
    expect(screen.queryByRole('link', { name: '全部文章' })).toBeNull()
  })

  it('加载失败时给出错误态文案', () => {
    renderSelector({ status: 'error', items: [] })
    fireEvent.click(menuButton())

    expect(screen.getByText('分类加载失败')).toBeTruthy()
  })
})
