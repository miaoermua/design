import { requestV2 } from '@/lib/api/client/http'
import { ApiError, NetworkError, isNotFound } from '@/lib/api/errors'
import { getThemeName } from '@/lib/api/config'

/**
 * Theme Repository
 *
 * 只负责「把远端配置取回来并给出状态」，不做解析也不再降级——
 * 解析在 parser.ts，降级决策在 loader.ts。
 *
 * 协议事实（core v5.0.0 `snippet.service.ts`）：
 *   GET /snippets/:reference/:name  →  `res.data`
 *   其中 `data` 是 `js-yaml` 的 `load(raw)` 结果，即**已解析对象**。
 *
 * 端点不存在时会抛 NotFoundError（404 / code 11003「Snippet 不存在」），
 * 这是正常状态：部署方还没配主题，页面必须照常渲染。
 */

const THEME_REFERENCE = 'theme'

/** 与其他站点级配置同节奏；Snippet 改动不频繁，600s 足够 */
const THEME_REVALIDATE = 600

export type ThemeFetchStatus = 'ok' | 'missing' | 'forbidden' | 'unavailable' | 'invalid'

export interface ThemeFetchResult {
  status: ThemeFetchStatus
  /** status === 'ok' 时是对象；其余情况为 null */
  data: Record<string, unknown> | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 读取主题 Snippet。
 *
 * 不抛错：所有失败都映射成 status，让上层决定降级。
 * 也不把一次网络抖动写成缓存——`requestV2` 的 `next.revalidate` 只在
 * 成功响应时由 Next 缓存，失败响应不进入数据缓存。
 */
export async function fetchThemeSnippet(): Promise<ThemeFetchResult> {
  const name = getThemeName()
  const path = `/snippets/${THEME_REFERENCE}/${encodeURIComponent(name)}`

  try {
    const body = await requestV2<unknown>(path, {
      revalidate: THEME_REVALIDATE,
      tags: ['theme-config'],
    })

    // 后端对 YAML 返回解析后对象；数组/字符串/null 都视为格式不符
    if (!isPlainObject(body)) return { status: 'invalid', data: null }
    return { status: 'ok', data: body }
  } catch (error) {
    if (isNotFound(error)) return { status: 'missing', data: null }

    // private Snippet 对匿名访问是 403
    if (error instanceof ApiError && error.status === 403) {
      return { status: 'forbidden', data: null }
    }

    // 网络、超时、DNS、5xx 统一视为暂时不可用
    if (error instanceof NetworkError) return { status: 'unavailable', data: null }
    if (error instanceof ApiError) return { status: 'unavailable', data: null }

    return { status: 'unavailable', data: null }
  }
}