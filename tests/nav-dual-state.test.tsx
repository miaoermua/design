// @vitest-environment jsdom
/**
 * 桌面导航双态：Editorial Bar / Floating Dock
 *
 * 这一组钉住三件事：
 *   1. **一棵 DOM**——两态不是两套导航轮流出现，导航链接、菜单 ID、
 *      Tab 顺序都只有一份；
 *   2. **状态机**——顶部 / 隐藏 / 悬浮的进入条件，以及 40 ↔ 72 的迟滞；
 *   3. **手机不受影响**——三态的视觉规则全部在桌面断点里，移动端那段
 *      CSS 里不出现 `data-mode`。
 *
 * 首次加载与浏览器恢复滚动位置无法在 jsdom 里真实复现（没有滚动恢复），
 * 所以这里只覆盖「初始 scrollY 非 0 时直接进入 hidden」这一条——
 * 它正是恢复位置会走到的那条路径。
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

const messages = dictionary('zh-CN')

const nav = buildNav({
  '/articles': {
    entryLabel: 'nav.allArticles',
    emptyLabel: 'nav.noCategories',
    errorLabel: 'nav.categoriesUnavailable',
    status: 'ok',
    items: [{ href: '/categories/tech', label: '技术' }],
  },
})

/** jsdom 没有真实滚动：用一个可写的位置 + 手动派发 scroll 事件驱动 */
let scrollY = 0

function setScrollY(y: number) {
  scrollY = y
  window.dispatchEvent(new Event('scroll'))
}

function header(): HTMLElement {
  const element = document.querySelector<HTMLElement>('header.site-nav')
  if (!element) throw new Error('没有找到 header.site-nav')
  return element
}

const mode = () => header().dataset.mode

function renderHeader() {
  return render(
    <SiteHeaderClient
      nav={nav}
      siteName="Folio"
      avatarUrl={null}
      messages={messages}
      searchEnabled={false}
    />,
  )
}

beforeEach(() => {
  scrollY = 0
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollY,
  })
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
  // 合帧回调在测试里走定时器，waitFor 才能观察到状态变化
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = ((id: number) =>
    window.clearTimeout(id)) as typeof window.cancelAnimationFrame
})

afterEach(() => {
  cleanup()
  state.pathname = '/articles'
})

describe('一棵 DOM', () => {
  it('只有一个 header.site-nav，导航链接与菜单 ID 都只有一份', () => {
    const { container } = renderHeader()

    expect(container.ownerDocument.querySelectorAll('header.site-nav')).toHaveLength(1)
    expect(container.querySelectorAll('.nav-panel')).toHaveLength(0)

    const links = [...container.querySelectorAll('.nav-link')].map((link) =>
      link.getAttribute('href'),
    )
    // 两态共享的入口：首页 / 文章 / 日记 / 探索 / 友链，各一条
    expect(links).toEqual(['/', '/articles', '/diaries', '/explore', '/friends'])
    expect(new Set(links).size).toBe(links.length)
  })

  it('状态写在 data-mode 上，不再是布尔值 data-hidden', () => {
    const { container } = renderHeader()

    expect(header().getAttribute('data-mode')).toBe('top')
    expect(header().hasAttribute('data-hidden')).toBe(false)
    expect(container.querySelector('[data-hidden]')).toBeNull()
  })
})

describe('状态机：top / hidden / floating', () => {
  it('页面顶部是 Editorial Bar', () => {
    renderHeader()
    expect(mode()).toBe('top')
  })

  it('向下滚过 72px 直接隐藏，不经过悬浮态', async () => {
    renderHeader()
    setScrollY(120)

    await waitFor(() => expect(mode()).toBe('hidden'))
  })

  it('离开顶部后向上滚动 40px 才显示 Floating Dock', async () => {
    renderHeader()

    setScrollY(600)
    await waitFor(() => expect(mode()).toBe('hidden'))

    // 只往回 30px：还不够，导航不该闪一下
    setScrollY(570)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(mode()).toBe('hidden')

    setScrollY(520)
    await waitFor(() => expect(mode()).toBe('floating'))
  })

  it('回到顶部恢复 Editorial Bar', async () => {
    renderHeader()

    setScrollY(900)
    await waitFor(() => expect(mode()).toBe('hidden'))
    setScrollY(700)
    await waitFor(() => expect(mode()).toBe('floating'))

    setScrollY(20)
    await waitFor(() => expect(mode()).toBe('top'))
  })

  it('40–72px 之间是迟滞死区：不因为「快到顶了」就换回顶部栏', async () => {
    renderHeader()

    setScrollY(200)
    await waitFor(() => expect(mode()).toBe('hidden'))

    // 只往回 10px：不够 SHOW_THRESHOLD，保持隐藏
    setScrollY(190)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(mode()).toBe('hidden')

    // 一路回到 60px：已经越过离开阈值的反方向，但还在死区（>40），
    // 所以给的是 Dock，而不是那条通栏透明的 Editorial Bar
    setScrollY(60)
    await waitFor(() => expect(mode()).toBe('floating'))

    // 越过内侧阈值 40 才回 top
    setScrollY(39)
    await waitFor(() => expect(mode()).toBe('top'))
  })

  it('初始位置不在顶部时直接进入隐藏态，不会先画一帧顶部栏', () => {
    scrollY = 800
    renderHeader()

    // layout effect 在首次绘制前同步执行，因此首次断言就该是 hidden
    expect(mode()).toBe('hidden')
  })
})

describe('菜单与滚动：交互期间不换形态', () => {
  it('菜单打开时滚动不切换状态', async () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: messages['action.menu'] }))

    setScrollY(1200)
    await new Promise((resolve) => setTimeout(resolve, 40))

    // 菜单是卡片的子节点：卡片滑走菜单就跟着没了，所以冻结在当前形态
    expect(mode()).toBe('top')
    expect(document.getElementById('site-nav-menu')).not.toBeNull()
  })

  it('指针停在下拉上时滚动也不切换', async () => {
    const { container } = renderHeader()
    const flyoutLink = container.querySelector<HTMLElement>(
      '.nav-flyout .nav-link[href="/articles"]',
    )
    if (!flyoutLink) throw new Error('没有找到文章下拉入口')

    fireEvent.pointerOver(flyoutLink, { pointerType: 'mouse' })

    setScrollY(1200)
    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(mode()).toBe('top')
  })

  it('指针离开卡片后按新位置落定，不会把顶部栏留在正文上方', async () => {
    const { container } = renderHeader()

    fireEvent.pointerOver(container.querySelector('.nav-flyout .nav-link[href="/articles"]')!, {
      pointerType: 'mouse',
    })
    setScrollY(1200)
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(mode()).toBe('top')

    // 冻结解除时不再等下一次滚动：位置已经离开顶部，就恢复成可见的 Dock——
    // 落在 hidden 会让整块滑走，用户刚操作过导航却什么也看不见
    fireEvent.pointerLeave(container.querySelector('.nav-card') as HTMLElement)
    await waitFor(() => expect(mode()).toBe('floating'))
  })

  it('菜单打开期间滚动、再关闭菜单：恢复成 Dock 而不是直接收走', async () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: messages['action.menu'] }))
    expect(mode()).toBe('top')

    setScrollY(1200)
    await new Promise((resolve) => setTimeout(resolve, 40))
    // 菜单打开时冻结
    expect(mode()).toBe('top')

    // 关闭菜单（再次点触发按钮）：此时页面已在中段
    fireEvent.click(screen.getByRole('button', { name: messages['action.menu'] }))
    await waitFor(() => expect(mode()).toBe('floating'))
  })

  it('冻结期间没有滚动时，离开卡片不改变形态', async () => {
    const { container } = renderHeader()

    setScrollY(600)
    await waitFor(() => expect(mode()).toBe('hidden'))
    setScrollY(500)
    await waitFor(() => expect(mode()).toBe('floating'))

    fireEvent.pointerOver(container.querySelector('.nav-flyout .nav-link[href="/articles"]')!, {
      pointerType: 'mouse',
    })
    fireEvent.pointerLeave(container.querySelector('.nav-card') as HTMLElement)

    expect(mode()).toBe('floating')
  })
})

describe('CSS 契约：两态的视觉与断点边界', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/app/globals.css'), 'utf8')
  const tokens = readFileSync(
    join(import.meta.dirname, '../src/design-system/tokens/tokens.css'),
    'utf8',
  )

  /** 取一个 @media 块的内容（花括号配对），用于逐块检查 */
  function blockAt(index: number): string {
    const open = css.indexOf('{', index)
    let depth = 0
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') {
        depth -= 1
        if (depth === 0) return css.slice(open + 1, i)
      }
    }
    return ''
  }

  it('手机断点里不出现 data-mode：双态逻辑碰不到移动端', () => {
    const blocks = [...css.matchAll(/@media \(max-width: 47\.9375rem\)/g)].map((match) =>
      blockAt(match.index ?? 0),
    )

    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.join('\n')).not.toContain('data-mode')
  })

  it('三种状态都在桌面断点里定义', () => {
    const desktop = blockAt(css.indexOf('@media (min-width: 48rem)'))

    expect(desktop).toContain('.nav-card {')
    expect(desktop).toContain("[data-mode='floating'] .nav-card")
    expect(desktop).toContain("[data-mode='hidden'] .nav-card")
  })

  it('Editorial Bar 没有玻璃 / 光斑 / 圆角，Floating Dock 才出现', () => {
    expect(css).toMatch(/\[data-mode='top'\] \.nav-glass \{[\s\S]*?opacity: 0/)
    expect(css).toMatch(/\[data-mode='top'\] \.nav-spotlight \{[\s\S]*?display: none/)
    expect(css).toMatch(
      /\[data-mode='floating'\] \.nav-card \{[\s\S]*?border-radius: var\(--nav-dock-radius\)/,
    )
    // 圆角是微圆角卡片，不是药丸
    expect(tokens).toContain('--nav-dock-radius: 1rem')
    expect(tokens).toContain('--nav-dock-width: 35rem')
  })

  it('隐藏态从可聚焦树里摘掉，而不只是透明度归零', () => {
    expect(css).toMatch(/\[data-mode='hidden'\] \.nav-card \{[\s\S]*?visibility: hidden/)
    expect(css).toMatch(/\[data-mode='hidden'\] \.nav-card \{[\s\S]*?pointer-events: none/)
  })

  it('两种桌面状态共用同一个占位高度，切换时正文不跳', () => {
    expect(css).toMatch(/\.site-nav-spacer \{[\s\S]*?height: var\(--nav-topbar-height\)/)
    expect(tokens).toContain('--nav-topbar-height: 4.25rem')
  })
})
