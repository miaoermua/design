// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SocialIconStylesheets } from '@/components/layout/social-icon-stylesheets'
import { parseThemeConfig } from '@/core/config/theme'

/**
 * 图标样式表输出
 *
 * 验证的是「何时输出」：只有真的存在 css 类型图标才加载样式表。
 * 这条规则如果写错，代价是每次首屏都多一个阻塞请求，而页面上根本
 * 没有人用那个字体——属于「看不出来但一直在付出」的问题，值得断言。
 */

beforeEach(() => {
  document.head.innerHTML = ''
})

afterEach(cleanup)

function iconLinks(): HTMLLinkElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      'link[data-precedence="folio-social-icons"]',
    ),
  )
}

function social(config: unknown) {
  return parseThemeConfig({ social: config }).social
}

describe('图标样式表：输出条件', () => {
  it('有 css 图标且配了样式表时输出 link', () => {
    render(
      <SocialIconStylesheets
        social={social({
          items: [{ url: 'https://a.example', icon: { type: 'css', name: 'fa fa-at' } }],
          icon_stylesheets: ['https://cdn.example/all.min.css'],
        })}
      />,
    )
    const links = iconLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('rel')).toBe('stylesheet')
    expect(links[0]?.getAttribute('href')).toBe('https://cdn.example/all.min.css')
  })

  it('全部是 builtin 图标时不输出（避免无意义请求）', () => {
    render(
      <SocialIconStylesheets
        social={social({
          items: [{ url: 'https://a.example', icon: { type: 'builtin', name: 'github' } }],
          icon_stylesheets: ['https://cdn.example/all.min.css'],
        })}
      />,
    )
    expect(iconLinks()).toHaveLength(0)
  })

  it('没有配置样式表时不输出', () => {
    render(
      <SocialIconStylesheets
        social={social({
          items: [{ url: 'https://a.example', icon: { type: 'css', name: 'fa fa-at' } }],
        })}
      />,
    )
    expect(iconLinks()).toHaveLength(0)
  })

  it('默认配置不输出任何 link', () => {
    render(<SocialIconStylesheets social={social({})} />)
    expect(iconLinks()).toHaveLength(0)
  })
})

describe('图标样式表：与 custom.css 分组隔离', () => {
  it('使用独立的 precedence 组', () => {
    render(
      <SocialIconStylesheets
        social={social({
          items: [{ url: 'https://a.example', icon: { type: 'css', name: 'fa fa-at' } }],
          icon_stylesheets: ['https://cdn.example/separate.css'],
        })}
      />,
    )
    expect(iconLinks()[0]?.getAttribute('data-precedence')).toBe('folio-social-icons')
  })

  it('多条时保持配置顺序', () => {
    render(
      <SocialIconStylesheets
        social={social({
          items: [{ url: 'https://a.example', icon: { type: 'css', name: 'fa fa-at' } }],
          icon_stylesheets: ['https://cdn.example/1.css', 'https://cdn.example/2.css'],
        })}
      />,
    )
    expect(iconLinks().map((l) => l.getAttribute('href'))).toEqual([
      'https://cdn.example/1.css',
      'https://cdn.example/2.css',
    ])
  })
})
