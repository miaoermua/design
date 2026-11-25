// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ThemeConfig } from '@/core/config/theme'
import type { SiteIdentity } from '@/lib/api'

const state = vi.hoisted(() => ({ footer: {} as ThemeConfig['footer'] }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}))
vi.mock('@/lib/i18n/server', () => ({ getLocale: async () => 'zh-CN' }))
vi.mock('@/core/config/theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/config/theme')>()
  return {
    ...actual,
    getThemeConfig: async () => ({ footer: state.footer }) as unknown as ThemeConfig,
  }
})

import { SiteFooter } from '@/components/layout/site-footer'

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
  overrides: Partial<ThemeConfig['footer']> = {},
  id: SiteIdentity | null = identity,
) {
  state.footer = {
    since: 2021,
    icp: { enabled: false, label: null, url: null },
    linkSections: [],
    ...overrides,
  }
  return render(await SiteFooter({ identity: id }))
}

const sections: ThemeConfig['footer']['linkSections'] = [
  {
    name: '关于',
    links: [
      { name: '关于本站', href: '/about-site', external: false },
      { name: '关于我', href: '/about', external: false },
      { name: '项目地址', href: 'https://github.com/innei/Shiro', external: true },
    ],
  },
  { name: '联系', links: [{ name: '发邮件', href: 'mailto:i@example.com', external: true }] },
]

describe('Footer 信息与设置', () => {
  it('年份区间、名字与个性签名在同一段信息里', async () => {
    await renderFooter()
    expect(screen.getByText(`© 2021–${new Date().getFullYear()}`)).toBeTruthy()
    expect(screen.getByText('Miao')).toBeTruthy()
    expect(screen.getByText('写点东西')).toBeTruthy()
  })

  it('没有 since 时退回当前年份；identity 缺失时不出现 undefined', async () => {
    await renderFooter({ since: null }, null)
    expect(screen.getByText(`© ${new Date().getFullYear()}`)).toBeTruthy()
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('Mix-Space 与 Design 是外链，ICP 开启时仍在出处行', async () => {
    await renderFooter({ icp: { enabled: true, label: '浙ICP备00000000号', url: null } })
    const core = screen.getByRole('link', { name: 'Mix-Space' })
    const design = screen.getByRole('link', { name: 'Design' })
    const icp = screen.getByRole('link', { name: '浙ICP备00000000号' })
    expect(core.getAttribute('href')).toBe('https://github.com/mx-space/core')
    expect(design.getAttribute('href')).toBe('https://github.com/miaoermua/design')
    expect(core.getAttribute('target')).toBe('_blank')
    expect(icp.getAttribute('href')).toBe('https://beian.miit.gov.cn/')
    expect(icp.closest('p')?.textContent).toContain('Powered by')
  })

  it('不渲染头像、社交图标或隐式 RSS', async () => {
    const { container } = await renderFooter()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a[href="/feed"]')).toBeNull()
    expect(screen.queryByText(/RSS/i)).toBeNull()
  })
})

describe('Footer Shiro 分类导航', () => {
  it('未配置 linkSections 时不渲染 nav，也不留空行', async () => {
    const { container } = await renderFooter()
    expect(container.querySelector('footer nav')).toBeNull()
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('footer')?.className).not.toContain('site-footer--has-nav')
  })

  it('按配置顺序渲染分类名、箭头与链接，导航位于信息区上方', async () => {
    const { container } = await renderFooter({ linkSections: sections })
    const nav = screen.getByRole('navigation', { name: '页脚导航' })
    const groups = [...nav.querySelectorAll('.site-footer__nav-group')]
    expect(
      groups.map((group) => group.querySelector('.site-footer__nav-label')?.textContent),
    ).toEqual(['关于', '联系'])
    expect(nav.querySelectorAll('.site-footer__nav-chevron[aria-hidden="true"]')).toHaveLength(2)
    const inner = container.querySelector('.site-footer__inner')!
    expect(nav.compareDocumentPosition(inner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('footer')?.className).toContain('site-footer--has-nav')
  })

  it('站内链接走 Link，外部链接与 mailto 新窗口打开', async () => {
    await renderFooter({ linkSections: sections })
    const about = screen.getByRole('link', { name: '关于我' })
    const project = screen.getByRole('link', { name: '项目地址' })
    const mail = screen.getByRole('link', { name: '发邮件' })
    expect(about.getAttribute('href')).toBe('/about')
    expect(about.getAttribute('target')).toBeNull()
    expect(project.getAttribute('href')).toBe('https://github.com/innei/Shiro')
    expect(project.getAttribute('target')).toBe('_blank')
    expect(project.getAttribute('rel')).toContain('noopener')
    expect(mail.getAttribute('href')).toBe('mailto:i@example.com')
    expect(mail.getAttribute('target')).toBe('_blank')
  })

  it('分类导航不覆盖或替换版权、Powered by 与 ICP', async () => {
    await renderFooter({
      linkSections: sections,
      icp: { enabled: true, label: '浙ICP备00000000号', url: null },
    })
    const nav = document.querySelector('footer nav')!
    expect(nav.textContent).not.toContain('Powered by')
    expect(nav.textContent).not.toContain('©')
    expect(screen.getByRole('link', { name: 'Mix-Space' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '浙ICP备00000000号' })).toBeTruthy()
  })
})

describe('Footer 分区与样式契约', () => {
  function globalsCss(): string {
    return readFileSync(join(import.meta.dirname, '../src/app/globals.css'), 'utf8')
  }
  function ruleBody(css: string, selector: string): string {
    const start = css.indexOf(`\n${selector} {`)
    expect(start).toBeGreaterThan(-1)
    return css.slice(start + 1, css.indexOf('}', start))
  }
  function footerLayoutCss(): string {
    const css = globalsCss()
    const start = css.indexOf('── Footer 布局')
    const end = css.indexOf('.footer-lang {')
    expect(start).toBeGreaterThan(-1)
    return css.slice(start, end)
  }

  it('信息区与设置区仍是两个平级区域，信息在前', async () => {
    const { container } = await renderFooter({ linkSections: sections })
    const regions = [...container.querySelector('.site-footer__inner')!.children]
    expect(regions).toHaveLength(2)
    expect(regions[0]?.className).toContain('site-footer__info')
    expect(regions[1]?.className).toContain('site-footer__settings')
    expect(container.querySelectorAll('.footer-settings')).toHaveLength(1)
  })

  it('信息区始终只有版权行与出处行两段', async () => {
    await renderFooter({
      linkSections: sections,
      icp: { enabled: true, label: '浙ICP备00000000号', url: null },
    })
    const paragraphs = [...document.querySelectorAll('.site-footer__info > p')]
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]?.textContent).toContain('©')
    expect(paragraphs[1]?.textContent).toContain('Powered by')
    expect(paragraphs[1]?.textContent).not.toContain('关于我')
  })

  it('手机导航分组竖排，桌面改为横排且可折行', () => {
    const css = globalsCss()
    const section = footerLayoutCss()
    expect(ruleBody(css, '.site-footer__nav-list')).toContain('flex-direction: column')
    expect(css).toMatch(
      /\.site-footer__nav-list,\s*\.site-footer__nav-links \{[^}]*flex-wrap: wrap/,
    )
    expect(section).toContain('flex-direction: row')
    expect(section).toContain('@media (min-width: 48rem)')
  })

  it('有导航时信息区不重复叠加顶部内边距', () => {
    const css = globalsCss()
    expect(ruleBody(css, '.site-footer--has-nav .site-footer__inner')).toContain('padding-top: 0')
    expect(ruleBody(css, '.site-footer__inner')).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(footerLayoutCss()).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(footerLayoutCss()).toContain('justify-content: flex-end')
  })

  it('导航链接有可见焦点与足够点击高度', () => {
    const css = globalsCss()
    expect(ruleBody(css, '.site-footer__nav-link')).toContain('min-height: 2rem')
    expect(ruleBody(css, '.site-footer__nav-link:focus-visible')).toContain('outline:')
  })
})
