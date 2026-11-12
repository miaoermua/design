import { describe, expect, it } from 'vitest'
import { toSocialLinks } from '@/lib/social'

/**
 * Social 映射测试
 *
 * 核心约束：账号数据只来自 `/aggregate`，Theme Snippet 只控制
 * 显示开关、顺序与图标名。这里验证「配置不会凭空造出账号，
 * 也不会让已有账号消失」。
 */

const ids = {
  github: 'miaoermua',
  bilibili: '41605906',
  telegram: 'miaoer_subscribe',
  netease: '398534936',
  weird: 'https://example.com/me',
  empty: '',
}

describe('Social：账号来源', () => {
  it('只对有规则或完整 http(s) 的值生成链接', () => {
    const links = toSocialLinks(ids)
    const labels = links.map((l) => l.label)
    // netease 没有确定 URL 规则，值又是纯数字 id，因此被跳过——
    // 这是刻意的：猜地址会生成死链
    expect(labels).toEqual(['github', 'bilibili', 'telegram', 'weird'])
    expect(links.find((l) => l.label === 'github')?.href).toBe('https://github.com/miaoermua')
    expect(links.find((l) => l.label === 'weird')?.href).toBe('https://example.com/me')
    expect(labels).not.toContain('empty')
    expect(labels).not.toContain('netease')
  })

  it('email 生成 mailto', () => {
    expect(toSocialLinks({ email: 'a@b.com' })[0]?.href).toBe('mailto:a@b.com')
  })

  it('null / undefined 返回空数组', () => {
    expect(toSocialLinks(null)).toEqual([])
    expect(toSocialLinks(undefined)).toEqual([])
  })
})

describe('Social：Theme 配置', () => {
  it('order 排序：列出的按顺序，未列出的保持原序排在后面', () => {
    const links = toSocialLinks(ids, {
      theme: { enabled: true, order: ['telegram', 'github'], icons: {} },
    })
    expect(links.map((l) => l.label)).toEqual([
      'telegram',
      'github',
      // 未在 order 中的保持 /aggregate 原始相对顺序
      'bilibili',
      'weird',
    ])
  })

  it('order 中有无效平台不影响其它账号', () => {
    const links = toSocialLinks(ids, {
      theme: { enabled: true, order: ['not-exist', 'github'], icons: {} },
    })
    // 不存在的平台不会凭空出现，github 依然排到最前
    expect(links[0]?.label).toBe('github')
    expect(links).toHaveLength(4)
  })

  it('icons 覆盖只改图标名，不改 href', () => {
    const links = toSocialLinks(ids, {
      theme: { enabled: true, order: [], icons: { bilibili: 'bilibili' } },
    })
    const bili = links.find((l) => l.label === 'bilibili')
    expect(bili?.icon).toBe('bilibili')
    expect(bili?.href).toBe('https://space.bilibili.com/41605906')
    // 未配置图标的平台不带 icon 字段，交给组件按 label 回退
    expect(links.find((l) => l.label === 'github')?.icon).toBeUndefined()
  })

  it('未知图标名不会让该账号消失', () => {
    const links = toSocialLinks(ids, {
      theme: { enabled: true, order: [], icons: { github: 'nonexistent-icon' } },
    })
    const github = links.find((l) => l.label === 'github')
    expect(github).toBeDefined()
    expect(github?.href).toBe('https://github.com/miaoermua')
  })

  it('order 排序不修改原数组', () => {
    const input = { ...ids }
    const before = Object.keys(input)
    toSocialLinks(input, { theme: { enabled: true, order: ['telegram'], icons: {} } })
    expect(Object.keys(input)).toEqual(before)
  })
})
