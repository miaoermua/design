// @vitest-environment jsdom
/**
 * 悬浮导航的信息架构与菜单 Settings
 *
 * 这一组固化三件事：
 *   1. 快捷栏只有四条（头像 / 博客 / 日记 / 菜单），探索与更多不在里面；
 *   2. 菜单是唯一承载完整导航的地方，顺序为 身份 → 主导航 → 更多 → Settings；
 *   3. Settings 不是第二套状态管理——它写的就是既有的 `folio-theme`
 *      与 `folio-lang`，语义（system = 删除键）与工具按钮完全一致。
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNav } from '@/core/navigation'
import { LOCALE_COOKIE } from '@/lib/i18n/config'
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
})

function renderHeader() {
  return render(
    <SiteHeaderClient
      nav={nav}
      siteName="Folio"
      avatarUrl={null}
      locale="zh-CN"
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
      // 收起靠断点规则；标记写在元素上，组件里不做视口判断
      expect(link?.closest('li')?.getAttribute('data-compact')).toBe('hide')
      expect(link?.getAttribute('data-compact')).toBe('hide')
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
  it('有下级的入口带一个下拉面板，第一项回到入口自身', () => {
    renderHeader()
    const flyout = document.querySelector('.nav-flyout') as HTMLElement

    expect(flyout).toBeTruthy()
    expect(flyout.querySelector('.nav-link')?.getAttribute('href')).toBe('/articles')

    const links = [...flyout.querySelectorAll('.nav-flyout__panel a')].map((link) =>
      link.getAttribute('href'),
    )
    // 子项来自 entry.branch，父级链接取自 entry 本身，没有第三份数据
    expect(links).toEqual(['/articles', '/categories/tech'])
    expect(flyout.querySelector('.nav-flyout__panel')?.textContent).toContain(
      messages['nav.allArticles'],
    )
  })

  it('下拉与菜单里是同一批子项（不是两套配置）', () => {
    renderHeader()
    const flyoutHrefs = [...document.querySelectorAll('.nav-flyout__panel a')].map((link) =>
      link.getAttribute('href'),
    )

    const node = openMenu()
    const menuHrefs = [...node.querySelectorAll('details a')].map((link) =>
      link.getAttribute('href'),
    )

    expect(flyoutHrefs).toEqual(menuHrefs)
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

  it('头像贴最左、链接整组贴右、中间留空由 margin-right:auto 推出来', () => {
    // 用 auto margin 而不是 space-between：条目数量变化时链接不会漂移
    expect(css).toMatch(/\.nav-quick__list > li:first-child \{[\s\S]*?margin-right: auto/)
    expect(css).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]*?\.nav-card \{[\s\S]*?justify-content: space-between/,
    )
  })

  it('桌面卡片比移动端更矮：手机 3.5rem、桌面 3.25rem', () => {
    expect(css).toContain('--nav-bar-height: 3.5rem')
    expect(css).toMatch(
      /@media \(min-width: 48rem\) \{[\s\S]*?\.nav-card \{[\s\S]*?height: 3\.25rem/,
    )
    // 占位块跟着卡片高度走，正文不会被盖住
    expect(css).toMatch(/\.site-nav-spacer \{[\s\S]*?height: calc\(3\.25rem \+ 1rem\)/)
  })

  it('菜单键与导航链接同一套外观：都是常态无边框、hover 才铺底', () => {
    const trigger = css.match(/\.nav-menu-trigger \{([\s\S]*?)\}/)?.[1] ?? ''
    // 不再给菜单键单独加一圈发丝边
    expect(trigger).not.toContain('box-shadow: inset')
    expect(trigger).not.toMatch(/(^|\n)\s*border:/)
    // 与 .nav-link 相同的圆角与 hover 底色
    expect(trigger).toContain('border-radius: var(--radius-sm)')
    expect(css).toMatch(/\.nav-link:hover \{[\s\S]*?background-color: var\(--nav-item-hover\)/)
    expect(css).toMatch(
      /\.nav-menu-trigger:hover \{[\s\S]*?background-color: var\(--nav-item-hover\)/,
    )
  })
})

describe('菜单：完整导航与分区', () => {
  it('主导航是文章 / 日记 / 探索 / 友链，顺序与 ALL_NAV 一致', () => {
    renderHeader()
    const node = openMenu()

    const main = node.querySelector('nav') as HTMLElement
    // 顶层行（不含折叠区里的子项）：文章折叠 / 日记 / 探索 / 友链
    const rows = [...main.querySelectorAll(':scope > ul > li')].map((li) =>
      (li.querySelector('summary, a') as HTMLElement).textContent?.trim(),
    )

    expect(rows).toEqual([
      messages['nav.articles'],
      messages['nav.diaries'],
      messages['nav.explore'],
      messages['nav.friends'],
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

    for (const href of ['/', '/articles', '/diaries', '/explore', '/friends', '/pages']) {
      expect([href, counts.get(href)]).toEqual([href, 1])
    }
  })

  it('「更多」只收标了 more 的入口，不重复主导航', () => {
    renderHeader()
    const node = openMenu()

    const more = node.querySelector(`section[aria-label="${messages['nav.more']}"]`) as HTMLElement
    expect(more).toBeTruthy()
    // 友链已经在主导航里，这里只剩页面入口
    expect([...more.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '/pages',
    ])
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
        locale="zh-CN"
        messages={messages}
        searchEnabled={false}
      />,
    )
    const node = openMenu()
    expect(node.textContent).toContain(messages['nav.noCategories'])
    // 空态不能把 /articles 一起藏掉
    expect(node.querySelector('a[href="/articles"]')).not.toBeNull()
  })

  it('Settings 在菜单尾部：主题三个图标 + 语言两个短标识', () => {
    renderHeader()
    const node = openMenu()

    const radios = [...node.querySelectorAll('input[type="radio"]')]
    expect(radios).toHaveLength(5)
    expect(node.textContent).toContain(messages['nav.theme'])
    expect(node.textContent).toContain(messages['nav.language'])

    // 主题只留图标：三个状态名都不再作为可见文字出现
    for (const key of ['action.modeSystem', 'action.modeLight', 'action.modeDark'] as const) {
      expect(node.textContent).not.toContain(messages[key])
    }

    // 语言只留「中」与「EN」，完整语言名不进可见文本
    const localeText = node.querySelectorAll('.nav-setting')[1]?.querySelectorAll('.nav-seg__text')
    expect([...(localeText ?? [])].map((span) => span.textContent)).toEqual(['中', 'EN'])
    expect(node.textContent).not.toContain('简体中文')
    expect(node.textContent).not.toContain('繁體中文')
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

describe('Settings：复用既有主题与语言状态', () => {
  const themeNames = ['action.modeSystem', 'action.modeLight', 'action.modeDark'] as const

  it('三个主题选项都是纯图标，无障碍名称来自 aria-label', () => {
    renderHeader()
    openMenu()

    for (const key of themeNames) {
      const radio = screen.getByRole('radio', { name: messages[key] }) as HTMLInputElement
      const label = radio.closest('label')
      expect(label?.querySelector('svg')).not.toBeNull()
      // 图标之外没有可见文字
      expect(label?.textContent?.trim()).toBe('')
      // 悬停提示与无障碍名称同源
      expect(label?.getAttribute('title')).toBe(messages[key])
    }
  })

  it('语言只有「中」与「EN」两项，无障碍名称是完整语言名', () => {
    renderHeader()
    openMenu()

    const radios = screen.getAllByRole('radio')
    const localeRadios = radios.filter((radio) => radio.getAttribute('name') === 'folio-nav-locale')
    expect(localeRadios).toHaveLength(2)
    expect(screen.getByRole('radio', { name: '中文' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: '繁體中文' })).toBeNull()
  })

  it('选「浅色」写入 folio-theme=light 并立刻改 data-theme', () => {
    renderHeader()
    openMenu()

    fireEvent.click(screen.getByRole('radio', { name: messages['action.modeLight'] }))

    expect(window.localStorage.getItem('folio-theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('选「深色」写入 folio-theme=dark', () => {
    renderHeader()
    openMenu()

    fireEvent.click(screen.getByRole('radio', { name: messages['action.modeDark'] }))

    expect(window.localStorage.getItem('folio-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('选「跟随系统」删除键，而不是写入 system', () => {
    window.localStorage.setItem('folio-theme', 'dark')
    renderHeader()
    openMenu()

    fireEvent.click(screen.getByRole('radio', { name: messages['action.modeSystem'] }))

    expect(window.localStorage.getItem('folio-theme')).toBeNull()
  })

  it('选中态与实际偏好一致：键缺失时勾「跟随系统」', () => {
    renderHeader()
    openMenu()

    const system = screen.getByRole('radio', {
      name: messages['action.modeSystem'],
    }) as HTMLInputElement
    expect(system.checked).toBe(true)
    expect(system.closest('label')?.getAttribute('data-active')).toBe('true')
  })

  it('选中态与实际偏好一致：键为 dark 时勾「深色」', () => {
    window.localStorage.setItem('folio-theme', 'dark')
    renderHeader()
    openMenu()

    const dark = screen.getByRole('radio', {
      name: messages['action.modeDark'],
    }) as HTMLInputElement
    expect(dark.checked).toBe(true)
    expect(dark.closest('label')?.getAttribute('data-active')).toBe('true')

    const light = screen.getByRole('radio', {
      name: messages['action.modeLight'],
    }) as HTMLInputElement
    expect(light.checked).toBe(false)
    expect(light.closest('label')?.getAttribute('data-active')).toBeNull()
  })

  it('选中态不只靠颜色：CSS 还给 data-active 画了形状标记', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/app/globals.css'), 'utf8')
    expect(css).toMatch(/\[data-active='true'\]::after/)
  })

  it('选语言写入既有 cookie，且菜单不因此关闭', () => {
    renderHeader()
    openMenu()

    fireEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`)
    expect(panel()).not.toBeNull()
  })

  it('当前语言就是当前项选中', () => {
    renderHeader()
    openMenu()

    const zh = screen.getByRole('radio', { name: '中文' }) as HTMLInputElement
    expect(zh.checked).toBe(true)
    expect(zh.closest('label')?.getAttribute('data-active')).toBe('true')
  })

  it('自动识别成英文时点「中」，手动选择立即落盘', () => {
    // 没有 cookie = 当前语言来自浏览器首选语言的自动识别（这里识别成了英文）。
    // 用户点「中」是第一次明确表态，必须写 cookie，从此不再被自动识别左右。
    render(
      <SiteHeaderClient
        nav={nav}
        siteName="Folio"
        avatarUrl={null}
        locale="en"
        messages={dictionary('en')}
        searchEnabled={false}
      />,
    )
    const englishMessages = dictionary('en')
    fireEvent.click(screen.getByRole('button', { name: englishMessages['action.menu'] }))
    const node = panel() as HTMLElement
    expect(node.textContent).toContain(englishMessages['nav.language'])
    fireEvent.click(screen.getByRole('radio', { name: '中文' }))

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=zh-CN`)
  })

  it('手动选过之后再点同一语言，不重复写 cookie', () => {
    document.cookie = `${LOCALE_COOKIE}=zh-CN; path=/`
    renderHeader()
    openMenu()

    const before = document.cookie
    const label = screen.getByRole('radio', { name: '中文' }).closest('label') as HTMLElement
    fireEvent.click(label)
    expect(document.cookie).toBe(before)
  })
})
