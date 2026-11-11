/**
 * Mix Space API v2 — 文章契约
 *
 * 来源：线上实测（/posts、/posts/latest、/posts/:category/:slug）
 *
 *   实测字段：id / title / slug / text / content / content_format / summary / images
 *             meta / tags / modified_at / category_id / copyright / is_published
 *             read_count / like_count / pin_at / pin_order / created_at / category / related
 *
 *   ⚠️ 实测列表**没有** commentsIndex 字段，因此契约里不声明、UI 不展示评论数。
 *   ⚠️ 没有 cover 字段：封面语义由 images[0]（或 meta.cover）承担。
 *   ⚠️ 列表项也带 related（可能为空数组），详情接口才保证 liked。
 */

import type { EntityId, IsoDateString, V2Image } from './common'

/** 文章内嵌的分类引用 */
export interface V2PostCategoryRef {
  id: EntityId
  name: string
  slug: string
  type?: number
  created_at?: IsoDateString
}

/** 文章行（列表项，也是详情的基础） */
export interface V2PostRow {
  id: EntityId
  title: string
  slug: string
  /** Markdown / 纯文本正文；列表默认返回完整正文 */
  text?: string | null
  /** Lexical 富文本 JSON 字符串；content_format=lexical 时使用 */
  content?: string | null
  content_format?: string
  summary?: string | null
  images?: V2Image[] | null
  category?: V2PostCategoryRef | null
  category_id?: EntityId | null
  tags?: string[] | null
  meta?: Record<string, unknown> | null
  pin_at?: IsoDateString | null
  pin_order?: number | null
  is_published?: boolean
  copyright?: boolean
  read_count?: number
  like_count?: number
  created_at: IsoDateString
  modified_at?: IsoDateString | null
  related?: V2PostRow[] | null
  /** 实测：`?lang=` 命中已有译文时为 true */
  is_translated?: boolean
  source_lang?: string | null
  available_translations?: string[] | null
}

/** 文章详情：在行基础上多一个 liked（匿名访问为 false/null） */
export interface V2PostDetail extends V2PostRow {
  liked?: boolean | null
}

/** `{ data, pagination }` 中的文章列表 */
export interface V2PostListBody {
  data: V2PostRow[]
  pagination: import('./common').V2Pagination
}
