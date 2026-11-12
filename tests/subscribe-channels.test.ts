import { describe, expect, it } from 'vitest'
import { parseThemeConfig } from '@/core/config/theme'
import { selectSubscribeChannels } from '@/features/interactions'

/**
 * 频道订阅的筛选规则
 *
 * 关键约束只有一条：**社交链接不等于订阅频道**。
 * 只有 `channel: true` 的项才进弹窗，其余（GitHub、邮箱……）留在原来的
 * 社交位置，不因为「都是外链」就被误当成订阅入口。
 */

function social(input: unknown) {
  return parseThemeConfig({ social: input }).social
}

const ITEMS = [
  {
    url: 'https://github.com/miaoermua',
    title: 'GitHub',
    icon: { type: 'builtin', name: 'github' },
  },
  {
    url: 'https://t.me/folio_demo',
    title: 'Telegram 频道',
    icon: { type: 'builtin', name: 'telegram' },
    color: '#0088CC',
    channel: true,
  },
  {
    url: 'mailto:i@miaoer.net',
    title: '邮箱',
    icon: { type: 'builtin', name: 'email' },
    channel: true,
  },
]

describe('selectSubscribeChannels', () => {
  it('只挑出显式标记为频道的项，社交链接不会被顺手带进来', () => {
    const channels = selectSubscribeChannels(social({ enabled: true, items: ITEMS }))

    expect(channels).toHaveLength(1)
    expect(channels[0]).toMatchObject({
      title: 'Telegram 频道',
      url: 'https://t.me/folio_demo',
      icon: { type: 'builtin', name: 'telegram' },
      color: '#0088CC',
    })
  })

  it('即使标记了频道，mailto 也不作为频道出现——邮箱已经是弹窗里的表单', () => {
    const channels = selectSubscribeChannels(social({ enabled: true, items: ITEMS }))
    expect(channels.map((item) => item.url)).not.toContain('mailto:i@miaoer.net')
  })

  it('social 总开关关闭时为空：模块关闭不该在这里开一个例外', () => {
    expect(selectSubscribeChannels(social({ enabled: false, items: ITEMS }))).toEqual([])
  })

  it('id 稳定且按配置顺序输出', () => {
    const first = selectSubscribeChannels(social({ enabled: true, items: ITEMS }))
    const second = selectSubscribeChannels(social({ enabled: true, items: ITEMS }))

    expect(first.map((item) => item.id)).toEqual(['channel:0'])
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id))
  })

  it('没有 items 时返回空数组，而不是抛错', () => {
    expect(selectSubscribeChannels(social({ enabled: true }))).toEqual([])
  })
})
