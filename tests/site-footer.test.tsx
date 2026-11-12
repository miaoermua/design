// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ThemeConfig } from '@/core/config/theme'
import type { SiteIdentity } from '@/lib/api'

const state = vi.hoisted(() => ({
  footer: {
    enabled: false,
    since: null as number | null,
    icp: { enabled: false, label: null as string | null, url: null as string | null },
  },
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
    // 社交图标是内联 SVG；页脚里不该出现任何图标
    expect(container.querySelector('svg')).toBeNull()
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
