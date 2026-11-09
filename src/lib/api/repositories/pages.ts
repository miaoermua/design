import { requestV2 } from '../client/http'
import type { V2PageRow } from '../contracts/v2/content'
import { expectObject, readString, stringOrNull } from '../adapters/common'

export interface PageContent {
  title: string
  subtitle: string | null
  content: string
  contentFormat: string
  updatedAt: string | null
}

/** GET /pages/slug/:slug —— 独立页面（About 使用），实测为原样对象 */
export async function getPageBySlug(slug: string): Promise<PageContent> {
  const body = await requestV2<unknown>(`/pages/slug/${encodeURIComponent(slug)}`, {
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
