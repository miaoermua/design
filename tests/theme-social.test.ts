import { describe, expect, it } from 'vitest'
import { parseThemeConfig } from '@/core/config/theme'
import { needsIconStylesheets, toSocialItems } from '@/lib/social'

/**
 * Social 合并测试
 *
 * 核心约束有三条，分别对应三个 describe：
 *   1. API 数据继续可用（不能因为改了配置结构就把已有账号弄丢）；
 *   2. 自定义项目可以补充 API，且同平台允许多条；
 *   3. 唯一标识是 URL 而不是平台名，冲突时以配置为准。
 */

const ids = {
  github: 'miaoermua',
  bilibili: '41605906',
  telegram: 'miaoer_subscribe',
  netease: '398534936',
  weird: 'https://example.com/me',
  empty: '',
}

/** 只取 URL，方便断言顺序 */
function urls(items: { url: string }[]): string[] {
  return items.map((item) => item.url)
}

describe('Social：API 数据', () => {
  it('只对有规则或完整 http(s) 的值生成链接', () => {
    const items = toSocialItems(ids)
    expect(items.map((item) => item.platform)).toEqual(['github', 'bilibili', 'telegram', 'weird'])
    expect(items.find((i) => i.platform === 'github')?.url).toBe('https://github.com/miaoermua')
    expect(items.find((i) => i.platform === 'weird')?.url).toBe('https://example.com/me')
    // netease 没有确定 URL 规则，值又是纯数字 id，因此跳过——猜地址会生成死链
    expect(items.map((i) => i.platform)).not.toContain('netease')
    expect(items.map((i) => i.platform)).not.toContain('empty')
  })

  it('email 生成 mailto', () => {
    expect(toSocialItems({ email: 'a@b.com' })[0]?.url).toBe('mailto:a@b.com')
  })

  it('null / undefined 返回空数组', () => {
    expect(toSocialItems(null)).toEqual([])
    expect(toSocialItems(undefined)).toEqual([])
  })

  it('标题用品牌名，未收录平台用键名', () => {
    const items = toSocialItems({ github: 'x', mastodon: 'https://m.example/@a' })
    expect(items.find((i) => i.platform === 'github')?.title).toBe('GitHub')
    expect(items.find((i) => i.platform === 'mastodon')?.title).toBe('mastodon')
  })

  it('id 稳定且带来源前缀', () => {
    expect(toSocialItems({ github: 'x' })[0]?.id).toBe('api:github')
  })
})

describe('Social：旧协议字段不再生效', () => {
  it('order 被忽略，API 项保持 /aggregate 原始顺序', () => {
    const theme = parseThemeConfig({ social: { order: ['telegram', 'github'] } }).social
    expect(toSocialItems(ids, { theme }).map((i) => i.platform)).toEqual([
      'github',
      'bilibili',
      'telegram',
      'weird',
    ])
  })

  it('icons 被忽略，API 项图标仍是平台键', () => {
    const theme = parseThemeConfig({ social: { icons: { bilibili: 'rss' } } }).social
    const bili = toSocialItems(ids, { theme }).find((i) => i.platform === 'bilibili')
    expect(bili?.icon).toEqual({ type: 'builtin', name: 'bilibili' })
  })

  it('旧字段不进入解析结果', () => {
    const social = parseThemeConfig({
      social: { order: ['github'], icons: { github: 'rss' } },
    }).social
    expect(Object.keys(social).sort()).toEqual(['enabled', 'iconStylesheets', 'items'])
  })

  it('不修改传入的 socialIds', () => {
    const input = { ...ids }
    const before = Object.keys(input)
    const theme = parseThemeConfig({ social: {} }).social
    toSocialItems(input, { theme })
    expect(Object.keys(input)).toEqual(before)
  })
})

describe('Social：API 与自定义项目合并', () => {
  const theme = parseThemeConfig({
    social: {
      items: [
        { url: 'https://pd.qq.com/s/65559jzrr', title: 'QQ 频道', color: '#12b7f5' },
        // 与 API 的 github 是同一个 URL：应被配置项接管
        { url: 'https://github.com/miaoermua', title: 'GitHub（自定义）' },
        // 同平台多条：两个 Telegram 链接都应保留
        { url: 'https://t.me/miaoer_subscribe/92', title: 'Telegram Group' },
        { url: 'https://t.me/miaoer_subscribe', title: 'Telegram Channel' },
      ],
    },
  }).social

  it('自定义项目在前，API 项目在后', () => {
    const items = toSocialItems(ids, { theme })
    expect(items.slice(0, 3).map((i) => i.source)).toEqual(['theme', 'theme', 'theme'])
    expect(items.filter((i) => i.source === 'api').length).toBeGreaterThan(0)
  })

  it('同平台允许多个不同项目', () => {
    const items = toSocialItems(ids, { theme })
    const telegram = items.filter((i) => i.url.includes('t.me/'))
    expect(telegram.map((i) => i.title)).toEqual(['Telegram Group', 'Telegram Channel'])
  })

  it('不按平台名去重：同平台不同 URL 的多条都保留', () => {
    const items = toSocialItems(ids, { theme })
    // 配置里有两条 Telegram（Group / Channel），API 的 telegram 与 Channel
    // 指向同一个 URL，因此被配置项接管——最终是 2 条而不是 3 条。
    // 这条断言同时验证了「按 URL 去重、按平台名不去重」两件事。
    const telegram = items.filter((i) => i.url.includes('t.me/'))
    expect(telegram).toHaveLength(2)
    expect(new Set(telegram.map((i) => i.url)).size).toBe(2)
  })

  it('URL 冲突时以配置为准，且不重复出现', () => {
    const items = toSocialItems(ids, { theme })
    const github = items.filter((i) => i.url === 'https://github.com/miaoermua')
    expect(github).toHaveLength(1)
    expect(github[0]?.title).toBe('GitHub（自定义）')
    expect(github[0]?.source).toBe('theme')
  })

  it('API 中未被覆盖的项目继续保留', () => {
    const items = toSocialItems(ids, { theme })
    expect(urls(items)).toContain('https://space.bilibili.com/41605906')
    expect(urls(items)).toContain('https://example.com/me')
  })

  it('配置项 id 用序号，API 项 id 用平台名，整体唯一', () => {
    const items = toSocialItems(ids, { theme })
    const idsSeen = items.map((i) => i.id)
    expect(new Set(idsSeen).size).toBe(idsSeen.length)
    expect(idsSeen[0]).toBe('theme:0')
  })

  it('配置为空时行为与只用 API 完全一致', () => {
    const emptyTheme = parseThemeConfig({ social: {} }).social
    expect(toSocialItems(ids, { theme: emptyTheme }).map((i) => i.url)).toEqual(
      toSocialItems(ids).map((i) => i.url),
    )
  })
})

describe('Social：频道标记', () => {
  it('默认 false：普通社交链接不会被当成订阅频道', () => {
    const social = parseThemeConfig({
      social: { items: [{ url: 'https://t.me/a', title: 'A' }] },
    }).social
    expect(social.items[0]?.channel).toBe(false)
  })

  it('只有布尔 true 才算频道，字符串 "true" 不算', () => {
    const social = parseThemeConfig({
      social: {
        items: [
          { url: 'https://t.me/a', title: 'A', channel: true },
          { url: 'https://t.me/b', title: 'B', channel: 'true' },
          { url: 'https://t.me/c', title: 'C', channel: 1 },
        ],
      },
    }).social
    expect(social.items.map((item) => item.channel)).toEqual([true, false, false])
  })
})

describe('Social：图标样式表按需加载', () => {
  it('有 css 图标且配了样式表才需要加载', () => {
    const social = parseThemeConfig({
      social: {
        items: [{ url: 'https://a.example', icon: { type: 'css', name: 'fa fa-at' } }],
        icon_stylesheets: ['https://cdn.example/all.css'],
      },
    }).social
    expect(needsIconStylesheets(social)).toBe(true)
  })

  it('只有 builtin 图标时不加载', () => {
    const social = parseThemeConfig({
      social: {
        items: [{ url: 'https://a.example', icon: { type: 'builtin', name: 'github' } }],
        icon_stylesheets: ['https://cdn.example/all.css'],
      },
    }).social
    expect(needsIconStylesheets(social)).toBe(false)
  })

  it('有 css 图标但没配样式表时也不加载（省一次注定无效的请求）', () => {
    const social = parseThemeConfig({
      social: {
        items: [{ url: 'https://a.example', icon: { type: 'css', name: 'fa fa-at' } }],
      },
    }).social
    expect(needsIconStylesheets(social)).toBe(false)
  })
})
