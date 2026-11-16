// @vitest-environment jsdom
/**
 * 右下角工具组：只剩「主题 / 语言 / 回顶」
 *
 * 删除的是**入口**，不是能力。所以这一组测试同时钉住两件事：
 *   - 工具组里不再有搜索按钮（也不再有它专属的悬浮定位）；
 *   - 搜索本身没被拆掉：⌘K/Ctrl+K 仍能打开面板，/search 页与搜索接口仍在。
 *
 * 只断言"某元素不见了"是不够的——把整个工具组删掉也能让那条断言通过，
 * 所以这里同时断言三个保留项仍在。
 */

import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNav } from '@/core/navigation'
import { dictionary } from '@/lib/i18n/dictionary'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/layout/use-header-scroll', () => ({
  useHeaderScroll: () => ({ hidden: false, detached: false }),
}))

import { SiteHeaderClient } from '@/components/layout/site-header-client'

const messages = dictionary('zh-CN')
const ROOT = join(import.meta.dirname, '..')

function renderHeader(searchEnabled = true) {
  return render(
    <SiteHeaderClient
      nav={buildNav()}
      siteName="Folio"
      avatarUrl={null}
      messages={messages}
      searchEnabled={searchEnabled}
    />,
  )
}

/** 右下角竖向工具组 */
function dock(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.toolbar-dock')
  if (!element) throw new Error('没有找到 .toolbar-dock')
  return element
}

beforeEach(() => {
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

afterEach(cleanup)

describe('工具组：搜索入口已移除', () => {
  it('右下角只剩回顶一个按钮（主题与语言已迁到页脚）', () => {
    renderHeader()
    const buttons = dock().querySelectorAll('button')
    expect(buttons).toHaveLength(1)

    const labels = [...buttons].map((button) => button.getAttribute('aria-label') ?? '')
    expect(labels[0]).toContain(messages['action.backToTop'])
    // 设置类开关不得留在浮标里：全站只有页脚那一处
    expect(labels.some((label) => label.includes(messages['action.mode']))).toBe(false)
    expect(labels.some((label) => label.includes(messages['action.language']))).toBe(false)
  })

  it('工具组里没有以「搜索」命名的按钮', () => {
    renderHeader()
    const hit = [...dock().querySelectorAll('button')].some(
      (button) => button.getAttribute('aria-label') === messages['action.search'],
    )
    expect(hit).toBe(false)
  })

  it('搜索能力关闭时也不再需要那个入口', () => {
    renderHeader(false)
    expect(dock().querySelectorAll('button')).toHaveLength(1)
  })

  it('工具组仍有分组语义', () => {
    renderHeader()
    const group = screen.getByRole('group', { name: messages['toolbar.group'] })
    expect(group.querySelectorAll('button')).toHaveLength(1)
  })

  it('搜索图标没有残留成孤儿（不在工具组、也不在页头其它位置）', () => {
    const { container } = renderHeader()
    // 放大镜的路径是搜索图标独有的，工具组里一旦出现就说明入口没删干净
    expect(dock().innerHTML).not.toContain('m16 16 4 4')
    expect(container.innerHTML).not.toContain('m16 16 4 4')

    // 图标数量不超过按钮数量：每个按钮至多一枚图标，不存在隐藏的第 4 个入口
    expect(dock().querySelectorAll('svg').length).toBeLessThanOrEqual(
      dock().querySelectorAll('button').length,
    )
  })
})

describe('搜索能力本身未受影响', () => {
  it('Ctrl+K 仍能打开搜索面板', () => {
    renderHeader()
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe(messages['action.search'])
  })

  it('Esc 关闭面板', () => {
    renderHeader()
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    })
    expect(screen.getByRole('dialog')).toBeTruthy()

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('搜索模块关闭时快捷键不打开面板', () => {
    renderHeader(false)
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('文章页与探索页的搜索入口仍在源码里', () => {
    // 路由与页面没有随右下角入口一起被删
    expect(existsSync(join(ROOT, 'src/app/search/page.tsx'))).toBe(true)
    expect(existsSync(join(ROOT, 'src/app/api/search/route.ts'))).toBe(true)

    const routes = readFileSync(join(ROOT, 'src/lib/routes.ts'), 'utf8')
    expect(routes).toMatch(/export function searchPath/)

    const notFound = readFileSync(join(ROOT, 'src/app/not-found.tsx'), 'utf8')
    expect(notFound).toContain('/search')
  })

  it('无 JS 时仍有 /search 普通链接兜底', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/site-header-client.tsx'), 'utf8')
    expect(source).toContain('noscript')
    expect(source).toContain('href="/search"')
  })

  it('工具组的固定定位样式保留（主题/语言/回顶仍在用）', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
    expect(css).toContain('.toolbar-dock')
    expect(css).toMatch(/\.toolbar-dock\s*\{[^}]*position:\s*fixed/)
  })
})

/**
 * 右下工具组与顶栏是**同一块玻璃**，不是三枚各自带材质的圆按钮。
 *
 * 这一组断言钉住三件事：
 *   1. 胶囊内自带 `.nav-glass.glass-nav` 与 `.nav-spotlight`（复用导航那两个类，
 *      而不是另写一套冰面参数）；
 *   2. 三个按钮自身没有材质、没有边框（材质已上移到胶囊）；
 *   3. 光斑半径可按宿主调整——48px 宽的胶囊若用顶栏的 11rem，会整块均匀染色。
 */
describe('工具胶囊：与顶栏同源的玻璃与光斑', () => {
  it('胶囊内有玻璃层与光斑层，且都是导航用的那两个类', () => {
    renderHeader(true)
    const element = dock()
    expect(element.querySelector(':scope > .nav-glass.glass-nav')).not.toBeNull()
    expect(element.querySelector(':scope > .nav-spotlight')).not.toBeNull()
  })

  it('玻璃层铺满宿主并置于内容之下', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
    const glass = css.match(/\.nav-glass\s*\{[^}]*\}/)?.[0] ?? ''
    expect(glass).toMatch(/position:\s*absolute/)
    expect(glass).toMatch(/inset:\s*0/)
    expect(glass).toMatch(/border-radius:\s*inherit/)
    // 内容必须抬到玻璃之上，否则按钮点不到
    const group = css.match(/\.toolbar-dock\s*\{[^}]*\}/)?.[0] ?? ''
    expect(group).toMatch(/border-radius:\s*var\(--radius-md\)/)
    expect(group).toMatch(/padding:/)
  })

  it('三个按钮自身不再带材质或边框', () => {
    renderHeader(true)
    const buttons = Array.from(dock().querySelectorAll('button'))
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button.className).not.toContain('glass-control')
      expect(button.className).not.toContain('rounded-full')
      expect(button.className).toContain('rounded-[var(--radius-sm)]')
    }
  })

  it('光斑半径参数化，胶囊用小一档的值', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
    const spot = css.match(/\.nav-spotlight\s*\{[^}]*\}/)?.[0] ?? ''
    expect(spot).toContain('--nav-spotlight-size')
    // 顶栏默认 11rem，胶囊覆盖为更小的值
    expect(spot).toMatch(/--nav-spotlight-size:\s*11rem/)
    const dockSpot = css.match(/\.toolbar-dock\s+\.nav-spotlight\s*\{[^}]*\}/)?.[0] ?? ''
    expect(dockSpot).toContain('--nav-spotlight-size:')
    expect(dockSpot).not.toContain('11rem')
  })

  it('指针跟踪只有一份实现（顶栏与胶囊共用同一个 hook）', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/site-header-client.tsx'), 'utf8')
    const calls = source.match(/useSpotlight\(/g) ?? []
    // 1 次定义 + 2 次调用（卡片、胶囊）
    expect(calls).toHaveLength(3)
    expect(source).toContain('<span aria-hidden="true" className="nav-spotlight" />')
    expect(source).toContain('ref={dockRef}')
  })
})
