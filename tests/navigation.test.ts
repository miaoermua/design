import { describe, expect, it } from 'vitest'
import * as navigation from '@/core/navigation'
import { getPrimaryNav, isNavItemActive, type NavItem } from '@/core/navigation'
import { isInteractionEnabled } from '@/features/interactions'
import { featureFlags } from '@/core/registry/features'

/**
 * 主导航
 *
 * 顶栏结构是这次改动的核心之一，写成断言是为了防止两种情况回退：
 * 页脚导航被重新引回来（/friends 等入口悬空）、以及「探索」又把
 * /categories 抢回去高亮。
 */

const item = (href: string): NavItem => {
  const found = getPrimaryNav().find((entry) => entry.href === href)
  if (!found) throw new Error(`导航项缺失：${href}`)
  return found
}

describe('getPrimaryNav', () => {
  it('顶栏入口顺序固定：文章 / 日记 / 探索 / 友链 / 页面 / 关于', () => {
    expect(getPrimaryNav().map((entry) => entry.href)).toEqual([
      '/articles',
      '/diaries',
      '/explore',
      '/friends',
      '/pages',
      '/about',
    ])
  })

  it('只返回已启用模块的入口', () => {
    for (const entry of getPrimaryNav()) {
      expect(featureFlags[entry.feature]).toBe(true)
    }
  })

  it('不再导出页脚导航：页脚不承载导航', () => {
    expect('getFooterNav' in navigation).toBe(false)
  })
})

describe('isNavItemActive', () => {
  it('「探索」覆盖 /explore、/archives、/tags 及其子路径', () => {
    const explore = item('/explore')
    expect(isNavItemActive(explore, '/explore')).toBe(true)
    expect(isNavItemActive(explore, '/archives')).toBe(true)
    expect(isNavItemActive(explore, '/tags/tech')).toBe(true)
  })

  it('「探索」不再接管 /categories：分类归档属于「文章」', () => {
    const explore = item('/explore')
    expect(isNavItemActive(explore, '/categories')).toBe(false)
    expect(isNavItemActive(explore, '/categories/tech')).toBe(false)
  })

  it('前缀匹配按路径段边界，不做字符串前缀', () => {
    const articles = item('/articles')
    expect(isNavItemActive(articles, '/articles')).toBe(true)
    expect(isNavItemActive(articles, '/articles/tech')).toBe(true)
    // /articles-archive 不是 /articles 的子路径
    expect(isNavItemActive(articles, '/articles-archive')).toBe(false)
  })

  it('友链入口在顶栏，且只匹配 /friends', () => {
    const friends = item('/friends')
    expect(isNavItemActive(friends, '/friends')).toBe(true)
    expect(isNavItemActive(friends, '/about')).toBe(false)
  })
})

describe('interactions 开关', () => {
  it('已开启：点赞与订阅有入口，评论仍关闭', () => {
    expect(isInteractionEnabled()).toBe(true)
    expect(featureFlags.comments).toBe(false)
  })
})
