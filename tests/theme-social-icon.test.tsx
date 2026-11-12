// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SocialIcon, socialLabel } from '@/components/ui/social-icon'
import { toSocialLinks } from '@/lib/social'

/**
 * Social Icon 覆盖审计
 *
 * 这里把「图标支持范围」写成断言，而不是只写在报告里：
 * 以后有人加平台、改映射、或者不小心引入图标字体，这些测试会立刻失败。
 */

afterEach(cleanup)

/** 从渲染结果里取出 svg 的 path 数量，用来判断「是否真的画了东西」 */
function renderIcon(name: string) {
  const { container } = render(<SocialIcon name={name} />)
  const svg = container.querySelector('svg')
  return svg
}

describe('Social Icon：内置图标', () => {
  it('每个已知平台都渲染出内置 SVG', () => {
    for (const name of [
      'github',
      'x',
      'twitter',
      'telegram',
      'bilibili',
      'zhihu',
      'email',
      'mail',
      'netease',
      'rss',
    ]) {
      const svg = renderIcon(name)
      expect(svg, name).not.toBeNull()
      expect(svg?.getAttribute('viewBox'), name).toBe('0 0 24 24')
      expect(svg?.querySelectorAll('path, rect, circle').length, name).toBeGreaterThan(0)
    }
  })

  it('不加载任何图标字体或外部资源', () => {
    const svg = renderIcon('github')
    // 只允许当前色描边，不允许 <use href> 引用外部 sprite
    expect(svg?.querySelector('use')).toBeNull()
    expect(svg?.querySelector('image')).toBeNull()
    expect(svg?.getAttribute('fill')).toBe('none')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
  })

  it('大小写不敏感', () => {
    const lower = renderIcon('github')?.innerHTML
    cleanup()
    const upper = renderIcon('GitHub')?.innerHTML
    expect(upper).toBe(lower)
  })

  it('twitter 与 x 共用一个图形（同一平台的两个键）', () => {
    const x = renderIcon('x')?.innerHTML
    cleanup()
    const twitter = renderIcon('twitter')?.innerHTML
    expect(twitter).toBe(x)
  })

  it('email 与 mail 共用一个图形', () => {
    const email = renderIcon('email')?.innerHTML
    cleanup()
    const mail = renderIcon('mail')?.innerHTML
    expect(mail).toBe(email)
  })
})

describe('Social Icon：降级行为', () => {
  it('未知图标名降级为通用图形，不是空白', () => {
    const svg = renderIcon('nonexistent-icon')
    expect(svg).not.toBeNull()
    // 降级图形必须有实际内容，否则页面上就是一个看不见的空位
    expect(svg?.querySelectorAll('path, rect, circle').length).toBeGreaterThan(0)
  })

  it('空名字也不抛错', () => {
    expect(() => renderIcon('')).not.toThrow()
  })

  it('配置里的任意 class / SVG 不会被当成图标', () => {
    // 这些字符串只会查表失败，走 default 分支
    for (const value of ['fa fa-github', '<svg onload=alert(1)>', 'ri-github-fill']) {
      const svg = renderIcon(value)
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg?.innerHTML).not.toContain('fa-github')
      expect(svg?.innerHTML).not.toContain('onload')
    }
  })
})

describe('Social Icon：展示名', () => {
  it('已知平台用品牌名', () => {
    expect(socialLabel({ label: 'github', href: '#' })).toBe('GitHub')
    expect(socialLabel({ label: 'bilibili', href: '#' })).toBe('哔哩哔哩')
    expect(socialLabel({ label: 'rss', href: '#' })).toBe('RSS 订阅')
  })

  it('未知平台回退到原始键名', () => {
    expect(socialLabel({ label: 'mastodon', href: '#' })).toBe('mastodon')
  })
})

describe('Social Icon：与链接映射的衔接', () => {
  it('图标覆盖只影响图形，链接地址不变', () => {
    const links = toSocialLinks(
      { github: 'someone' },
      { theme: { enabled: true, order: [], icons: { github: 'rss' } } },
    )
    expect(links[0]?.href).toBe('https://github.com/someone')
    expect(links[0]?.icon).toBe('rss')
    // 覆盖后的图标依然能被渲染
    const svg = renderIcon(links[0]!.icon!)
    expect(svg).not.toBeNull()
  })

  it('未配置图标时用平台键查表', () => {
    const links = toSocialLinks(
      { bilibili: '123' },
      { theme: { enabled: true, order: [], icons: {} } },
    )
    const name = links[0]?.icon ?? links[0]?.label
    expect(name).toBe('bilibili')
    expect(renderIcon(name!)).not.toBeNull()
  })
})
