/**
 * 契约 → 领域 的通用转换
 *
 * 这里的每个函数都是纯函数，便于契约测试直接断言。
 * 关键约定：
 *   - 不存在的数字字段 → null（而不是 0），避免 UI 显示「0 次阅读」这种假数据
 *   - 不存在的文本字段 → null（而不是空串）
 *   - 时间保持 ISO 字符串，不在数据层本地化
 *   - 字段名同时接受 snake_case（线上实测）与 camelCase（core 源码类型）
 */

import type { V2Image, V2ListBody, V2Pagination } from '../contracts/v2/common'
import type { Attachment, PageResult, Pagination } from '../domain/common'
import { EMPTY_PAGINATION } from '../domain/common'
import { ApiError } from '../errors'

/** 取有限数字，否则 null */
export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 取非空字符串，否则 null */
export function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

/**
 * 读取一个字段：优先 snake_case，其次 camelCase。
 *
 * 线上部署实测输出 snake_case，而 core 源码的类型声明是 camelCase；
 * 两者都读可以避免同一份主题在两种序列化配置下整页变成空值。
 */
export function readField(row: object, snake: string, camel: string): unknown {
  const record = row as Record<string, unknown>
  if (snake in record) return record[snake]
  return record[camel]
}

export function readString(row: object, snake: string, camel: string): string | null {
  return stringOrNull(readField(row, snake, camel))
}

export function readNumber(row: object, snake: string, camel: string): number | null {
  return numberOrNull(readField(row, snake, camel))
}

export function readArray(row: object, snake: string, camel: string): unknown[] {
  const value = readField(row, snake, camel)
  return Array.isArray(value) ? value : []
}

export function toAttachment(image: V2Image | null | undefined): Attachment | null {
  if (!image || typeof image.src !== 'string' || image.src.length === 0) return null
  return {
    src: image.src,
    width: numberOrNull(image.width) ?? undefined,
    height: numberOrNull(image.height) ?? undefined,
    accent: stringOrNull(image.accent) ?? undefined,
    kind: image.type === 'video' ? 'video' : 'image',
  }
}

export function toAttachments(images: V2Image[] | null | undefined): Attachment[] {
  if (!Array.isArray(images)) return []
  return images.map(toAttachment).filter((item): item is Attachment => item !== null)
}

export function toPagination(pagination: V2Pagination | null | undefined): Pagination {
  if (!pagination) return EMPTY_PAGINATION
  const page = numberOrNull(readField(pagination, 'current_page', 'currentPage')) ?? 1
  const size = numberOrNull(pagination.size) ?? 0
  const total = numberOrNull(pagination.total) ?? 0
  const totalPages = numberOrNull(readField(pagination, 'total_page', 'totalPage')) ?? 1
  return {
    page,
    size,
    total,
    totalPages: Math.max(1, totalPages),
    hasNext: Boolean(readField(pagination, 'has_next_page', 'hasNextPage')),
    hasPrev: Boolean(readField(pagination, 'has_prev_page', 'hasPrevPage')),
  }
}

/** `{ data, pagination }` → PageResult，并做 map */
export function toPageResult<TContract, TDomain>(
  body: { data?: TContract[]; pagination?: V2Pagination } | null | undefined,
  map: (row: TContract) => TDomain,
): PageResult<TDomain> {
  const rows = Array.isArray(body?.data) ? body.data : []
  return {
    items: rows.map(map),
    pagination: toPagination(body?.pagination),
  }
}

/**
 * 取「被拦截器包成 { data: [...] }」的数组。
 * 若响应本身既不是数组也没有 data 数组，说明契约不符 → 抛错而不是返回空数组。
 */
export function unwrapListBody<T>(body: unknown, path: string): T[] {
  if (Array.isArray(body)) return body as T[]
  if (body && typeof body === 'object') {
    const data = (body as V2ListBody<T>).data
    if (Array.isArray(data)) return data
  }
  throw new ApiError('响应不是数组，也不是 { data: [] }', {
    status: 200,
    path,
    body,
  })
}

/**
 * 取显式 `{ data: T }` 包装（分类详情 / 时间线 / 标签文章）。
 * 与 unwrapListBody 分开，避免把业务里合法的 data 字段误当信封。
 */
export function unwrapDataObject<T>(body: unknown, path: string): T {
  if (body && typeof body === 'object' && 'data' in body) {
    const data = (body as { data: unknown }).data
    if (data && typeof data === 'object') return data as T
  }
  throw new ApiError('响应缺少 { data } 对象', { status: 200, path, body })
}

/** 期望顶层就是对象（聚合、详情等） */
export function expectObject<T>(body: unknown, path: string): T {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as T
  throw new ApiError('响应不是对象', { status: 200, path, body })
}
