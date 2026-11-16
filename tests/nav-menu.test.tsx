// @vitest-environment jsdom
/**
 * 悬浮导航的信息架构
 *
 * 这一组固化两件事：
 *   1. 快捷栏只有四条（头像 / 博客 / 日记 / 菜单），探索与更多不在里面；
 *   2. 菜单是唯一承载完整导航的地方，顺序为 身份 → 主导航 → 更多。
 *
 * 设置（语言 / 主题）已迁到页脚，菜单里不再有第二份入口 ——
 * 这条契约由「设置已迁到页脚」那条用例钉住。
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

/**
 * 一棵树，不是四份清单。
 *
 * 上一版这里要分别造 `groups` / `quickNav` / `menuNav` / `moreNav` 四份数据，
 * 其中文章既是快捷项又是「文章分类」分组——同一目的地存了两份，
 * 菜单里也就长出两行。
 */
const nav = buildNav({
  '/articles': {
    entryLabel: 'nav.allArticles',
    emptyLabel: 'nav.noCategories',
    errorLabel: 'nav.categoriesUnavailable',
    status: 'ok',
    items: [{ href: '/categories/tech', label: '技术' }],
  },
  /*
   * 「页面」也要有：桌面顶栏不单独放它，它的目录挂到首页入口上。
   * 注意**没有** `entryLabel`——独立页面没有索引页，抽屉里不该出现
   * 「全部页面」那一行。这正是这一组要钉住的差别。
   */
  '/pages': {
    emptyLabel: 'nav.noPages',
    errorLabel: 'nav.pagesUnavailable',
    status: 'ok',
    items: [{ href: '/pages/site', label: '站点' }],
  },
})

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

const menuButton = () => screen.getByRole('button', { name: messages['action.menu'] })
const panel = () => document.getElementById('site-nav-menu')

function openMenu() {
  fireEvent.click(menuButton())
  return panel() as HTMLElement
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
  window.localStorage.clear()
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  }
})

afterEach(() => {
  cleanup()
  state.pathname = '/articles'
})

describe('快捷栏：桌面横向舒展，手机只留内容主线', () => {
  /** 顶栏自己的入口（不含悬停下拉里的子项） */
  const barLinks = () =>
    [
      ...screen
        .getByRole('navigation', { name: messages['nav.quick'] })
        .querySelectorAll('.nav-link'),
    ] as HTMLElement[]

  it('桌面完整横向导航：首页 / 文章 / 日记 / 探索 / 友链，头像仍在', () => {
    renderHeader()

    expect(barLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/articles',
      '/diaries',
      '/explore',
      '/friends',
    ])
    // 头像没有被桌面断点藏掉
    const avatar = document.querySelector('.nav-avatar') as HTMLElement
    expect(avatar.getAttribute('href')).toBe('/')
    expect(menuButton()).toBeTruthy()
  })

  it('首页 / 探索 / 友链只在桌面出现：手机由 CSS 收起，不是从 DOM 里删掉', () => {
    renderHeader()

    for (const href of ['/', '/explore', '/friends']) {
      const link = barLinks().find((entry) => entry.getAttribute('href') === href)
      // 收起靠断点规则；标记写在元素上，组件里不做视口判断。
      // `<li>` 上一定有（有下级的入口 Link 自身不重复标一次，收起由 li 承担），
      // 所以这里只认 li。
      expect(link?.closest('li')?.getAttribute('data-compact')).toBe('hide')
    }
    for (const href of ['/articles', '/diaries']) {
      expect(barLinks().find((link) => link.getAttribute('href') === href)?.dataset.compact).toBe(
        undefined,
      )
    }
  })

  it('「更多」不在顶栏：页面的目录归到菜单抽屉里', () => {
    renderHeader()
    const quick = screen.getByRole('navigation', { name: messages['nav.quick'] })
    expect(quick.textContent).not.toContain(messages['nav.more'])
  })

  it('头像也是首页入口，且不展开任何资料菜单', () => {
    renderHeader()
    // 桌面有两个首页入口：文字「首页」与头像。这里点的是头像
    const home = document.querySelector('.nav-avatar') as HTMLElement
    expect(home.getAttribute('href')).toBe('/')
    expect(home.getAttribute('aria-label')).toBe(messages['nav.home'])
    fireEvent.click(home)
    expect(panel()).toBeNull()
  })

  it('当前页面在顶栏里有 aria-current', () => {
    renderHeader()
    const active = barLinks().filter((link) => link.getAttribute('aria-current') === 'page')

    expect(active.map((link) => link.getAttribute('href'))).toEqual(['/articles'])
  })
})

describe('桌面悬停下拉：也是同一棵树的另一种展示', () => {
  it('下拉只列分类，不再重复「全部文章」——入口本身就是那个目的地', () => {
    renderHeader()
    // 首页也带下拉（页面目录），所以按 href 定位，不能取第一个
    const flyout = [...document.querySelectorAll('.nav-flyout')].find(
      (node) => node.querySelector('.nav-link')?.getAttribute('href') === '/articles',
    ) as HTMLElement

    expect(flyout).toBeTruthy()
    // 入口自身仍然是一条链接，点一下就进列表页
    expect(flyout.querySelector('.nav-link')?.getAttribute('href')).toBe('/articles')

    const links = [...flyout.querySelectorAll('.nav-flyout__panel a')].map((link) =>
      link.getAttribute('href'),
    )
    // 只剩子项：有鼠标时不需要在下拉里再列一遍同一个地址
    expect(links).toEqual(['/categories/tech'])
    expect(flyout.querySelector('.nav-flyout__panel')?.textContent).not.toContain(
      messages['nav.allArticles'],
    )
  })

  it('首页下拉列出各独立页面：这是「页面」在 PC 端的入口', () => {
    renderHeader()
    const homeFlyout = [...document.querySelectorAll('.nav-flyout')].find(
      (flyout) => flyout.querySelector('.nav-link')?.getAttribute('href') === '/',
    ) as HTMLElement

    expect(homeFlyout).toBeTruthy()
    expect(
      [...homeFlyout.querySelectorAll('.nav-flyout__list a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/pages/site'])
    // 页面没有自己的索引页，下拉里也就没有「全部页面」这一行
    expect(homeFlyout.textContent).not.toContain('全部页面')
    // `/pages` 本身不是可去的目的地，不该出现在任何链接里
    expect(
      [...document.querySelectorAll('.nav-flyout__panel a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).not.toContain('/pages')
  })

  it('下拉是抽屉的子集：抽屉多出的正是二次确认行与「更多」的子项', () => {
    renderHeader()
    const flyoutHrefs = [...document.querySelectorAll('.nav-flyout__panel a')].map((link) =>
      link.getAttribute('href'),
    )

    const node = openMenu()
    const menuHrefs = [...node.querySelectorAll('nav details a')].map((link) =>
      link.getAttribute('href'),
    )

    // 同一份 branch：下拉里的每一项都能在抽屉里找到
    for (const href of flyoutHrefs) expect(menuHrefs).toContain(href)
    // 抽屉多出来的是两类东西，都不是第二套配置：
    //   1. 目录入口自己列表页的二次确认行（/articles）
    //   2. 「更多」的折叠子项——它们没有桌面下拉，只在抽屉里
    expect(menuHrefs.filter((href) => !flyoutHrefs.includes(href))).toEqual([
      '/articles',
      '/says',
      '/projects',
    ])
  })

  it('顶栏入口不带箭头 / more 图标：折叠箭头只在菜单抽屉里出现', () => {
    renderHeader()
    const quick = screen.getByRole('navigation', { name: messages['nav.quick'] })

    // 顶栏里每个入口都只有文字，没有任何 svg 图标
    for (const link of quick.querySelectorAll('.nav-link')) {
      const href = link.getAttribute('href')
      const expected: Record<string, string> = {
        '/': messages['nav.home'],
        '/articles': messages['nav.articles'],
        '/diaries': messages['nav.diaries'],
        '/explore': messages['nav.explore'],
        '/friends': messages['nav.friends'],
      }
      expect(link.querySelector('svg')).toBeNull()
      expect((link.textContent ?? '').trim()).toBe(expected[href ?? ''])
    }

    // 抽屉里的折叠箭头仍在：它是唯一表示「还有一层」的地方
    const node = openMenu()
    expect(node.querySelector('.nav-group__chevron')).not.toBeNull()
  })

  it('下拉里一律没有「全部 X」：入口本身就是那个目的地', () => {
    renderHeader()
    const panels = [...document.querySelectorAll('.nav-flyout__panel')] as HTMLElement[]
    expect(panels.length).toBeGreaterThan(0)

    for (const panel of panels) {
      for (const key of ['nav.allArticles', 'nav.allDiaries'] as const) {
        expect(panel.textContent).not.toContain(messages[key])
      }
    }
    // 页面下拉里也没有「全部页面」（主题没有 /pages 索引页）
    expect(document.body.textContent).not.toContain('全部页面')
  })

  it('手机断点收起下拉面板，入口本身仍是普通链接', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/app/globals.css'), 'utf8')

    expect(css).toMatch(
      /@media \(max-width: 47\.9375rem\) \{[\s\S]*?\.nav-flyout__panel \{[\s\S]*?display: none/,
    )
    expect(css).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]*?\.nav-flyout \{[\s\S]*?display: flex/,
    )
    // 键盘可达：焦点进入时同样展开
    expect(css).toContain(':focus-within > .nav-flyout__panel')
    // 顶栏不再有箭头图标
    expect(css).not.toContain('.nav-link__chevron')
  })
})

describe('桌面顶栏的排布契约', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/app/globals.css'), 'utf8')
  const tokens = readFileSync(
    join(import.meta.dirname, '../src/design-system/tokens/tokens.css'),
    'utf8',
  )

  it('头像贴最左、链接整组贴右、中间留空由 margin-right:auto 推出来', () => {
    // 用 auto margin 而不是 space-between：条目数量变化时链接不会漂移
    expect(css).toMatch(/\.nav-quick__list > li:first-child \{[\s\S]*?margin-right: auto/)
    expect(css).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]*?\.nav-card \{[\s\S]*?justify-content: space-between/,
    )
  })

  it('桌面两态的几何：顶部 4.25rem 通栏、悬浮 3.125rem 卡片', () => {
    // 手机底部胶囊的高度仍由 tokens.css 里的 --nav-bar-height 承担
    expect(tokens).toContain('--nav-bar-height: 3.5rem')
    expect(tokens).toContain('--nav-topbar-height: 4.25rem')
    expect(tokens).toContain('--nav-dock-height: 3.125rem')

    expect(css).toMatch(/\.nav-card \{[\s\S]*?height: var\(--nav-topbar-height\)/)
    expect(css).toMatch(
      /\[data-mode='floating'\] \.nav-card \{[\s\S]*?height: var\(--nav-dock-height\)/,
    )
    // 占位块跟着顶部状态的高度走：两种桌面状态切换时正文不会跳
    expect(css).toMatch(/\.site-nav-spacer \{[\s\S]*?height: var\(--nav-topbar-height\)/)
  })

  it('菜单键与导航链接同一套外观：都是常态无边框、hover 才铺底', () => {
    const trigger = css.match(/\.nav-menu-trigger \{([\s\S]*?)\}/)?.[1] ?? ''
    // 不再给菜单键单独加一圈发丝边
    expect(trigger).not.toContain('box-shadow: inset')
    expect(trigger).not.toMatch(/(^|\n)\s*border:/)
    // 与 .nav-link 相同的药丸圆角与 hover 底色
    expect(trigger).toContain('border-radius: var(--radius-pill)')
    expect(css).toMatch(/\.nav-link:hover \{[\s\S]*?background-color: var\(--nav-item-hover\)/)
    expect(css).toMatch(
      /\.nav-menu-trigger:hover \{[\s\S]*?background-color: var\(--nav-item-hover\)/,
    )
  })
})

describe('菜单：完整导航与分区', () => {
  it('主导航是文章 / 日记 / 探索 / 友链 / 页面，最后一行是「更多」', () => {
    renderHeader()
    const node = openMenu()

    const main = node.querySelector('nav') as HTMLElement
    // 顶层行（不含折叠区里的子项）：文章折叠 / 日记 / 探索 / 友链 / 页面折叠 / 更多
    const rows = [...main.querySelectorAll(':scope > ul > li')].map((li) =>
      (li.querySelector('summary, a') as HTMLElement).textContent?.trim(),
    )

    expect(rows).toEqual([
      messages['nav.articles'],
      messages['nav.diaries'],
      messages['nav.explore'],
      messages['nav.friends'],
      messages['nav.pages'],
      messages['nav.more'],
    ])
  })

  it('目录型入口的子项挂在自己的折叠里，标题就是入口自己的名字', () => {
    renderHeader()
    const node = openMenu()

    const details = node.querySelector('details') as HTMLElement
    expect(details).toBeTruthy()
    // 折叠头 = 文章，不再是另一份「文章分类」分组
    expect(details.querySelector('summary')?.textContent).toContain(messages['nav.articles'])
    expect(node.textContent).not.toContain(messages['nav.categories'])

    // 第一项是回到该入口自身列表页的链接，href 来自 entry，不在数据里重复存
    const links = [...details.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    expect(links).toEqual(['/articles', '/categories/tech'])
    expect(details.textContent).toContain(messages['nav.allArticles'])
    expect(details.textContent).toContain('技术')
  })

  it('每个目的地只出现一次：菜单不是第二套导航', () => {
    renderHeader()
    const node = openMenu()

    const hrefs = [...node.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    const counts = new Map<string, number>()
    for (const href of hrefs) counts.set(href!, (counts.get(href!) ?? 0) + 1)

    for (const href of ['/', '/articles', '/diaries', '/explore', '/friends']) {
      expect([href, counts.get(href)]).toEqual([href, 1])
    }
    // 「页面」没有索引页：抽屉里不该有指向 `/pages` 的链接
    expect(counts.get('/pages')).toBeUndefined()
    // 但它的子项仍在（PC 由首页下拉承载，手机由抽屉承载）
    expect(counts.get('/pages/site')).toBe(1)
  })

  it('「页面」抽屉里只有各独立页面：没有「全部页面」这一行', () => {
    renderHeader()
    const node = openMenu()

    const details = [...node.querySelectorAll('details')].find((el) =>
      el.querySelector('summary')?.textContent?.includes(messages['nav.pages']),
    ) as HTMLElement
    expect(details).toBeTruthy()

    // 折叠区里直接就是子项，第一行不是回列表页的「全部页面」
    expect([...details.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '/pages/site',
    ])
    expect(details.textContent).not.toContain('全部页面')
  })

  it('「更多」是一行菜单，不是分区：和目录型入口同一套折叠结构', () => {
    renderHeader()
    const node = openMenu()

    // 不再有带标题的独立分区
    expect(node.querySelector(`section[aria-label="${messages['nav.more']}"]`)).toBeNull()
    expect(node.querySelector('.nav-section__title')).toBeNull()

    // 它就是这张列表里的最后一行，折叠头是「更多」
    const list = node.querySelector('nav > ul') as HTMLElement
    const lastRow = list.lastElementChild as HTMLElement
    expect(lastRow.tagName).toBe('LI')

    const details = lastRow.querySelector('details') as HTMLElement
    expect(details).toBeTruthy()
    const summary = details.querySelector('summary') as HTMLElement
    expect(summary.textContent?.trim()).toBe(messages['nav.more'])
    // 折叠头不是链接：点它只展开，没有「/more」这种落地页
    expect(summary.querySelector('a')).toBeNull()
    // 和其它折叠行一样带箭头
    expect(summary.querySelector('.nav-group__chevron')).not.toBeNull()

    // 子项是标了 more 的入口，且不重复主导航
    const childHrefs = [...details.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    expect(childHrefs).toEqual(['/says', '/projects'])
    for (const href of ['/articles', '/diaries', '/explore', '/friends']) {
      expect(childHrefs).not.toContain(href)
    }
  })

  it('「更多」里没有「全部」那一行：它自己没有列表页', () => {
    renderHeader()
    const node = openMenu()
    const details = [...node.querySelectorAll('details')].pop() as HTMLElement

    const summary = details.querySelector('summary') as HTMLElement
    const childLinks = [...details.querySelectorAll('a')].map((link) => link.textContent?.trim())
    // 与文章 / 日记不同，这里不该出现「全部…」的二次确认行
    expect(summary.textContent).toBe(messages['nav.more'])
    expect(childLinks).not.toContain(messages['nav.allArticles'])
    expect(childLinks.every((label) => !label?.startsWith('全部'))).toBe(true)
  })

  it('子项是当前页时「更多」默认展开，与目录型入口同一判定', () => {
    state.pathname = '/says'
    renderHeader()
    const node = openMenu()
    const details = [...node.querySelectorAll('details')].pop() as HTMLElement

    expect(details.hasAttribute('open')).toBe(true)
    const summary = details.querySelector('summary') as HTMLElement
    expect(summary.getAttribute('data-active')).toBe('true')
  })

  it('手风琴：展开一组时收起同列的其它组', () => {
    renderHeader()
    const node = openMenu()
    const groups = [...node.querySelectorAll('details')] as HTMLDetailsElement[]
    expect(groups.length).toBeGreaterThan(1)

    // jsdom 不实现「点 summary → 改 open → 派发 toggle」这条浏览器行为，手动模拟
    const openGroup = (el: HTMLDetailsElement) => {
      el.open = true
      fireEvent(el, new Event('toggle'))
    }

    openGroup(groups[0])
    expect(groups[0].open).toBe(true)

    openGroup(groups[1])
    expect(groups[1].open).toBe(true)
    // 上一组被收起：面板高度稳定，同时只展开一个
    expect(groups[0].open).toBe(false)

    // 展开最后一组（更多）时同样收起别的
    const last = groups[groups.length - 1]
    openGroup(last)
    expect(last.open).toBe(true)
    expect(groups.filter((group) => group.open)).toEqual([last])
  })

  it('手风琴不越界：收起只发生在同一张列表内', () => {
    renderHeader()
    const node = openMenu()

    // 列表外的 details 不该被波及（当前菜单只有一张列表，这条钉住作用域）
    const outside = document.createElement('details')
    outside.open = true
    node.parentElement?.appendChild(outside)

    const first = node.querySelector('details') as HTMLDetailsElement
    first.open = true
    fireEvent(first, new Event('toggle'))

    expect(outside.open).toBe(true)
    outside.remove()
  })

  it('没有分类时显示真实空态，且入口本身仍然可达', () => {
    render(
      <SiteHeaderClient
        nav={buildNav({
          '/articles': {
            entryLabel: 'nav.allArticles',
            emptyLabel: 'nav.noCategories',
            errorLabel: 'nav.categoriesUnavailable',
            status: 'empty',
            items: [],
          },
        })}
        siteName="Folio"
        avatarUrl={null}
        messages={messages}
        searchEnabled={false}
      />,
    )
    const node = openMenu()
    expect(node.textContent).toContain(messages['nav.noCategories'])
    // 空态不能把 /articles 一起藏掉
    expect(node.querySelector('a[href="/articles"]')).not.toBeNull()
  })

  it('设置已迁到页脚：菜单里不再有任何 radio 或设置标题', () => {
    renderHeader()
    const node = openMenu()

    // 全站唯一入口在页脚，菜单不再挂第二份：一个 radio 都不该出现
    expect(node.querySelectorAll('input[type="radio"]')).toHaveLength(0)
    expect(node.textContent).not.toContain(messages['nav.theme'])
    expect(node.textContent).not.toContain(messages['nav.language'])
    expect(node.querySelector('.nav-settings')).toBeNull()
  })
})

describe('菜单：关闭行为与焦点', () => {
  it('Escape 关闭并把焦点还给菜单按钮', async () => {
    renderHeader()
    openMenu()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menuButton())
    await waitFor(() => expect(panel()).toBeNull())
  })

  it('点击菜单外部关闭', async () => {
    renderHeader()
    openMenu()

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(panel()).toBeNull())
  })

  it('点在菜单内部不会关闭', () => {
    renderHeader()
    const node = openMenu()

    fireEvent.pointerDown(node)
    expect(panel()).not.toBeNull()
  })
})

describe('结构：玻璃层不能挂在带滤镜的卡片上', () => {
  /**
   * 回归护栏。`backdrop-filter` 会让元素成为 `position: fixed` 后代的包含块：
   * 一旦把 `.glass-nav` 直接写在 `.nav-card` 上，移动端菜单（fixed 到视口）
   * 就会被缩进卡片里 —— 实测面板宽度从 350px 掉到 161px。
   * 因此玻璃必须落在卡片内部独立的绝对定位层上。
   */
  it('玻璃与光斑是卡片内的独立层，卡片本身不带 glass-nav', () => {
    const { container } = renderHeader()
    const card = container.querySelector('.nav-card')

    expect(card).not.toBeNull()
    expect(card?.classList.contains('glass-nav')).toBe(false)
    expect(card?.querySelector(':scope > .nav-glass')).not.toBeNull()
    expect(card?.querySelector(':scope > .nav-spotlight')).not.toBeNull()
  })
})
