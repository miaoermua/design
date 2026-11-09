/**
 * Mix Space API v2 — 分类与标签契约
 *
 * 来源：线上实测
 *
 *   GET /categories
 *     type=0（默认）→ { data: CategoryRow[] }，含 count
 *     type=1        → { data: { name, count }[] }   ← 标签汇总，**没有 id/slug**
 *
 *   GET /categories/:slug
 *     → { data: { ...CategoryRow, count, children: PostRow[] } }
 *       children 是该分类下的文章，不是子分类。
 *
 *   GET /posts?tag=<name>&page=&size=
 *     → { data: PostRow[], pagination }              ← 按标签取文章
 *
 *   标签没有独立详情接口：标签详情页用 /posts?tag= 实现。
 */

import type { EntityId, IsoDateString, V2Pagination } from './common'
import type { V2PostRow } from './post'

export enum V2CategoryType {
  Category = 0,
  Tag = 1,
}

export interface V2CategoryRow {
  id: EntityId
  name: string
  slug: string
  type: V2CategoryType
  created_at?: IsoDateString
  count?: number
}

/** 标签汇总项（type=1 时的数组元素） */
export interface V2TagSum {
  name: string
  count: number
}

/** 分类详情（实测 children 是文章数组） */
export interface V2CategoryDetail extends V2CategoryRow {
  count: number
  children: V2PostRow[]
}

export interface V2CategoryDetailBody {
  data: V2CategoryDetail
}

/** 按标签取文章的响应（与普通文章列表同形） */
export interface V2TagPostsBody {
  data: V2PostRow[]
  pagination: V2Pagination
}
