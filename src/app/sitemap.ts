import type { MetadataRoute } from 'next'
import { featureFlags } from '@/core/registry/features'
import { listArticles, listCategories, listDiaries, listTags } from '@/lib/api'
import { describeError } from '@/lib/api/errors'
import { articlePath, categoryPath, notePath, tagPath } from '@/lib/routes'
import { loadSiteContext, siteBaseUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

/**
 * sitemap 里只放真实存在的 URL：
 *   - 站点没有绝对地址时返回空数组（不能输出相对 URL）；
 *   - 动态条目取不到时保留静态条目，并在服务端日志里说明原因。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { identity } = await loadSiteContext()
  const base = siteBaseUrl(identity)
  if (!base) return []

  const toUrl = (path: string) => new URL(path, base).toString()

  const staticRoutes: Array<[string, MetadataRoute.Sitemap[number]['changeFrequency'], number]> = [
    ['/', 'daily', 1],
  ]
  if (featureFlags.articles) staticRoutes.push(['/articles', 'daily', 0.9])
  // `/notes` 只做重定向，不进 sitemap；时间线才是可索引的稳定地址
  if (featureFlags.diaries) staticRoutes.push(['/notes/list', 'daily', 0.8])
  // 同理：`/archives` 只做 308 到 `/explore`，可索引的落地页是 `/explore`
  if (featureFlags.archives) staticRoutes.push(['/explore', 'weekly', 0.6])
  if (featureFlags.taxonomy) {
    staticRoutes.push(['/tags', 'weekly', 0.5])
    staticRoutes.push(['/categories', 'weekly', 0.5])
  }
  if (featureFlags.about) staticRoutes.push(['/about', 'monthly', 0.5])
  if (featureFlags.friends) staticRoutes.push(['/friends', 'monthly', 0.4])

  const entries: MetadataRoute.Sitemap = staticRoutes.map(([path, changeFrequency, priority]) => ({
    url: toUrl(path),
    changeFrequency,
    priority,
  }))

  try {
    /*
     * sitemap 只产出 URL 与修改时间，与界面语言无关；这里不传 `lang`，
     * 固定按站点原文语言取数。标题不进入 sitemap，翻译与否不影响结果。
     */
    const [articles, diaries, categories, tags] = await Promise.all([
      featureFlags.articles
        ? listArticles({ page: 1, size: 50, sortBy: 'createdAt', sortOrder: -1 })
        : null,
      featureFlags.diaries
        ? listDiaries({ page: 1, size: 50, sortBy: 'createdAt', sortOrder: -1 })
        : null,
      featureFlags.taxonomy ? listCategories() : null,
      featureFlags.taxonomy ? listTags() : null,
    ])

    for (const article of articles?.items ?? []) {
      const path = articlePath(article.category?.slug, article.slug)
      if (path)
        entries.push({ url: toUrl(path), lastModified: article.modifiedAt ?? article.createdAt })
    }
    for (const diary of diaries?.items ?? []) {
      entries.push({
        url: toUrl(notePath(diary.nid)),
        lastModified: diary.modifiedAt ?? diary.publishedAt,
      })
    }
    for (const category of categories ?? []) {
      entries.push({ url: toUrl(categoryPath(category.slug)) })
    }
    for (const tag of tags ?? []) {
      entries.push({ url: toUrl(tagPath(tag.name)) })
    }
  } catch (error) {
    console.warn('[folio] sitemap: 动态条目获取失败，仅输出静态路由：', describeError(error))
  }

  return entries
}
