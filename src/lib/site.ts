/**
 * 站点上下文
 *
 * 站点名称/描述/头像只来自 /aggregate。这里做两件事：
 *   1. 把「取不到」变成可呈现的状态，而不是让整个 layout 崩掉；
 *   2. 提供 UI 侧的回退文案（回退是展示决策，不写回数据）。
 */

import { getSiteIdentity, type SiteIdentity } from '@/lib/api'
import { SITE_DESCRIPTION_FALLBACK, SITE_NAME_FALLBACK } from '@/core/config/site'

export interface SiteContext {
  identity: SiteIdentity | null
  /** identity 为 null 时的真实原因，原样展示给部署者 */
  error: unknown
}

export async function loadSiteContext(): Promise<SiteContext> {
  try {
    return { identity: await getSiteIdentity(), error: null }
  } catch (error) {
    return { identity: null, error }
  }
}

export function siteTitle(identity: SiteIdentity | null): string {
  return identity?.title ?? identity?.owner.name ?? SITE_NAME_FALLBACK
}

export function siteDescription(identity: SiteIdentity | null): string {
  return identity?.description ?? SITE_DESCRIPTION_FALLBACK
}

/** NEXT_PUBLIC_SITE_URL 优先，其次后端 aggregate.url.webUrl；都不是合法 URL 时返回 undefined */
export function siteBaseUrl(identity: SiteIdentity | null): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || identity?.siteUrl || ''
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return /^https?:$/.test(url.protocol) ? url : undefined
  } catch {
    return undefined
  }
}

/** 站内绝对地址；用于 canonical / sitemap / RSS */
export function absoluteUrl(identity: SiteIdentity | null, path: string): string | null {
  const base = siteBaseUrl(identity)
  if (!base) return null
  return new URL(path, base).toString()
}
