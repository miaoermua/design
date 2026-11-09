/**
 * HTTP 客户端（仅服务端使用）
 *
 * 职责边界：
 *   - 拼接 URL、查询参数；统一 UA；超时；错误体解析
 *   - 不解释业务字段（那是 adapters 的事）
 *   - 不降级：任何非 2xx 都抛错，绝不返回空数组冒充成功
 *
 * 只在 Server Components / Route Handlers / 测试中调用；浏览器永远不直连后端。
 */

import {
  API_PREFIX,
  THEME_USER_AGENT,
  getDefaultRevalidate,
  getServerUrl,
  getTimeoutMs,
  isMockMode,
} from '../config'
import { ApiError, NetworkError, NotFoundError, PasswordRequiredError } from '../errors'
import { getMockResponse } from '../mock/handlers'
import type { V2ErrorBody } from '../contracts/v2/common'

/** 日记密码保护的业务码（core: ErrorCodeEnum.NoteForbidden） */
const NOTE_FORBIDDEN_CODE = 14000

export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  query?: Record<string, QueryValue | QueryValue[]>
  /** 秒；默认 60。0 表示不缓存 */
  revalidate?: number
  /** 用于 on-demand 失效的 cache tag */
  tags?: string[]
}

function buildSearchParams(query: RequestOptions['query']): URLSearchParams {
  const params = new URLSearchParams()
  if (!query) return params
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      params.set(key, value.join(','))
      continue
    }
    params.set(key, String(value))
  }
  return params
}

function parseErrorBody(body: unknown): { code: number | string | null; message: string | null } {
  if (!body || typeof body !== 'object') return { code: null, message: null }
  const candidate = body as V2ErrorBody
  const code =
    typeof candidate.code === 'number' || typeof candidate.code === 'string' ? candidate.code : null
  const message = typeof candidate.message === 'string' ? candidate.message : null
  return { code, message }
}

/**
 * 请求 `GET /api/v2<path>`
 *
 * @throws {ConfigurationError} 部署配置缺失
 * @throws {NotFoundError} 404
 * @throws {PasswordRequiredError} 日记密码保护（403 + code 14000）
 * @throws {ApiError} 其余非 2xx
 * @throws {NetworkError} 连接/超时/DNS
 */
export async function requestV2<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const params = buildSearchParams(options.query)

  if (isMockMode()) {
    const mocked = getMockResponse(path, params)
    if (!mocked) {
      throw new ApiError(`Mock 未覆盖该接口：GET ${path}`, {
        status: 404,
        path,
        body: { source: 'mock' },
      })
    }
    if (mocked.status >= 400) throwMappedError(path, mocked.status, mocked.body)
    return mocked.body as T
  }

  const base = getServerUrl()
  const queryString = params.toString()
  const url = `${base}${API_PREFIX}${path}${queryString ? `?${queryString}` : ''}`

  const timeout = AbortSignal.timeout(getTimeoutMs())
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': THEME_USER_AGENT,
      },
      signal: timeout,
      next: {
        revalidate: options.revalidate ?? getDefaultRevalidate(),
        tags: options.tags,
      },
    })
  } catch (error) {
    throw new NetworkError(`请求失败：GET ${url}`, { path, cause: error })
  }

  const rawText = await response.text()
  let body: unknown = null
  if (rawText) {
    try {
      body = JSON.parse(rawText)
    } catch {
      // 非 JSON 响应（例如反代的 HTML 错误页）保留原文，便于定位
      body = rawText
    }
  }

  if (!response.ok) {
    throwMappedError(path, response.status, body)
  }

  return body as T
}

function throwMappedError(path: string, status: number, body: unknown): never {
  const { code, message } = parseErrorBody(body)

  if (status === 403 && code === NOTE_FORBIDDEN_CODE) {
    throw new PasswordRequiredError({ path, body })
  }

  if (status === 404) {
    throw new NotFoundError(message ?? `资源不存在：${path}`, { path, body })
  }

  if (!message && typeof body === 'string' && body.trim()) {
    throw new ApiError(body.slice(0, 200), { status, code, path, body })
  }

  throw new ApiError(message ?? `接口返回 ${status}`, { status, code, path, body })
}
