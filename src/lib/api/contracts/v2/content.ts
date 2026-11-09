/**
 * Mix Space API v2 — 独立页面 / 搜索 / 片段
 *
 * 来源：线上实测
 *   GET /pages/slug/:slug → PageRow（原样返回，不包 data）
 *   GET /search?keyword=&page=&size= → { data: SearchResultItem[], pagination }
 *
 *   ⚠️ 搜索结果是文章与日记的混合流，用 `type` 区分（'post' | 'note'）：
 *      - post 命中带 category 与 slug，可以拼出文章详情地址；
 *      - note 命中只有 id / nid，没有 slug，应链接到日记详情。
 */

import type { EntityId, IsoDateString, V2Image } from './common'

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
