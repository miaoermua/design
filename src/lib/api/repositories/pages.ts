import { requestV2 } from '../client/http'
import type { V2PageListBody, V2PageRow } from '../contracts/v2/content'
import {
  expectObject,
  readString,
  stringOrNull,
  toAttachments,
  toPageResult,
} from '../adapters/common'
import type { Attachment, PageResult } from '../domain/common'

export interface PageContent {
  /** 页面实体 id：评论等按 refId 关联的能力需要它 */
  id: string
  title: string
  subtitle: string | null
  content: string
  contentFormat: string
  /** 正文图尺寸来源（core 的 images 带 width/height） */
  images: Attachment[]
  updatedAt: string | null
}

/**
 * 独立页面列表项：菜单只需要标题与地址。
 *
 * 主题**不渲染**页面索引页（没有 `/pages` 路由），因此这里不提供
 * 列表展示用的排序权重之类的字段——列表只用于给导航产出子项。
 */
export interface PageSummary {
  id: string
  title: string
  slug: string
  subtitle: string | null
  updatedAt: string | null
}

function toPageSummary(row: V2PageRow): PageSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: stringOrNull(row.subtitle),
    updatedAt: readString(row, 'modified_at', 'modifiedAt'),
  }
}

/**
 * GET /pages —— 独立页面列表。
 *
 * 只服务一处：导航里「页面」目录的子项（桌面首页下拉 / 手机菜单折叠区）。
 * 主题没有页面索引页，所以这个请求不是为了渲染「页面列表」，
 * 而是为了知道「有哪些独立页面可以直达」。一次取全（页面数量是个位数级别）。
 */
export async function listPages(options: { lang?: string } = {}): Promise<PageResult<PageSummary>> {
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
    id: String(row.id),
    title: row.title,
    subtitle: stringOrNull(row.subtitle),
    content: stringOrNull(row.text) ?? stringOrNull(row.content) ?? '',
    contentFormat: readString(row, 'content_format', 'contentFormat') ?? 'markdown',
    images: toAttachments(row.images),
    updatedAt: readString(row, 'modified_at', 'modifiedAt'),
  }
}
