// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  'nav.articles': '文章',
  'nav.allArticles': '全部文章',
  'nav.noCategories': '暂无分类',
  'nav.categoriesUnavailable': '分类加载失败',
} as unknown as Record<MessageKey, string>

const group: NavGroup = {
  key: 'articles',
  label: 'nav.articles',
  href: '/articles',
  matchPrefixes: ['/articles'],
  allLabel: 'nav.allArticles',
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

const trigger = () => screen.getByRole('link', { name: '文章' })

beforeEach(() => {
  state.pathname = '/articles'
  state.search = ''
})

afterEach(cleanup)

describe('NavSelector 展开与收起', () => {
  it('默认收起：不渲染条目，只暴露 aria-expanded=false', () => {
    renderSelector()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })

  it('点击展开后列出「全部」与各级条目', () => {
    renderSelector()
    fireEvent.click(trigger())

    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: '全部文章' }).getAttribute('href')).toBe('/articles')
    expect(screen.getByRole('link', { name: '技术' }).getAttribute('href')).toBe('/articles/tech')
  })

  it('Escape 关闭并把焦点还给触发按钮', () => {
    renderSelector()
    fireEvent.click(trigger())
    expect(screen.getByRole('link', { name: '技术' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('点击面板外部关闭', () => {
    renderSelector()
    fireEvent.click(trigger())

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })

  it('点击条目后收起', () => {
    renderSelector()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('link', { name: '技术' }))

    expect(screen.queryByRole('link', { name: '技术' })).toBeNull()
  })
})

describe('NavSelector 键盘', () => {
  it('ArrowDown 展开并聚焦第一个条目', async () => {
    renderSelector()
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('link', { name: '全部文章' })),
    )
  })

  it('ArrowDown / ArrowUp 在条目间移动并循环', async () => {
    renderSelector()
    fireEvent.click(trigger())
    const items = [
      screen.getByRole('link', { name: '全部文章' }),
      screen.getByRole('link', { name: '技术' }),
      screen.getByRole('link', { name: '随笔' }),
    ]

    items[0]?.focus()
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])

    // 末尾继续向下回到第一条
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])

    // 第一条继续向上回到末尾
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2])
  })

  it('Home / End 跳到首尾', () => {
    renderSelector()
    fireEvent.click(trigger())
    const first = screen.getByRole('link', { name: '全部文章' })
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

    fireEvent.click(trigger())

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

    fireEvent.click(trigger())

    expect(screen.getByRole('link', { name: '第二页' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '第一页' }).getAttribute('aria-current')).toBeNull()
  })

  it('位于分组根路径时「全部」被标为当前页', () => {
    state.pathname = '/articles'
    renderSelector()
    fireEvent.click(trigger())

    expect(
      screen.getByRole('link', { name: '全部文章' }).getAttribute('aria-current'),
    ).toBe('page')
  })

  it('分页子页仍算在「全部」下，但条目本身不再冒充当前页', () => {
    state.pathname = '/articles'
    state.search = 'page=3'
    renderSelector()
    fireEvent.click(trigger())

    expect(
      screen.getByRole('link', { name: '全部文章' }).getAttribute('aria-current'),
    ).toBe('page')
  })

  it('空数据时给出空态文案，仍保留「全部」入口', () => {
    renderSelector({ status: 'empty', items: [] })
    fireEvent.click(trigger())

    expect(screen.getByText('暂无分类')).toBeTruthy()
    expect(screen.getByRole('link', { name: '全部文章' })).toBeTruthy()
  })

  it('加载失败时给出错误态文案', () => {
    renderSelector({ status: 'error', items: [] })
    fireEvent.click(trigger())

    expect(screen.getByText('分类加载失败')).toBeTruthy()
  })
})
