/**
 * Mix Space API v2 — 独立页面 / 搜索 / 片段
 *
 * 来源：线上实测
 *   GET /pages → { data: PageRow[], pagination }（实测 4 条，按 order 升序）
 *   GET /pages/slug/:slug → PageRow（原样返回，不包 data）
 *   GET /search?keyword=&page=&size= → { data: SearchResultItem[], pagination }
 *
 *   ⚠️ 搜索结果是文章与日记的混合流，用 `type` 区分（'post' | 'note'）：
 *      - post 命中带 category 与 slug，可以拼出文章详情地址；
 *      - note 命中只有 id / nid，没有 slug，应链接到日记详情。
 *
 *   ⚠️ 翻译：内容接口（posts / notes / pages / search）接受 `?lang=` 查询参数，
 *      返回该语言的正文与标题；`?locale=` 不生效。列表项额外带
 *      is_translated / source_lang / available_translations（实测存在于详情）。
 */

import type { EntityId, IsoDateString, V2Image, V2Pagination } from './common'

export interface V2PageRow {
  id: string
  title: string
  slug: string
  subtitle?: string | null
  text: string
  content?: string | null
  content_format?: string
  images?: V2Image[] | null
  meta?: Record<string, unknown> | null
  order?: number
  created_at: IsoDateString
  modified_at?: IsoDateString | null
  /** 实测：该语言下是否已有译文 */
  is_translated?: boolean
  source_lang?: string | null
  available_translations?: string[] | null
}

/** `{ data, pagination }` 中的独立页面列表 */
export interface V2PageListBody {
  data: V2PageRow[]
  pagination?: V2Pagination
}

/** 搜索结果项（实测字段） */
export interface V2SearchResultItem {
  id: EntityId
  /** note 命中才有 */
  nid?: number
  type: 'post' | 'note'
  title: string
  /** post 命中才有；note 实测为 null */
  slug?: string | null
  /** post 命中才有 */
  category?: { id?: EntityId; name?: string; slug?: string } | null
  created_at: IsoDateString
  /** 命中的文本片段：后端已插入 <mark> */
  highlight?: {
    snippet?: string
    keywords?: string[]
    title?: string
  }
  [key: string]: unknown
}
