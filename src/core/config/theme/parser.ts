import { normalizeCustomCssList } from './css-url'
import {
  DONATE_LABEL_MAX,
  DONATE_NAME_MAX,
  DONATE_QRCODE_MAX,
  DONATE_URL_MAX_LENGTH,
  FOOTER_LINK_MAX,
  FOOTER_LINK_NAME_MAX,
  HOME_LIMIT_MAX,
  HOME_LIMIT_MIN,
  SINCE_MIN,
  cloneDefaultThemeConfig,
} from './defaults'
import type {
  ThemeConfig,
  ThemeCustom,
  ThemeDonate,
  ThemeDonateQrcode,
  ThemeFooter,
  ThemeFooterLink,
  ThemeHomepage,
  ThemeHomepageSection,
  ThemeIcp,
  ThemeSocial,
} from './types'

/**
 * Theme 配置解析
 *
 * 输入是后端已解析好的 JSON 对象（见 types.ts 的协议说明），
 * 这里做三件事：形状校验、字段级降级、收敛到安全值域。
 *
 * 设计原则：**单个字段非法不影响其它字段**。
 * 一个写错的 ICP 链接不应该让整块首页配置失效，所以每个子解析器
 * 都独立返回「解析结果或默认值」，而不是遇到问题就返回空配置。
 *
 * 所有子解析器只读取自己认识的键，其余键直接忽略——不做「白名单校验
 * 失败就整体拒绝」。这样后端加字段不会让旧主题崩掉。
 */

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 取嵌套对象；不是对象就返回空对象，让下游的统一降级逻辑接管 */
function record(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readString(value: unknown, max?: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return max ? trimmed.slice(0, max) : trimmed
}

function readInt(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return null
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

/**
 * 只接受 http(s) 绝对地址。
 *
 * `javascript:`、`data:`、协议相对 `//host` 一律拒绝——后者会继承当前协议，
 * 在多域名部署下可能指向预期之外的主机。
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // 明确排除无协议相对地址（new URL 在有 base 时才成立，这里没有 base）
    if (!/^https?:\/\//i.test(trimmed)) return null
    return url.toString()
  } catch {
    return null
  }
}

/* ── footer ─────────────────────────────────────────────────── */

function parseSince(value: unknown, currentYear: number): number | null {
  // 非法年份必须降级为 null，而不是被 clamp 到下限：
  // clamp 会把 `since: 1800` 悄悄变成 1990，展示上是错的年份。
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  const year = Math.trunc(parsed)
  if (year < SINCE_MIN || year > currentYear + 1) return null
  return year
}

function parseFooterLinks(value: unknown): ThemeFooterLink[] {
  if (!Array.isArray(value)) return []
  const links: ThemeFooterLink[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const name = readString(item.name, FOOTER_LINK_NAME_MAX)
    const url = safeHttpUrl(item.url)
    // 名称与地址缺一不可：只有地址没有名称的链接无法阅读
    if (!name || !url) continue
    links.push({ name, url })
    if (links.length >= FOOTER_LINK_MAX) break
  }
  return links
}

function parseFooterIcp(value: unknown): ThemeIcp {
  const source = record(value)
  const label = readString(source.label, 64)
  const enabled = readBool(source.enabled, label !== null)
  if (!enabled || !label) return { enabled: false, label: null, url: null }
  return {
    enabled: true,
    label,
    // 链接非法时降级为 null，UI 会退到官方备案查询入口，而不是渲染坏地址
    url: safeHttpUrl(source.url),
  }
}

export function parseFooter(value: unknown, currentYear: number): ThemeFooter {
  const source = record(value)
  return {
    since: parseSince(source.since, currentYear),
    links: parseFooterLinks(source.links),
    icp: parseFooterIcp(source.icp),
  }
}

/* ── social ─────────────────────────────────────────────────── */

/** 平台键只允许字母数字与 - _，防止用奇怪键名去冒充图标 */
const PLATFORM_KEY = /^[a-z0-9_-]{1,32}$/i

function parseSocial(value: unknown): ThemeSocial {
  const source = record(value)

  const order: string[] = []
  if (Array.isArray(source.order)) {
    for (const item of source.order) {
      if (typeof item !== 'string') continue
      const key = item.trim().toLowerCase()
      if (!PLATFORM_KEY.test(key)) continue
      if (!order.includes(key)) order.push(key)
    }
  }

  const icons: Record<string, string> = {}
  const rawIcons = record(source.icons)
  for (const [key, rawName] of Object.entries(rawIcons)) {
    const platform = key.trim().toLowerCase()
    if (!PLATFORM_KEY.test(platform)) continue
    const iconName = readString(rawName, 32)
    // 只接受「图标名」，不接受 SVG / HTML：值是字符串，交给图标组件查表
    if (iconName && /^[a-z0-9_-]+$/i.test(iconName)) icons[platform] = iconName.toLowerCase()
  }

  return {
    enabled: readBool(source.enabled, true),
    order,
    icons,
  }
}

/* ── homepage ───────────────────────────────────────────────── */

function parseHomepageSection(
  value: unknown,
  fallback: ThemeHomepageSection,
): ThemeHomepageSection {
  const source = record(value)
  const enabled = readBool(source.enabled, fallback.enabled)
  // limit 为 0 的 profile 没有意义，只对 articles/notes 生效
  const rawLimit = source.limit
  const limit =
    rawLimit === undefined
      ? fallback.limit
      : (readInt(rawLimit, HOME_LIMIT_MIN, HOME_LIMIT_MAX) ?? fallback.limit)
  return { enabled, limit }
}

export function parseHomepage(value: unknown, fallback: ThemeHomepage): ThemeHomepage {
  const source = record(value)
  return {
    profile: parseHomepageSection(source.profile, fallback.profile),
    articles: parseHomepageSection(source.articles, fallback.articles),
    notes: parseHomepageSection(source.notes, fallback.notes),
  }
}

/* ── donate ─────────────────────────────────────────────────── */

/**
 * 二维码列表解析。
 *
 * 与 `src/features/donate/config.ts` 的消费层是**两道理性校验**：
 * 这里保证进入 `ThemeConfig` 的值本身是干净数据（其它消费者也能安全使用），
 * 消费层再校验一次，因为「配置是不可信输入」这条不能因为上游校验过就作废。
 *
 * 规则刻意与消费层逐条一致：同一 URL 只留第一条、非法条目跳过而不是整组拒绝、
 * 名称缺省用序号兜底、顺序即配置顺序（顺序决定展示顺序）。
 */
export function parseDonateQrcodes(value: unknown): ThemeDonateQrcode[] {
  if (!Array.isArray(value)) return []

  const qrcodes: ThemeDonateQrcode[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (qrcodes.length >= DONATE_QRCODE_MAX) break
    if (!isRecord(item)) continue

    if (typeof item.url !== 'string' || item.url.length > DONATE_URL_MAX_LENGTH) continue
    const url = safeHttpUrl(item.url)
    if (!url || seen.has(url)) continue
    seen.add(url)

    const name = readString(item.name, DONATE_NAME_MAX) ?? `二维码 ${qrcodes.length + 1}`
    qrcodes.push({ name, url })
  }

  return qrcodes
}

function parseDonate(value: unknown, fallback: ThemeDonate): ThemeDonate {
  const source = record(value)

  return {
    // 只有显式 true 才开启：`'true'` / `1` / 缺省都等于关闭，
    // 避免「配置写错但看起来开了」的入口出现。
    enabled: source.enabled === true,
    label: readString(source.label, DONATE_LABEL_MAX) ?? fallback.label,
    qrcode: parseDonateQrcodes(source.qrcode),
  }
}

/* ── custom ─────────────────────────────────────────────────── */

/**
 * 自定义样式：只解析外部 URL 数组。
 *
 * 值得写下来的取舍：
 *   - **拒绝内联 CSS 字符串**。旧实现接受 `custom.css: "..."` 并在服务端
 *     注入 `<style>`，但那要求「把配置里的文本原样放进 HTML」。改成 URL 后，
 *     配置只能决定加载哪个文件，无法决定 HTML 里出现什么。
 *   - **单条非法只跳过该条**，不像旧版遇到违规就整体拒绝：URL 之间没有
 *     「写一半更危险」的问题，一条坏 CDN 不该让整组样式失效。
 *   - **不做静默纠正**。写成相对路径就跳过，不改写成绝对地址——猜主机名
 *     会让配置作者不知道最终指向哪里。
 */
function parseCustom(value: unknown): ThemeCustom {
  const source = record(value)
  // 旧的内联写法（字符串）在这里自然落空：normalizeCustomCssList 只认数组。
  const { urls } = normalizeCustomCssList(source.css)
  return { css: urls }
}

/* ── 入口 ───────────────────────────────────────────────────── */

/**
 * 把后端返回的对象解析为完整 ThemeConfig。
 *
 * `fallback` 允许调用方传入自定义默认值（测试与降级都用得上）；
 * 不传则用项目默认值。
 */
export function parseThemeConfig(
  input: unknown,
  options: { fallback?: ThemeConfig; currentYear?: number } = {},
): ThemeConfig {
  const fallback = options.fallback ?? cloneDefaultThemeConfig()
  const currentYear = options.currentYear ?? new Date().getFullYear()

  if (!isRecord(input)) return fallback

  return {
    footer: parseFooter(input.footer, currentYear),
    social: parseSocial(input.social),
    custom: parseCustom(input.custom),
    homepage: parseHomepage(input.homepage, fallback.homepage),
    donate: parseDonate(input.donate, fallback.donate),
    bandevtool: {
      // 默认关闭：只有显式 true 才生效
      enabled: readBool(record(input.bandevtool).enabled, false),
    },
  }
}

/** 供 UI 判断：since 是否早于当前年（决定是否渲染成 2021–2026 的区间） */
export function footerYearRange(since: number | null, currentYear: number): string {
  if (since === null || since >= currentYear) return String(currentYear)
  return `${since}–${currentYear}`
}
