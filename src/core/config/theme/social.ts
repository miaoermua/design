import {
  SOCIAL_ICON_CLASS_MAX,
  SOCIAL_ICON_CLASS_PARTS_MAX,
  SOCIAL_ICON_STYLESHEET_MAX,
  SOCIAL_ITEM_MAX,
  SOCIAL_TITLE_MAX,
  SOCIAL_URL_MAX_LENGTH,
} from './defaults'
import { normalizeCssUrl } from './css-url'
import type { SocialIconType, ThemeSocialIcon, ThemeSocialItem } from './types'

/**
 * 社交项目的解析与校验
 *
 * 与 `donate.qrcode` 的差别在于**地址协议**：
 * 社交地址除 http(s) 外还允许 `mailto:`（邮箱是社交入口的常见形态），
 * 但仍然只允许这一个额外协议。`javascript:`、`data:`、`tel:` 之类不进来。
 *
 * 另一个差别是**图标**：这里要处理三种来源，其中只有一种是真正可用的。
 * 明确的边界写在 `parseSocialIcon` 与 `SocialIcon` 组件里，不在配置层
 * 假装 `iconify` 已经能加载。
 */

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ICON_TYPES: readonly SocialIconType[] = ['builtin', 'css', 'iconify']

/**
 * 只有这两种类型在渲染层有实现；`iconify` 会被解析并保留，但渲染时降级。
 * 把「支持」写成数据而不是散落在 if 分支里，测试才能直接断言它。
 */
export const IMPLEMENTED_ICON_TYPES: readonly SocialIconType[] = ['builtin', 'css']

/**
 * 单个 class 名：字母数字与 `-` `_`。
 *
 * 刻意不接受 `.` `[` `>` `:` 等选择器字符——配置里的 class 只用于
 * 匹配样式表里已有的规则，不需要（也不应该）具备选择器语义。
 */
const CSS_CLASS_PART = /^[A-Za-z0-9_-]{1,48}$/

/** 内置图标键：小写、无命名空间 */
const BUILTIN_NAME = /^[a-z0-9_-]{1,32}$/i

/** Iconify 标识：允许 `集合:图标` 的冒号形式 */
const ICONIFY_NAME = /^[a-z0-9:_-]{1,64}$/i

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** 与站点设计 token 联动的写法，例如 `var(--accent-strong)` */
const CSS_VAR_COLOR = /^var\(--[a-z0-9_-]{1,48}\)$/i

/**
 * 校验社交地址：`http(s)` 绝对地址，或 `mailto:`。
 *
 * 拒绝清单与 `css-url.ts` 一致，理由也一致：协议相对地址会继承当前页协议，
 * 相对路径在 Snippet 里没有可确定的基准，伪协议等于把配置变成可执行内容。
 */
export function safeSocialUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > SOCIAL_URL_MAX_LENGTH) return null
  // 协议相对地址先拦，避免 `new URL` 抛错后只剩一个含糊的失败原因
  if (trimmed.startsWith('//')) return null
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.protocol === 'mailto:') {
    // `mailto:` 之后必须真的有人：`mailto:` 与 `mailto:?subject=x` 都是空链接
    const address = trimmed.slice('mailto:'.length)
    if (!address || address.startsWith('?')) return null
    return parsed.toString()
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  // `http:evil` 这类能被解析但没有 `//` 的写法一并拒绝
  if (!/^https?:\/\//i.test(trimmed)) return null
  if (!parsed.hostname) return null
  return parsed.toString()
}

/**
 * 校验 CSS 图标的 class 串。
 *
 * 只做**白名单字符**校验，不尝试理解 class 的含义——class 是样式表里的
 * 契约，配置层无从得知它是否存在。能保证的是：这个字符串不可能包含
 * `<`、`"`、`'`、`;`、`(` 等能改变标记或属性边界的字符。
 */
export function safeCssIconClass(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > SOCIAL_ICON_CLASS_MAX) return null

  const parts = trimmed.split(/\s+/)
  if (parts.length === 0 || parts.length > SOCIAL_ICON_CLASS_PARTS_MAX) return null
  if (!parts.every((part) => CSS_CLASS_PART.test(part))) return null

  return parts.join(' ')
}

/**
 * 校验颜色字面量。
 *
 * 只接受 hex 与 `var(--accent-strong)`：社交图标的颜色最终会写进内联样式，
 * 允许任意 CSS 值等于允许配置里塞 `url(...)`（追踪像素）或任意函数表达式。
 * 调色板需求交给设计 token，而不是让配置自由发挥。
 */
export function safeSocialColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (HEX_COLOR.test(trimmed)) return trimmed
  if (CSS_VAR_COLOR.test(trimmed)) return trimmed
  return null
}

function readName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * 解析图标描述。
 *
 * 返回 null 表示「这个图标声明不可用」——调用方据此降级到兜底图形，
 * 而不是把一条坏配置变成空白图标位。
 */
export function parseSocialIcon(value: unknown): ThemeSocialIcon | null {
  if (!isRecord(value)) return null

  const rawType = readName(value.type)?.toLowerCase()
  if (!rawType || !ICON_TYPES.includes(rawType as SocialIconType)) return null
  const type = rawType as SocialIconType

  const rawName = readName(value.name)
  if (!rawName) return null

  if (type === 'css') {
    const name = safeCssIconClass(rawName)
    return name ? { type, name } : null
  }

  if (type === 'iconify') {
    // 解析保留、渲染降级：不做「保存了名字就算支持」的假实现
    return ICONIFY_NAME.test(rawName) ? { type, name: rawName.toLowerCase() } : null
  }

  return BUILTIN_NAME.test(rawName) ? { type, name: rawName.toLowerCase() } : null
}

/**
 * 标题兜底。
 *
 * 一个没有标题的社交链接对读屏器等于「链接」，因此标题缺失时用主机名
 * （`mailto:` 用邮箱地址）代替，而不是丢掉这一项。这样配置少写一个字段
 * 的后果是「标题不够漂亮」，而不是「链接消失」。
 */
function fallbackTitle(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'mailto:') {
      const address = parsed.pathname || parsed.href.slice('mailto:'.length)
      return address.slice(0, SOCIAL_TITLE_MAX) || null
    }
    return parsed.hostname.replace(/^www\./i, '').slice(0, SOCIAL_TITLE_MAX) || null
  } catch {
    return null
  }
}

function parseSocialItem(value: unknown): ThemeSocialItem | null {
  if (!isRecord(value)) return null

  const url = safeSocialUrl(value.url)
  if (!url) return null

  const icon = parseSocialIcon(value.icon)
  const rawTitle = readName(value.title)
  const title =
    (rawTitle ? rawTitle.slice(0, SOCIAL_TITLE_MAX) : null) ??
    fallbackTitle(url) ??
    // 兜底再兜底：URL 能被解析就一定能给出某种可读文本，这里只是类型收敛
    url

  return {
    title,
    url,
    icon,
    color: safeSocialColor(value.color),
    // 只认布尔 true：`channel: 'true'` 这种 YAML 手滑不该悄悄把链接变成频道
    channel: value.channel === true,
  }
}

/**
 * 解析 `social.items`。
 *
 * 规则与其它列表字段保持一致：**单条非法只跳过该条**。
 * 去重键是 URL——同一个地址出现两次就是同一个入口，
 * 保留第一条并忽略后续，避免页面上出现两个指向同一处的按钮。
 */
export function parseSocialItems(value: unknown): ThemeSocialItem[] {
  if (!Array.isArray(value)) return []

  const items: ThemeSocialItem[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (items.length >= SOCIAL_ITEM_MAX) break
    const item = parseSocialItem(entry)
    if (!item) continue
    if (seen.has(item.url)) continue
    seen.add(item.url)
    items.push(item)
  }

  return items
}

/**
 * 解析 `social.icon_stylesheets`。
 *
 * 复用 `custom.css` 的 URL 校验（同为外部样式表，规则没有理由不同），
 * 但上限更紧：图标字体是额外一次请求，不该和整体样式覆盖一样宽松。
 */
export function parseIconStylesheets(value: unknown): { urls: string[]; rejected: string[] } {
  if (!Array.isArray(value)) return { urls: [], rejected: [] }

  const urls: string[] = []
  const rejected: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (urls.length >= SOCIAL_ICON_STYLESHEET_MAX) {
      rejected.push(`超过 ${SOCIAL_ICON_STYLESHEET_MAX} 条上限`)
      continue
    }
    const result = normalizeCssUrl(entry)
    if ('reason' in result) {
      rejected.push(result.reason)
      continue
    }
    if (seen.has(result.url)) {
      rejected.push('重复地址')
      continue
    }
    seen.add(result.url)
    urls.push(result.url)
  }

  return { urls, rejected }
}
