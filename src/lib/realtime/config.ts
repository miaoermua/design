/**
 * 实时连接的地址解析（**只在服务端调用**）
 *
 * 浏览器必须自己发起 WebSocket，所以地址只能由服务端算好后以 props 传下去：
 * - 默认从 `MX_SERVER_URL` 推导：`https://api.example.com/api/v2` → `wss://api.example.com/ws/web`
 * - 若站点把网关反代到同域，用 `MX_REALTIME_URL` 覆盖（推荐，浏览器就只与站点同源通信）
 * - `MX_REALTIME=off` 可整体关闭；mock 模式下默认关闭（没有真实后端）
 *
 * 注意：这里不做「猜一个地址」的兜底。拿不到合法地址就返回 null，
 * 页面按没有实时能力降级，而不是让浏览器去连一个不存在的端口。
 */

import { getServerUrl, isMockMode } from '@/lib/api/config'
import { REALTIME_PATH } from './protocol'
import type { Locale } from '@/lib/i18n/config'

export interface RealtimeConfig {
  /** 连接地址；null 表示本环境不启用实时能力 */
  url: string | null
  lang: Locale
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeSocketUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null
    return url.toString()
  } catch {
    return null
  }
}

function deriveFromServerUrl(serverUrl: string): string | null {
  try {
    const url = new URL(serverUrl)
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    // MX_SERVER_URL 可能带 /api/v2 前缀；网关挂在 origin 上，不带这个前缀
    return `${protocol}//${url.host}${REALTIME_PATH}`
  } catch {
    return null
  }
}

function resolveRealtimeUrl(): string | null {
  const disabled = readEnv('MX_REALTIME')?.toLowerCase()
  if (disabled === 'off' || disabled === '0' || disabled === 'false') return null

  const explicit = readEnv('MX_REALTIME_URL')
  if (explicit) return normalizeSocketUrl(explicit)

  // mock 模式下没有真实网关；除非显式给了 MX_REALTIME_URL，否则不连
  if (isMockMode()) return null

  try {
    return deriveFromServerUrl(getServerUrl())
  } catch {
    return null
  }
}

export function resolveRealtimeConfig(locale: Locale): RealtimeConfig {
  return { url: resolveRealtimeUrl(), lang: locale }
}

/**
 * 页面是否需要挂载「实时更新」的客户端接线。
 *
 * 与网关地址同源判断：没有地址就没有事件，也就不该为文章页多加一个客户端组件
 * 和一条轮询定时器。
 */
export function isRealtimeEnabled(): boolean {
  return resolveRealtimeUrl() !== null
}
