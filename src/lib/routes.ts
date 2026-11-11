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

export function diaryPath(id: string): string {
  return `/diaries/${encodeURIComponent(id)}`
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
