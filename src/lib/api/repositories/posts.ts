import { requestV2 } from '../client/http'
import type { V2PostDetail, V2PostListBody } from '../contracts/v2/post'
import { toArticle, toArticleDetail } from '../adapters/article'
import { expectObject, toPageResult } from '../adapters/common'
import type { Article, ArticleDetail, ArticleListQuery } from '../domain/article'
import type { PageResult } from '../domain/common'

const TAG = ['posts']

/** GET /posts —— 官方分页 + 分类 ID 过滤（v2 无 slug/tag 过滤参数） */
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
    },
    revalidate: 60,
    tags: TAG,
  })

  return toPageResult(body, toArticle)
}

/** GET /posts/:category/:slug */
export async function getArticle(
  category: string,
  slug: string,
  options: { lang?: string } = {},
): Promise<ArticleDetail> {
  const body = await requestV2<unknown>(
    `/posts/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`,
    { query: { lang: options.lang }, revalidate: 300, tags: TAG },
  )
  return toArticleDetail(expectObject<V2PostDetail>(body, `/posts/${category}/${slug}`))
}
