import { listCategories, listPages, listTopics } from '@/lib/api'
import { buildNav, type NavBranch } from '@/core/navigation'
import { isFeatureEnabled } from '@/core/registry/features'
import { dictionary } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { categoryPath, pagePath } from '@/lib/routes'
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

  const [categories, topics, pages] = await Promise.allSettled([
    listCategories(),
    listTopics(),
    listPages(),
  ])

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
    const items =
      topics.status === 'fulfilled'
        ? topics.value.map((topic) => ({
            // 专栏没有独立详情路由：日记列表按 topic 过滤，路由形状不变
            href: `/diaries?topic=${encodeURIComponent(topic.id)}`,
            label: topic.name,
          }))
        : []

    branches['/diaries'] = {
      entryLabel: 'nav.allDiaries',
      emptyLabel: 'nav.noTopics',
      errorLabel: 'nav.topicsUnavailable',
      status: topics.status === 'rejected' ? 'error' : items.length > 0 ? 'ok' : 'empty',
      items,
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
