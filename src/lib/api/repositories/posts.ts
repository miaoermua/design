import { requestV2 } from '../client/http'
import type { V2PostDetail, V2PostListBody } from '../contracts/v2/post'
import { toArticle, toArticleDetail } from '../adapters/article'
import { expectObject, toPageResult } from '../adapters/common'
import type { Article, ArticleDetail, ArticleListQuery } from '../domain/article'
import type { PageResult } from '../domain/common'

const TAG = ['posts']

/**
 * 列表正文截断长度（字符）。
 *
 * 依据 MX Core v12.10.0 `apps/core/src/modules/post/post.controller.ts`：
 * `PostPagerDto.truncate` 为 `zCoerceInt.optional()`，controller 执行
 * `doc.text = doc.text.slice(0, truncate)`，并把 lexical `content` 置 null。
 * 单位是 JS 字符串字符数（不是字节 / 词数）；线上实测 `truncate=310` 时
 * 每篇 `text` 恰好 310 字符，分页与 `categoryIds` 过滤下同样生效。
 *
 * 与 Shiro 的 `apiClient.post.getList(..., { truncate: 310 })` 取同一值。
 * 统一写在仓库层而不是交给每个调用点：首页、文章列表、分类页、标签扫描、
 * feed、sitemap、详情页相邻文章全部走 `listArticles`，参数不会漏，
 * 也不会有某个入口把整篇正文拉回来。详情接口 `getArticle` 不传此参数。
 */
export const ARTICLE_LIST_TRUNCATE = 310

/** GET /posts —— 官方分页 + 分类 ID 过滤 + 正文截断（v2 无 slug/tag 过滤参数） */
export async function listArticles(query: ArticleListQuery = {}): Promise<PageResult<Article>> {
  const { page = 1, size = 10, year, sortBy, sortOrder, categoryIds, lang } = query

  const body = await requestV2<V2PostListBody>('/posts', {
    query: {
      page,
      size,
      year,
      sortBy,
      sortOrder,
      categoryIds: categoryIds?.length ? categoryIds.join(',') : undefined,
      lang,
      truncate: ARTICLE_LIST_TRUNCATE,
    },
    revalidate: 60,
    tags: TAG,
  })

  return toPageResult(body, toArticle)
}

/**
 * GET /posts/:category/:slug
 *
 * `fresh` 只给实时更新链路用：事件到达后必须先看到「有没有变」，
 * 不能拿 300 秒的缓存去回答。它不是给页面用的常规开关。
 */
export async function getArticle(
  category: string,
  slug: string,
  options: { lang?: string; fresh?: boolean } = {},
): Promise<ArticleDetail> {
  const body = await requestV2<unknown>(
    `/posts/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`,
    { query: { lang: options.lang }, revalidate: options.fresh ? 0 : 300, tags: TAG },
  )
  return toArticleDetail(expectObject<V2PostDetail>(body, `/posts/${category}/${slug}`))
}
