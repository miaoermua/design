import { requestV2 } from '../client/http'
import type { V2PageListBody, V2PageRow } from '../contracts/v2/content'
import {
  expectObject,
  numberOrNull,
  readString,
  stringOrNull,
  toPageResult,
} from '../adapters/common'
import type { PageResult } from '../domain/common'

export interface PageContent {
  title: string
  subtitle: string | null
  content: string
  contentFormat: string
  updatedAt: string | null
}

/** 独立页面列表项：只带列表展示需要的字段，正文按需在详情页取 */
export interface PageSummary {
  id: string
  title: string
  slug: string
  subtitle: string | null
  /** 后端排序权重；无值时为 null，不臆造 0 */
  order: number | null
  updatedAt: string | null
}

function toPageSummary(row: V2PageRow): PageSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: stringOrNull(row.subtitle),
    order: numberOrNull(row.order),
    updatedAt: readString(row, 'modified_at', 'modifiedAt'),
  }
}

/**
 * GET /pages —— 独立页面列表。
 *
 * Pages 与 Blogs / Notes 是不同内容类型：没有分类、没有标签、不进入时间轴。
 * 实测响应是 `{ data, pagination }`，本主题一次取全（页面数量是个位数级别）。
 */
export async function listPages(
  options: { lang?: string } = {},
): Promise<PageResult<PageSummary>> {
  const body = await requestV2<unknown>('/pages', {
    query: { lang: options.lang },
    revalidate: 300,
    tags: ['pages'],
  })
  return toPageResult<V2PageRow, PageSummary>(body as V2PageListBody, toPageSummary)
}

/** GET /pages/slug/:slug —— 独立页面正文（About 与 Pages 详情共用） */
export async function getPageBySlug(
  slug: string,
  options: { lang?: string } = {},
): Promise<PageContent> {
  const body = await requestV2<unknown>(`/pages/slug/${encodeURIComponent(slug)}`, {
    query: { lang: options.lang },
    revalidate: 300,
    tags: ['pages'],
  })
  const row = expectObject<V2PageRow>(body, `/pages/slug/${slug}`)
  return {
    title: row.title,
    subtitle: stringOrNull(row.subtitle),
    content: stringOrNull(row.text) ?? stringOrNull(row.content) ?? '',
    contentFormat: readString(row, 'content_format', 'contentFormat') ?? 'markdown',
    updatedAt: readString(row, 'modified_at', 'modifiedAt'),
  }
}