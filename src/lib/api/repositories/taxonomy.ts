import { requestV2 } from '../client/http'
import type { V2CategoryRow, V2TagSum } from '../contracts/v2'
import { unwrapListBody } from '../adapters/common'
import { toCategory, toTag } from '../adapters/taxonomy'
import type { PageResult } from '../domain/common'
import type { Category, Tag } from '../domain/taxonomy'
import type { Article } from '../domain/article'
import { listArticles } from './posts'

const TAG = ['taxonomy']

/** GET /categories?type=0 */
export async function listCategories(): Promise<Category[]> {
  const body = await requestV2<unknown>('/categories', {
    query: { type: 0 },
    revalidate: 300,
    tags: TAG,
  })
  return unwrapListBody<V2CategoryRow>(body, '/categories').map(toCategory)
}

/** GET /categories?type=1 —— 标签汇总（实测只有 name / count） */
export async function listTags(): Promise<Tag[]> {
  const body = await requestV2<unknown>('/categories', {
    query: { type: 1 },
    revalidate: 300,
    tags: TAG,
  })
  return unwrapListBody<V2TagSum>(body, '/categories?type=1').map(toTag)
}

/**
 * 按 slug 找分类。
 *
 * 不用 `/categories/:slug`：那个接口把该分类下的文章（children）一次性全塞回来，
 * 35 篇就是 35 篇 HTML，还没法分页。分类列表只有 3 条，直接查表更省。
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await listCategories()
  return categories.find((category) => category.slug === slug) ?? null
}

/** 单页扫描量（v2 的 size 上限是 50，超过报 size: Invalid input） */
const TAG_SCAN_SIZE = 50
/** 扫描上限：20 × 50 = 1000 篇，避免主题在大站上把整个文章表翻一遍 */
const TAG_SCAN_MAX_PAGES = 20

/**
 * 按标签取文章。
 *
 * v2 没有标签详情接口，`GET /posts` 也只认 `year` / `categoryIds`：
 * 传 `tag=` 会被后端忽略，原样返回全部文章（实测 78 篇全回来）。
 * 因此这里按页扫文章列表，用每篇的 `tags` 自己筛。
 *
 * 代价：一个标签页最多要翻 TAG_SCAN_MAX_PAGES 页（有 ISR 缓存兜着）；
 * 超出上限时结果会被截断，paginate 的 total 也只是"已扫到的数量"。
 */
export async function listArticlesByTag(
  tag: string,
  options: { page?: number; size?: number } = {},
): Promise<{ tagName: string; result: PageResult<Article> }> {
  const page = Math.max(1, options.page ?? 1)
  const size = Math.max(1, options.size ?? 10)

  const matched: Article[] = []
  let scannedPage = 0
  let totalPages = 1

  do {
    scannedPage += 1
    const chunk = await listArticles({ page: scannedPage, size: TAG_SCAN_SIZE })
    matched.push(...chunk.items.filter((article) => article.tags.includes(tag)))
    totalPages = chunk.pagination.totalPages
    if (chunk.items.length === 0) break
  } while (scannedPage < totalPages && scannedPage < TAG_SCAN_MAX_PAGES)

  const total = matched.length
  const pageCount = Math.max(1, Math.ceil(total / size))

  return {
    tagName: tag,
    result: {
      items: matched.slice((page - 1) * size, page * size),
      pagination: {
        page,
        size,
        total,
        totalPages: pageCount,
        hasNext: page < pageCount,
        hasPrev: page > 1,
      },
    },
  }
}
