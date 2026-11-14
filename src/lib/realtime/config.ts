/**
 * 实时连接的 Origin 解析（**只在服务端调用**）
 *
 * Socket.IO 客户端在浏览器里创建，但连接目标必须由服务端算好后以 props 传下去：
 * - 默认取 `MX_SERVER_URL` 的 **origin**：`https://api.example.com/api/v2`
 *   → `https://api.example.com`，不会把 `/api/v2` 带进握手地址。
 * - 若站点把 Socket.IO 反代到另一台主机，用 `MX_REALTIME_URL` 覆盖；
 *   它同样必须是 http(s) origin，不接受路径，也不接受旧的 `ws://` / `wss://`。
 * - `MX_REALTIME=off` 可整体关闭；mock 模式下默认关闭（没有真实后端）。
 *
 * Engine.IO path、namespace、`lang` 都不在这里拼：它们是协议常量与客户端配置，
 * 不由环境变量决定。拿不到合法 origin 就返回 null，页面按没有实时能力降级，
 * 不会去猜一个地址、也不会尝试旧协议。
 */

import { getServerUrl, isMockMode } from '@/lib/api/config'
import type { Locale } from '@/lib/i18n/config'

export interface RealtimeConfig {
  /** API origin；null 表示本环境不启用实时能力 */
  origin: string | null
  lang: Locale
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * 默认推导：`MX_SERVER_URL` 本身允许带 `/api/v2` 之类的路径前缀，
 * 实时连接只取它的 origin。
 */
function deriveOrigin(): string | null {
  try {
    return new URL(getServerUrl()).origin
  } catch {
    return null
  }
}

/** 显式覆盖地址只接受不带路径的 http(s) origin，避免环境变量拼出错误的握手路径 */
function normalizeOverrideOrigin(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.pathname !== '/') return null
    return url.origin
  } catch {
    return null
  }
}

function resolveRealtimeOrigin(): string | null {
  const disabled = readEnv('MX_REALTIME')?.toLowerCase()
  if (disabled === 'off' || disabled === '0' || disabled === 'false') return null

  const explicit = readEnv('MX_REALTIME_URL')
  if (explicit) return normalizeOverrideOrigin(explicit)

  // mock 模式下没有真实网关；除非显式给了 MX_REALTIME_URL，否则不连
  if (isMockMode()) return null

  return deriveOrigin()
}

export function resolveRealtimeConfig(locale: Locale): RealtimeConfig {
  return { origin: resolveRealtimeOrigin(), lang: locale }
}

/** 页面是否需要挂载「实时更新」的客户端接线 */
export function isRealtimeEnabled(): boolean {
  return resolveRealtimeOrigin() !== null
}
