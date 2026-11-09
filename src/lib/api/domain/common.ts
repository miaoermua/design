/**
 * 前端领域模型 — 公共件
 *
 * 领域模型与官方契约刻意分开：
 * 契约（contracts/v2）随后端升级而变，领域模型只随产品需求而变。
 * 两者之间由 adapters/ 单向转换。
 */

/** 统一分页模型（已抹平 currentPage/totalPage → page/totalPages） */
export interface Pagination {
  page: number
  size: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PageResult<T> {
  items: T[]
  pagination: Pagination
}

/** 媒体附件（封面/正文图） */
export interface Attachment {
  src: string
  width?: number
  height?: number
  accent?: string
  kind: 'image' | 'video'
}

export const EMPTY_PAGINATION: Pagination = {
  page: 1,
  size: 0,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
}
