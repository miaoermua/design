import { listCategories, listPages, listTopics } from '@/lib/api'
import { getPrimaryNav, type NavGroup } from '@/core/navigation'
import { isFeatureEnabled } from '@/core/registry/features'
import { dictionary } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { categoryPath, pagePath } from '@/lib/routes'
import { SiteHeaderClient } from './site-header-client'

/** 由选择器承载的三个入口；其余导航项仍是普通链接 */
const GROUPED_HREFS = new Set(['/articles', '/diaries', '/pages'])

/**
 * 站点头部（服务端壳）
 *
 * 职责：读导航清单与其子项、读当前语言、把字典整份交给客户端。
 * 所有交互（滚动隐藏、搜索面板、主题、语言、选择器、移动菜单）都在
 * SiteHeaderClient 里，'use client' 的边界压在顶栏这一棵子树内。
 *
 * 分类 / 专栏 / 页面的列表在这里取：三个请求都是可缓存的（300s），
 * 失败不阻断页面——`status` 会如实变成 `error`，选择器显示「暂时取不到」，
 * 而不是假装「没有内容」。
 */
export async function SiteHeader() {
  const locale = await getLocale()
  const messages = dictionary(locale)

  const [categories, topics, pages] = await Promise.allSettled([
    listCategories(),
    listTopics(),
    listPages(),
  ])

  const groups: NavGroup[] = []

  if (isFeatureEnabled('articles')) {
    const items =
      categories.status === 'fulfilled'
        ? categories.value.map((category) => ({
            href: categoryPath(category.slug),
            label: category.name,
          }))
        : []

    groups.push({
      key: 'articles',
      label: 'nav.articles',
      href: '/articles',
      // 分类详情仍属于「文章」这条线，高亮跟着走
      matchPrefixes: ['/articles', '/categories'],
      allLabel: 'nav.allArticles',
      emptyLabel: 'nav.noCategories',
      errorLabel: 'nav.categoriesUnavailable',
      status: categories.status === 'rejected' ? 'error' : items.length > 0 ? 'ok' : 'empty',
      items,
    })
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

    groups.push({
      key: 'diaries',
      label: 'nav.diaries',
      href: '/diaries',
      matchPrefixes: ['/diaries'],
      allLabel: 'nav.allDiaries',
      emptyLabel: 'nav.noTopics',
      errorLabel: 'nav.topicsUnavailable',
      status: topics.status === 'rejected' ? 'error' : items.length > 0 ? 'ok' : 'empty',
      items,
    })
  }

  const pagesEnabled = isFeatureEnabled('pages')
  const pageItems =
    pagesEnabled && pages.status === 'fulfilled'
      ? pages.value.items.map((page) => ({ href: pagePath(page.slug), label: page.title }))
      : []

  groups.push({
    key: 'pages',
    label: 'nav.home',
    href: '/',
    matchPrefixes: ['/', '/pages', '/about'],
    allLabel: 'nav.home',
    emptyLabel: 'nav.noPages',
    errorLabel: 'nav.pagesUnavailable',
    status: !pagesEnabled
      ? 'ok'
      : pages.status === 'rejected'
        ? 'error'
        : pageItems.length > 0
          ? 'ok'
          : 'empty',
    items: pagesEnabled
      ? [{ href: '/pages', label: messages['nav.pages'] }, ...pageItems]
      : [],
  })

  const groupOrder: Record<NavGroup['key'], number> = { pages: 0, articles: 1, diaries: 2 }
  groups.sort((left, right) => groupOrder[left.key] - groupOrder[right.key])

  const links = getPrimaryNav().filter((item) => !GROUPED_HREFS.has(item.href))

  return (
    <SiteHeaderClient
      groups={groups}
      links={links}
      locale={locale}
      messages={messages}
      searchEnabled={isFeatureEnabled('search')}
    />
  )
}
