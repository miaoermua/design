/**
 * 站点级主题配置（可选）
 *
 * 数据来源问题的实情：Mix Space v2 的 `/aggregate` 在实测响应里带一个
 * `theme` 字段，但线上部署（api.miaoer.net）返回的是 `null`——也就是说
 * 主题配置是否存在取决于部署方是否写入。协议层有位置，实际数据可能为空。
 *
 * 因此这里的策略是：
 *   1. 优先读 `/aggregate.theme` 里的已知键；
 *   2. 没有任何配置时，Footer 不渲染对应区块（不留空壳）。
 *
 * 允许的键（全部可选，全部来自部署方显式配置，主题不猜、不补默认文案）：
 *
 *   footer.links[]     自定义链接区，位于页脚正上方
 *     { "name": "友链", "url": "https://example.com" }
 *   footer.icp         备案号
 *   footer.icpUrl      备案查询链接（可选，缺省时只显示文本）
 *
 * 这些键名是本主题对 theme 字段的**约定**，不是 Mix Space 官方定义的 schema。
 * 主题读不到就当作没配——不会因为字段形状不符而报错。
 */

export interface FooterLink {
  name: string
  url: string
}

export interface ThemeFooterConfig {
  links: FooterLink[]
  icp: string | null
  icpUrl: string | null
}

const EMPTY_CONFIG: ThemeFooterConfig = { links: [], icp: null, icpUrl: null }

/**
 * 只接受 http(s) 绝对地址。
 *
 * 自定义链接来自部署方配置，仍要走协议校验：`javascript:` 这类
 * 伪协议即使配置错了也不该被渲染成可点击链接。
 */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readLinks(source: Record<string, unknown>): FooterLink[] {
  const raw = source.links
  if (!Array.isArray(raw)) return []

  const links: FooterLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const name = readString(record, 'name')
    const url = safeUrl(record.url)
    // 名称与地址缺一不可：只有地址没有名称的链接无法阅读
    if (name && url) links.push({ name, url })
  }
  return links
}

/**
 * 从 /aggregate.theme 解析页脚配置。
 *
 * theme 是 `Record<string, unknown>`（后端自定义内容），因此全程做形状检查；
 * 任何一项不符合预期都退化为「没有这一项」，不抛错、不让整页失败。
 */
export function parseThemeFooter(theme: Record<string, unknown> | null | undefined): ThemeFooterConfig {
  if (!theme || typeof theme !== 'object') return EMPTY_CONFIG

  // 支持两种层级：theme.footer = {...} 或直接 theme = {links, icp}
  const footer =
    theme.footer && typeof theme.footer === 'object'
      ? (theme.footer as Record<string, unknown>)
      : theme

  const links = readLinks(footer)
  const icp = readString(footer, 'icp')
  // 备案链接只在真的填了备案号时才有意义
  const icpUrl = icp ? safeUrl(footer.icpUrl) : null

  if (links.length === 0 && !icp) return EMPTY_CONFIG
  return { links, icp, icpUrl }
}

/** ICP 备案查询的官方入口（用于「有备案号但没配链接」时给一个可达目标） */
export const ICP_QUERY_URL = 'https://beian.miit.gov.cn/'