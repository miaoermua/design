/**
 * Mix Space API v2 — 公共契约
 *
 * 来源：线上部署实测（https://api.miaoer.net/api/v2）+ core v12.9.5 源码对照
 *
 *   ⚠️ 重要：core 的 TypeScript 类型用 camelCase（createdAt），
 *   但线上 JSON 序列化输出 snake_case（created_at）。字段名以**线上响应**为准，
 *   适配器另外兼容 camelCase，以免不同部署的序列化配置导致整页空白。
 *
 *   - 分页对象实测：current_page / total_page / total / size / has_next_page / has_prev_page
 *   - 响应信封：数组 → { data: [...] }；对象原样返回
 *   - 错误体：{ ok: 0, code, message }
 */

/** 后端分页对象（`{ data, pagination }` 中的 pagination） */
export interface V2Pagination {
  current_page: number
  total_page: number
  total: number
  size: number
  has_next_page: boolean
  has_prev_page: boolean
}

/** 分页列表响应：Post/Note/Search 列表均为此形状 */
export interface V2Paginated<T> {
  data: T[]
  pagination: V2Pagination
}

/** 非分页数组响应（拦截器自动包裹） */
export interface V2ListBody<T> {
  data: T[]
}

/** 业务错误响应体 */
export interface V2ErrorBody {
  ok: 0
  code?: number | string
  message?: string
  statusCode?: number
}

/** 时间字段在 JSON 中一律是 ISO 8601 字符串 */
export type IsoDateString = string

/**
 * 图片/附件
 * 实测字段：src / type / width / height / accent / blur_hash
 */
export interface V2Image {
  src: string
  width?: number
  height?: number
  accent?: string
  type?: 'image' | 'video' | string
  blur_hash?: string | null
}

/** 实体 ID：v12 的 EntityId 序列化为字符串 */
export type EntityId = string
