// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ThemeConfig } from '@/core/config/theme'
import type { SiteIdentity } from '@/lib/api'

const state = vi.hoisted(() => ({
  footer: {
    enabled: false,
    since: null as number | null,
    icp: { enabled: false, label: null as string | null, url: null as string | null },
    /** `footer.links` 是追加的一排，默认空 */
    links: [] as { title: string; url: string }[],
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/core/config/theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/config/theme')>()
  return {
    ...actual,
    getThemeConfig: async () => ({ footer: state.footer }) as unknown as ThemeConfig,
  }
})

import { SiteFooter } from '@/components/layout/site-footer'

/**
 * Footer
 *
 * 结构是任务书里最容易被「顺手加回去」的部分：旧版有导航、社交、RSS 和
 * 一串项目链接。这里把「已经没有这些」也写成断言，避免回退时无人察觉。
 */

afterEach(cleanup)

const identity: SiteIdentity = {
  title: '手记',
  description: '记录一些想法',
  keywords: [],
  icon: null,
  siteUrl: 'https://blog.example',
  owner: { name: 'Miao', introduce: '写点东西', avatar: null, socialIds: {} },
  commentsEnabled: false,
  latestDiaryId: null,
}

async function renderFooter(
  overrides: Partial<typeof state.footer> = {},
  id: SiteIdentity | null = identity,
) {
  state.footer = {
    enabled: false,
    since: 2021,
    icp: { enabled: false, label: null, url: null },
    links: [],
    ...overrides,
  }
  const view = render(await SiteFooter({ identity: id }))
  return view
}

describe('Footer 第一栏', () => {
  it('把年份区间、名字与个性签名放在同一段信息里', async () => {
    await renderFooter()

    expect(screen.getByText(`© 2021–${new Date().getFullYear()}`)).toBeTruthy()
    expect(screen.getByText('Miao')).toBeTruthy()
    expect(screen.getByText('写点东西')).toBeTruthy()
  })

  it('没有配置 since 时退回当前年份，不编造站龄', async () => {
    await renderFooter({ since: null })
    expect(screen.getByText(`© ${new Date().getFullYear()}`)).toBeTruthy()
  })

  it('identity 缺失时用站点标题兜底，不出现 undefined', async () => {
    await renderFooter({}, null)
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('不渲染头像与社交图标', async () => {
    const { container } = await renderFooter()
    expect(container.querySelector('img')).toBeNull()
    // 版权行与链接行不该出现图标（页脚唯一的 SVG 来自设置区：语言/主题图标）
    expect(container.querySelector('a svg')).toBeNull()
    expect(container.querySelector('p svg')).toBeNull()
    expect(container.querySelector('a[href*="twitter"], a[href*="mastodon"]')).toBeNull()
  })
})

describe('Footer 第二栏', () => {
  it('Mix-Space 与 Design 都是外链，指向各自仓库', async () => {
    await renderFooter()

    const core = screen.getByRole('link', { name: 'Mix-Space' })
    const theme = screen.getByRole('link', { name: 'Design' })

    expect(core.getAttribute('href')).toBe('https://github.com/mx-space/core')
    expect(theme.getAttribute('href')).toBe('https://github.com/miaoermua/design')
    expect(core.getAttribute('target')).toBe('_blank')
    expect(theme.getAttribute('rel')).toContain('noopener')
  })

  it('ICP 开启时紧邻 Powered by 输出原文本与备案链接', async () => {
    await renderFooter({
      icp: { enabled: true, label: '浙ICP备00000000号', url: 'https://beian.miit.gov.cn/' },
    })

    const icp = screen.getByRole('link', { name: '浙ICP备00000000号' })
    expect(icp.getAttribute('href')).toBe('https://beian.miit.gov.cn/')
    // 与 Powered by 处在同一段里
    expect(icp.closest('p')?.textContent).toContain('Powered by')
  })

  it('ICP 未开启时不输出任何备案文本', async () => {
    await renderFooter({ icp: { enabled: false, label: '浙ICP备00000000号', url: null } })
    expect(screen.queryByText('浙ICP备00000000号')).toBeNull()
  })

  it('ICP 链接非法时退回官方查询入口，不渲染坏地址', async () => {
    await renderFooter({ icp: { enabled: true, label: '浙ICP备00000000号', url: null } })
    expect(screen.getByRole('link', { name: '浙ICP备00000000号' }).getAttribute('href')).toBe(
      'https://beian.miit.gov.cn/',
    )
  })
})

describe('Footer 第三栏：自定义链接', () => {
  it('没配置时不渲染这一排，也不留空行', async () => {
    const { container } = await renderFooter({ links: [] })
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('站内路径与外部地址都渲染，外部地址新窗口打开', async () => {
    await renderFooter({
      links: [
        { title: '关于', url: '/about' },
        { title: '友链', url: 'https://example.com/friends' },
      ],
    })

    const about = screen.getByRole('link', { name: '关于' })
    expect(about.getAttribute('href')).toBe('/about')
    // 站内链接不做 target="_blank"
    expect(about.getAttribute('target')).toBeNull()

    const friends = screen.getByRole('link', { name: '友链' })
    expect(friends.getAttribute('href')).toBe('https://example.com/friends')
    expect(friends.getAttribute('target')).toBe('_blank')
    expect(friends.getAttribute('rel')).toContain('noopener')
  })

  it('是追加而不是覆盖：Powered by 与 ICP 仍按原样输出', async () => {
    await renderFooter({
      icp: { enabled: true, label: '浙ICP备00000000号', url: null },
      links: [{ title: '关于', url: '/about' }],
    })

    expect(screen.getByRole('link', { name: 'Mix-Space' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Design' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '浙ICP备00000000号' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '关于' })).toBeTruthy()
  })
})

describe('Footer 已删除的旧内容', () => {
  it('不再有页脚导航、RSS 与项目宣传链接', async () => {
    const { container } = await renderFooter()

    expect(container.querySelectorAll('footer nav')).toHaveLength(0)
    expect(container.querySelector('a[href="/feed"]')).toBeNull()
    expect(screen.queryByText(/RSS/i)).toBeNull()
    expect(screen.queryByText(/Mix Space 社区|Mix Space community/)).toBeNull()

    // 页脚里只有 Mix-Space、Design（以及可选的 ICP）三个链接
    expect(container.querySelectorAll('a')).toHaveLength(2)
  })
})

/**
 * 分区结构：信息区在左、设置区在右
 *
 * jsdom 没有布局引擎，算不出「谁在右」——这里锁的是**结构契约**：
 * 两个平级区域、DOM 顺序（信息在前，单列堆叠时自然在上）、
 * 以及 grid 的两列定义写在 CSS 里。真实几何（x 坐标、是否换行、
 * 是否被回顶浮标压住）由 `scripts/visual/footer-layout.mjs` 在浏览器里量。
 */
describe('Footer 分区结构', () => {
  function globalsCss(): string {
    return readFileSync(join(import.meta.dirname, '../src/app/globals.css'), 'utf8')
  }

  /** 取一条 CSS 规则的声明体（第一个 `{` 到配对 `}` 之间） */
  function ruleBody(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`)
    expect(start).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('}', start))
  }

  /** 只取页脚布局那一节：文件名里有 48rem 的媒体查询不止一处，不能全文搜 */
  function footerLayoutCss(): string {
    const css = globalsCss()
    const start = css.indexOf('── Footer 布局')
    const end = css.indexOf('.footer-lang {')
    expect(start).toBeGreaterThan(-1)
    return css.slice(start, end)
  }

  it('页脚内部是两个平级区域，信息区在前、设置区在后', async () => {
    const { container } = await renderFooter()

    const inner = container.querySelector('.site-footer__inner')
    expect(inner).not.toBeNull()

    const regions = [...(inner?.children ?? [])]
    expect(regions).toHaveLength(2)
    expect(regions[0]?.className).toContain('site-footer__info')
    expect(regions[1]?.className).toContain('site-footer__settings')

    // 设置区**只**出现在右侧那一栏里，不再横在信息区上方
    const settings = container.querySelectorAll('.footer-settings')
    expect(settings).toHaveLength(1)
    expect(regions[1]?.contains(settings[0])).toBe(true)
  })

  it('信息区第一行是版权行，第二行是出处与备案', async () => {
    await renderFooter({
      icp: { enabled: true, label: '浙ICP备00000000号', url: null },
      links: [{ title: '关于', url: '/about' }],
    })

    const info = document.querySelector('.site-footer__info') as HTMLElement
    const [first, second] = [...info.querySelectorAll(':scope > p')]

    expect(first?.textContent).toContain('©')
    expect(first?.textContent).toContain('Miao')
    expect(second?.textContent).toContain('Powered by')
  })

  it('第二行里出处、备案与自定义链接共处同一条流，不拆成多段', async () => {
    await renderFooter({
      icp: { enabled: true, label: '浙ICP备00000000号', url: null },
      links: [
        { title: '关于', url: '/about' },
        { title: '友链', url: 'https://example.com/friends' },
      ],
    })

    const meta = document.querySelector('.site-footer__meta') as HTMLElement
    expect(meta).not.toBeNull()

    // 四个链接全部落在**同一个** <p> 里：换行由 flex-wrap 决定，不是靠多段落
    for (const name of ['Mix-Space', 'Design', '浙ICP备00000000号', '关于', '友链']) {
      const node = screen.getByRole('link', { name })
      expect(node.closest('p')).toBe(meta)
    }

    // 信息区只有 2 个段落：链接没有各自成段
    expect(document.querySelectorAll('.site-footer__info > p')).toHaveLength(2)
  })

  it('分隔符与它后面的链接绑成不可拆的单元', async () => {
    await renderFooter({
      icp: { enabled: true, label: '浙ICP备00000000号', url: null },
      links: [{ title: '关于', url: '/about' }],
    })

    const units = [...document.querySelectorAll('.site-footer__meta-unit')]
    // Powered by + 备案 + 关于 = 3 个单元
    expect(units).toHaveLength(3)

    // 除第一个（Powered by），每个单元都以分隔符开头、紧跟自己的链接——
    // 换行时「｜」不会孤零零留在上一行行尾
    for (const unit of units.slice(1)) {
      expect(unit.firstElementChild?.className).toContain('footer-sep')
      expect(unit.querySelector('a')).not.toBeNull()
    }
    expect(units[0]?.textContent).toContain('Powered by')
  })

  it('桌面端两列布局：信息吃剩余宽度，设置按内容收窄', () => {
    const section = footerLayoutCss()

    expect(section).toContain('grid-template-columns: minmax(0, 1fr) auto;')
    // 设置区贴到右边缘，而不是继续靠左
    expect(section).toContain('justify-content: flex-end;')
    // 两列只在 ≥48rem 生效
    expect(section).toContain('@media (min-width: 48rem)')
  })

  it('窄屏单列且可换行，不会横向溢出', () => {
    const css = globalsCss()
    const section = footerLayoutCss()

    // 基础规则是单列
    expect(ruleBody(css, '.site-footer__inner')).toContain('grid-template-columns: minmax(0, 1fr);')
    // 第二行是可换行的流；链接自身 nowrap（组件里写死）
    expect(ruleBody(css, '.site-footer__meta')).toContain('flex-wrap: wrap;')
    // 信息区允许收缩到列宽内，长链接不撑破 grid
    expect(ruleBody(css, '.site-footer__info')).toContain('min-width: 0;')
    // 极窄屏（<22rem）给浮标让出右侧：控件组各占一行，而不是被压住
    expect(section).toContain('@media (max-width: 22rem)')
  })

  it('分隔符只留右侧间距，左边距交给容器的 column-gap', () => {
    const css = globalsCss()
    const sep = ruleBody(css, '.footer-sep')

    // 双侧 margin 会让换到行首的分隔符带着左间距一起换行，第二行看着像缩进了一格
    expect(sep).toContain('margin-inline-end: 0.55em;')
    expect(sep).not.toContain('margin-inline:')
    // 间距的承担者
    expect(ruleBody(css, '.site-footer__meta')).toContain('column-gap: 0.55em;')
  })

  it('信息单元用 nowrap 保持整体不折行，不用 inline-flex', () => {
    // inline-flex 会吞掉文本节点首尾空白 → 渲染成 "Powered byMix-Space.Design."
    const unit = ruleBody(globalsCss(), '.site-footer__meta-unit')
    expect(unit).toContain('white-space: nowrap;')
    expect(unit).not.toContain('display: inline-flex')
  })

  it('旧的「靠左排 / 预留 4.5rem」不再残留', () => {
    const css = globalsCss()

    // padding-right 曾加在 .footer-settings 上：对左对齐的 flex 行毫无作用
    expect(ruleBody(css, '.footer-settings')).not.toContain('padding-right')
    // 注释里「靠左排」「不分居两端」的描述已作废
    expect(css).not.toContain('靠左排')
    expect(css).not.toContain('不分居两端')
  })
})
