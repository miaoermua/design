import { listCategories, listPages } from '@/lib/api'
import { buildNav, type NavBranch } from '@/core/navigation'
import { isFeatureEnabled } from '@/core/registry/features'
import { dictionary } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { categoryPath, NOTE_LIST_PATH, pagePath } from '@/lib/routes'
import { siteTitle } from '@/lib/site'
import type { SiteIdentity } from '@/lib/api'
import { SiteHeaderClient } from './site-header-client'

/**
 * 站点头部（服务端壳）
 *
 * 职责：读导航树与其子项、读当前语言、读站点身份，把结果整份交给客户端。
 * 所有交互（悬浮栏、菜单、焦点、主题、语言、搜索面板）都在
 * SiteHeaderClient 里，'use client' 的边界压在顶栏这一棵子树内。
 *
 * 导航这里只装配**一次**：`buildNav()` 以 `core/navigation` 的 `ALL_NAV`
 * 为唯一来源，把下面取到的目录子项按 href 挂成 `branch`。顶栏取其中两条
 * 高频入口，菜单按 `section` 分段展示——两端消费的是同一棵树，
 * 上一版「快捷栏 / 菜单主导航 / 菜单更多 / 分组」四条并列链路已经合并。
 * 关一个模块仍然只改一个布尔值。
 *
 * 分类 / 专栏 / 页面的列表在这里取：三个请求都是可缓存的（300s），
 * 失败不阻断页面——`status` 会如实变成 `error`，菜单显示「暂时取不到」，
 * 而不是假装「没有内容」。
 *
 * 「页面」这一支没有 `entryLabel`：它列的是各独立页面的链接，自己却
 * 没有一个索引页（`/pages` 不是主题的路由）。渲染处据 `hasListPage()`
 * 决定要不要画「全部页面」那一行。
 */
export async function SiteHeader({ identity }: { identity: SiteIdentity | null }) {
  const locale = await getLocale()
  const messages = dictionary(locale)

  const [categories, pages] = await Promise.allSettled([listCategories(), listPages()])

  // 键是父级入口的 href：装配时不需要再认识「分组」这个概念
  const branches: Record<string, NavBranch> = {}

  if (isFeatureEnabled('articles')) {
    const items =
      categories.status === 'fulfilled'
        ? categories.value.map((category) => ({
            href: categoryPath(category.slug),
            label: category.name,
          }))
        : []

    branches['/articles'] = {
      entryLabel: 'nav.allArticles',
      emptyLabel: 'nav.noCategories',
      errorLabel: 'nav.categoriesUnavailable',
      status: categories.status === 'rejected' ? 'error' : items.length > 0 ? 'ok' : 'empty',
      items,
    }
  }

  if (isFeatureEnabled('diaries')) {
    /*
     * 日记分支**不出专栏子项**：导航只留两条主线——「日记」进最新一篇、
     * 「全部日记」进时间线。专栏是时间线内部的组织方式，几十个专栏名铺进菜单
     * 会把导航读成资源清单；筛选入口只放在 `/notes/list` 页面里。
     *
     * 因此这里也不请求专栏清单：顶栏对专栏没有任何消费点，多一次请求只是为
     * 一个不显示的列表付代价（每页渲染都付）。
     *
     * `items` 为空 + `status: 'ok'`：分支本身是「入口 + 列表」两条链接，不是
     * 取数失败。用 `'empty'` 会渲染出「还没有专栏」这句已经不成立的提示。
     */
    branches['/notes'] = {
      entryLabel: 'nav.allDiaries',
      // 入口 `/notes` 跳到最新一篇，列表在 `/notes/list`（见 routes.ts）
      listHref: NOTE_LIST_PATH,
      emptyLabel: 'nav.noTopics',
      errorLabel: 'nav.topicsUnavailable',
      status: 'ok',
      items: [],
    }
  }

  // 探索下拉：内容类型筛选入口（对标 Shiro「时光」菜单），子项全部静态
  if (isFeatureEnabled('archives')) {
    branches['/explore'] = {
      entryLabel: 'nav.allExplore',
      emptyLabel: 'nav.noCategories', // 不可能走到：子项是静态的
      errorLabel: 'nav.categoriesUnavailable',
      status: 'ok',
      items: [
        { href: '/explore?type=note', label: messages['nav.exploreNotes'] },
        { href: '/explore?type=post', label: messages['nav.explorePosts'] },
        { href: '/explore?memory=1', label: messages['nav.exploreMemories'] },
      ],
    }
  }

  if (isFeatureEnabled('pages')) {
    const items =
      pages.status === 'fulfilled'
        ? pages.value.items.map((page) => ({ href: pagePath(page.slug), label: page.title }))
        : []

    branches['/pages'] = {
      // 没有 entryLabel：独立页面没有索引页，抽屉里不画「全部页面」那一行。
      // 子项就是全部可去的目的地，各自指向 `/pages/:slug`（about 特例走 `/about`）。
      emptyLabel: 'nav.noPages',
      errorLabel: 'nav.pagesUnavailable',
      status: pages.status === 'rejected' ? 'error' : items.length > 0 ? 'ok' : 'empty',
      items,
    }
  }

  return (
    <SiteHeaderClient
      nav={buildNav(branches)}
      siteName={siteTitle(identity)}
      // 站点图标优先，其次作者头像：两者都是「这个站点的身份」，不额外取数
      avatarUrl={identity?.icon ?? identity?.owner.avatar ?? null}
      messages={messages}
      searchEnabled={isFeatureEnabled('search')}
    />
  )
}
