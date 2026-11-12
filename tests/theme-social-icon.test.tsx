// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SocialIcon, socialLabel } from '@/components/ui/social-icon'
import { IMPLEMENTED_ICON_TYPES, parseThemeConfig } from '@/core/config/theme'
import type { ThemeSocialIcon } from '@/core/config/theme'
import { toSocialItems } from '@/lib/social'

/**
 * Social Icon 渲染
 *
 * 这里把「三种图标类型的实际支持状态」写成断言，而不是只写在报告里：
 * 以后有人加平台、改映射、或者悄悄把 iconify 当成已实现，这些测试会失败。
 */

afterEach(cleanup)

function renderIcon(icon: ThemeSocialIcon | null) {
  const { container } = render(<SocialIcon icon={icon} />)
  return container.querySelector('svg')
}

const builtin = (name: string): ThemeSocialIcon => ({ type: 'builtin', name })

describe('Social Icon：builtin', () => {
  it('每个已知平台都渲染出内联 SVG', () => {
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
      const svg = renderIcon(builtin(name))
      expect(svg, name).not.toBeNull()
      expect(svg?.getAttribute('viewBox'), name).toBe('0 0 24 24')
      expect(svg?.querySelectorAll('path, rect, circle').length, name).toBeGreaterThan(0)
    }
  })

  it('不引用外部 sprite 或图片', () => {
    const svg = renderIcon(builtin('github'))
    expect(svg?.querySelector('use')).toBeNull()
    expect(svg?.querySelector('image')).toBeNull()
    expect(svg?.getAttribute('fill')).toBe('none')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
  })

  it('大小写不敏感', () => {
    const lower = renderIcon(builtin('github'))?.innerHTML
    cleanup()
    const upper = renderIcon(builtin('GitHub'))?.innerHTML
    expect(upper).toBe(lower)
  })

  it('twitter 与 x、email 与 mail 分别共用图形', () => {
    const x = renderIcon(builtin('x'))?.innerHTML
    cleanup()
    expect(renderIcon(builtin('twitter'))?.innerHTML).toBe(x)
    cleanup()
    const email = renderIcon(builtin('email'))?.innerHTML
    cleanup()
    expect(renderIcon(builtin('mail'))?.innerHTML).toBe(email)
  })
})

describe('Social Icon：降级', () => {
  it('未知内置图标降级为通用图形，不是空白', () => {
    const svg = renderIcon(builtin('nonexistent-icon'))
    expect(svg).not.toBeNull()
    expect(svg?.querySelectorAll('path, rect, circle').length).toBeGreaterThan(0)
  })

  it('icon 为 null 时也画兜底图形', () => {
    const svg = renderIcon(null)
    expect(svg).not.toBeNull()
    expect(svg?.querySelectorAll('path, rect, circle').length).toBeGreaterThan(0)
  })

  it('iconify 明确降级为 SVG（当前没有运行时加载器）', () => {
    const svg = renderIcon({ type: 'iconify', name: 'mingcute:telegram-fill' })
    expect(svg).not.toBeNull()
    expect(IMPLEMENTED_ICON_TYPES).not.toContain('iconify')
  })

  it('css 类型渲染 <i class>，不产生 svg，也不产生脚本', () => {
    const { container } = render(<SocialIcon icon={{ type: 'css', name: 'fa fa-at' }} />)
    const i = container.querySelector('i')
    expect(i?.getAttribute('class')).toBe('fa fa-at')
    expect(i?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('css class 非法时降级为 SVG，而不是输出坏 class', () => {
    const svg = renderIcon({ type: 'css', name: 'fa" onload="alert(1)' })
    expect(svg).not.toBeNull()
  })

  it('空名字不抛错', () => {
    expect(() => renderIcon(builtin(''))).not.toThrow()
  })
})

describe('Social Icon：注入面', () => {
  it('配置里的 HTML / 选择器不会被当成图标内容', () => {
    for (const value of ['<svg onload=alert(1)>', 'ri-github-fill', 'fa fa-github']) {
      cleanup()
      const svg = renderIcon(builtin(value))
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg?.innerHTML).not.toContain('onload')
      expect(svg?.innerHTML).not.toContain('fa-github')
    }
  })
})

describe('Social：展示名', () => {
  it('已知平台用品牌名，未知平台回退键名', () => {
    expect(socialLabel('github')).toBe('GitHub')
    expect(socialLabel('bilibili')).toBe('哔哩哔哩')
    expect(socialLabel('rss')).toBe('RSS 订阅')
    expect(socialLabel('mastodon')).toBe('mastodon')
  })
})

describe('Social：与配置的衔接', () => {
  it('配置项的自定义图标与颜色进入渲染数据', () => {
    const theme = parseThemeConfig({
      social: {
        items: [
          {
            url: 'https://a.example/me',
            title: '自定义',
            icon: { type: 'builtin', name: 'rss' },
            color: '#FFA500',
          },
        ],
      },
    }).social
    const [item] = toSocialItems(null, { theme })
    expect(item?.icon).toEqual({ type: 'builtin', name: 'rss' })
    expect(item?.color).toBe('#FFA500')
    expect(renderIcon(item!.icon)).not.toBeNull()
  })

  it('API 派生项的默认图标是平台键', () => {
    const item = toSocialItems({ bilibili: '123' })[0]
    expect(item?.icon).toEqual({ type: 'builtin', name: 'bilibili' })
    expect(renderIcon(item!.icon)).not.toBeNull()
  })
})
