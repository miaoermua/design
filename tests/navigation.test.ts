import { describe, expect, it } from 'vitest'
import * as navigation from '@/core/navigation'
import {
  buildNav,
  getPrimaryNav,
  getQuickNav,
  hasLanding,
  isDesktopOnly,
  isNavItemActive,
  type NavItem,
} from '@/core/navigation'
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
  it('顶栏普通链接顺序固定：文章 / 日记 / 探索 / 友链 / 页面，其后是一言与项目', () => {
    expect(getPrimaryNav().map((entry) => entry.href)).toEqual([
      '/articles',
      '/notes',
      '/explore',
      '/friends',
      '/pages',
      '/says',
      '/projects',
    ])
  })

  it('关于页保留路由，但不作为独立顶栏入口', () => {
    expect(getPrimaryNav().some((entry) => entry.href === '/about')).toBe(false)
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

  it('入口与列表页分开时，列表页上只由列表那一行声明当前页', () => {
    const notes = item('/notes')
    // 没有 listHref：老行为不变，/notes 及其子路径都高亮
    expect(isNavItemActive(notes, '/notes')).toBe(true)
    expect(isNavItemActive(notes, '/notes/31')).toBe(true)

    // 有 listHref 且与入口不同：列表页归子项，入口让出 aria-current
    expect(isNavItemActive(notes, '/notes/list', '/notes/list')).toBe(false)
    // 详情页与入口页仍然高亮入口
    expect(isNavItemActive(notes, '/notes/31', '/notes/list')).toBe(true)
    expect(isNavItemActive(notes, '/notes', '/notes/list')).toBe(true)

    // listHref 与 href 相同时不产生「让出」：文章这类目录依旧高亮
    const articles = item('/articles')
    expect(isNavItemActive(articles, '/articles', '/articles')).toBe(true)
  })
})

/**
 * 导航树装配
 *
 * 这里钉住的是「菜单不是第二套导航」这件事：顶栏与菜单消费同一个数组，
 * 目录型入口的子项挂在入口自己的 `branch` 上，父级链接不在数据里重复出现。
 */
describe('buildNav', () => {
  it('顺序与 ALL_NAV 一致；首页不在这棵树里（由 HOME_NAV 单独提供）', () => {
    expect(buildNav().map((entry) => entry.href)).toEqual([
      '/articles',
      '/notes',
      '/explore',
      '/friends',
      '/pages',
      '/says',
      '/projects',
    ])
    expect(buildNav().some((entry) => entry.href === '/')).toBe(false)
  })

  it('每个目的地只有一个节点', () => {
    for (const entry of buildNav()) {
      expect(buildNav().filter((other) => other.href === entry.href)).toHaveLength(1)
    }
  })

  it('目录子项按 href 挂到对应入口上，不携带父级链接', () => {
    const nav = buildNav({
      '/articles': {
        entryLabel: 'nav.allArticles',
        emptyLabel: 'nav.noCategories',
        errorLabel: 'nav.categoriesUnavailable',
        status: 'ok',
        items: [{ href: '/categories/tech', label: '技术' }],
      },
    })

    const articles = nav.find((entry) => entry.href === '/articles')
    expect(articles?.branch?.items.map((entry) => entry.href)).toEqual(['/categories/tech'])
    // 子项里不出现 /articles 自己：父级链接从 entry 取
    expect(articles?.branch?.items.some((entry) => entry.href === '/articles')).toBe(false)
  })

  it('顶栏 = 首页 + 主导航那一段，都是同一批对象', () => {
    const nav = buildNav()
    expect(getQuickNav(nav).map((entry) => entry.href)).toEqual([
      '/',
      '/articles',
      '/notes',
      '/explore',
      '/friends',
    ])
    // 除了首页（固定路由、单独一条），其余都是 nav 里的同一个对象
    expect(getQuickNav(nav)[1]).toBe(nav[0])
    // 「更多」那一段不在顶栏
    expect(
      getQuickNav(nav).some((entry) =>
        nav.some((node) => node === entry && node.section === 'more'),
      ),
    ).toBe(false)
  })

  it('「页面」不进顶栏：它没有列表页，顶栏只收点了能到达的入口', () => {
    const nav = buildNav({
      '/pages': {
        emptyLabel: 'nav.noPages',
        errorLabel: 'nav.pagesUnavailable',
        status: 'ok',
        items: [{ href: '/pages/site', label: '站点' }],
      },
    })

    expect(getQuickNav(nav).map((entry) => entry.href)).not.toContain('/pages')
    // 但它的子项挂在首页下拉上：桌面悬停首页就能看到
    expect(getQuickNav(nav)[0].branch?.items).toEqual([{ href: '/pages/site', label: '站点' }])
  })

  it('hasLanding 区分「入口自己能不能去」与「只是子项容器」', () => {
    const nav = buildNav({
      '/pages': {
        emptyLabel: 'nav.noPages',
        errorLabel: 'nav.pagesUnavailable',
        status: 'ok',
        items: [{ href: '/pages/site', label: '站点' }],
      },
    })

    const byHref = (href: string) => nav.find((entry) => entry.href === href)!
    expect(hasLanding(byHref('/articles'))).toBe(true)
    // 「页面」有子项、但自己没有索引页
    expect(hasLanding(byHref('/pages'))).toBe(false)
    // 判据不依赖 branch：取数失败时布局也不该变
    expect(hasLanding({ linkable: false })).toBe(false)
    expect(hasLanding({})).toBe(true)
  })

  it('首页 / 探索 / 友链标了「仅桌面」：手机顶栏只留文章与日记', () => {
    expect(
      buildNav()
        .filter(isDesktopOnly)
        .map((entry) => entry.href),
    ).toEqual(['/explore', '/friends'])
    expect(isDesktopOnly(getQuickNav(buildNav())[0])).toBe(true)
  })

  it('「更多」由 section 标记，不靠第二份清单', () => {
    expect(
      buildNav()
        .filter((entry) => entry.section === 'more')
        .map((entry) => entry.href),
    ).toEqual(['/says', '/projects'])
  })
})

describe('interactions 开关', () => {
  it('已开启：点赞、订阅与评论入口都在', () => {
    expect(isInteractionEnabled()).toBe(true)
    // 评论已从「定义未启用」转为实现（Core v12 支持的部分），不再靠这个开关兜底
    expect(featureFlags.comments).toBe(true)
    expect(featureFlags.aiSummary).toBe(true)
    expect(featureFlags.aiInsights).toBe(true)
  })
})
