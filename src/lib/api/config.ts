/**
 * API 运行配置
 *
 * 本主题只实现 Mix Space API v2（core v12.x）。版本号不是「可自由切换的开关」，
 * 而是契约选择的声明：遇到 v3 后端应当报错，而不是猜测字段。
 */

import { ConfigurationError } from './errors'

export const API_VERSION = 2 as const
export const API_PREFIX = '/api/v2'

/** 主题在请求中声明的 UA：明确标识自己，且不会命中后端的爬虫黑名单 */
export const THEME_USER_AGENT = 'folio-theme/0.1 (+https://github.com/mix-space)'

const DEFAULT_REVALIDATE = 60
/**
 * 默认 15s：`/aggregate/timeline` 一次要下载 1MB 量级（全部文章 + 日记），
 * 后端慢的时候 10s 会被掐断，档案页直接空表。可用 MX_API_TIMEOUT_MS 覆盖。
 */
const DEFAULT_TIMEOUT_MS = 15_000

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function isMockMode(): boolean {
  return readEnv('MX_MOCK') === '1'
}

/**
 * 后端 Origin，例如 https://api.example.com
 * 允许带 path 前缀，但会剥掉结尾斜杠。
 */
export function getServerUrl(): string {
  const raw = readEnv('MX_SERVER_URL')
  if (!raw) {
    throw new ConfigurationError(
      '缺少环境变量 MX_SERVER_URL（例：https://api.example.com）。' +
        '若只想离线预览，请设置 MX_MOCK=1。',
    )
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ConfigurationError(`MX_SERVER_URL 不是合法 URL：${raw}`)
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new ConfigurationError(`MX_SERVER_URL 必须是 http(s)：${raw}`)
  }
  return raw.replace(/\/+$/, '')
}

export function getSiteUrl(): string | null {
  return readEnv('NEXT_PUBLIC_SITE_URL')?.replace(/\/+$/, '') ?? null
}

/**
 * 主题 Snippet 名称（`GET /snippets/theme/:name`）。
 *
 * 这是 MX_THEME_NAME 唯一有意义的用途：同一个 Mix Space 后端可以挂多个主题，
 * 各自用不同的 Snippet 名，避免互相覆盖配置。
 */
export function getThemeName(): string {
  return readEnv('MX_THEME_NAME') ?? 'folio'
}

export function getSiteTimezone(): string {
  return readEnv('MX_SITE_TIMEZONE') ?? 'Asia/Shanghai'
}

export function getDefaultRevalidate(): number {
  return DEFAULT_REVALIDATE
}

export function getTimeoutMs(): number {
  const raw = readEnv('MX_API_TIMEOUT_MS')
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_TIMEOUT_MS
}

/** 站点是否已正确配置后端（用于页面顶部给出可读提示，而不是抛栈） */
export function isApiConfigured(): boolean {
  return isMockMode() || Boolean(readEnv('MX_SERVER_URL'))
}
