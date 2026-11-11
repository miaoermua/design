import { requestV2 } from '../client/http'
import type { V2SearchResultItem } from '../contracts/v2/content'
import { toPageResult } from '../adapters/common'
import { toSearchHit } from '../adapters/taxonomy'
import type { PageResult } from '../domain/common'
import type { SearchHit } from '../domain/taxonomy'

/**
 * GET /search?keyword=&page=&size=
 *
 * 实测 v2 的 /search 是文章 + 日记的混合流，结果用 type 区分；
 * 只接受 keyword + 分页，没有分类/标签筛选。
 */
export async function searchArticles(
  keyword: string,
  options: { page?: number; size?: number; lang?: string } = {},
): Promise<PageResult<SearchHit>> {
  const body = await requestV2<{ data?: V2SearchResultItem[] }>('/search', {
    query: { keyword, page: options.page ?? 1, size: options.size ?? 10, lang: options.lang },
    revalidate: 0,
    tags: ['search'],
  })
  return toPageResult(body, toSearchHit)
}
