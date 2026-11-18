/**
 * 站内路由构造器
 *
 * 所有 URL 形状集中在这里，避免组件里散落模板字符串。
 * v2 的文章详情路由是 /posts/:category/:slug，因此分类缺失的文章没有可访问地址。
 */

export function articlePath(
  categorySlug: string | null | undefined,
  slug: string,
): string | null {
  if (!categorySlug) return null
  return `/articles/${encodeURIComponent(categorySlug)}/${encodeURIComponent(slug)}`
}

/**
 * 日记详情：`/notes/:nid`。
 *
 * 用**自增 nid** 而不是雪花 id，是为了与 Shiro / Kami 的 `/notes/:nid` 约定
 * 一致——上游 RSS、`UrlBuilderService.build()` 产出的就是这种地址，站点路由
 * 与它同形之后，feed 不再需要维护 `nid → 雪花 id` 的映射表。
 *
 * `nid` 是后端稳定字段（`Diary.nid`），与雪花 `id` 一一对应。雪花 id 仍留在
 * 数据层给点赞/评论用（`ActivityType` 认的是它），只是不再出现在 URL 里。
 */
export function notePath(nid: number | string): string {
  return `/notes/${encodeURIComponent(String(nid))}`
}

/**
 * 日记时间线（全部日记 + 专栏筛选）。
 *
 * `/notes` 是「最新一篇」的入口，不承载列表；列表在这条静态路由上，承接
 * 分页与 `?topic=`。任何「看全部」的地方都必须指向这里——指回 `/notes`
 * 会落到最新一篇，入口语义就断了。
 *
 * `list` 是静态段，优先于 `/notes/[nid]` 匹配；nid 是纯数字，不会与它撞车。
 */
export const NOTE_LIST_PATH = '/notes/list'

/** 时间线地址；传 topic 时带筛选参数 */
export function noteListPath(topicId?: string | null): string {
  return topicId ? `${NOTE_LIST_PATH}?topic=${encodeURIComponent(topicId)}` : NOTE_LIST_PATH
}

export function tagPath(name: string): string {
  return `/tags/${encodeURIComponent(name)}`
}

export function categoryPath(slug: string): string {
  return `/categories/${encodeURIComponent(slug)}`
}

/**
 * 独立页面详情。
 *
 * slug 为 `about` 时指向既有的 `/about`——那是主题的固定入口，
 * 避免同一个页面出现两个地址（也保证旧链接继续有效）。
 */
export function pagePath(slug: string): string {
  if (slug === 'about') return '/about'
  return `/pages/${encodeURIComponent(slug)}`
}

export function searchPath(keyword: string, page?: number): string {
  const params = new URLSearchParams()
  if (keyword) params.set('q', keyword)
  if (page && page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/search?${query}` : '/search'
}

/** 在保留既有查询参数的条件下替换 page */
export function pageHref(
  basePath: string,
  page: number,
  current?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(current ?? {})) {
    if (value) params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  else params.delete('page')
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
