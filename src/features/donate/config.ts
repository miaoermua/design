/**
 * Donate 配置消费层
 *
 * Theme Snippet 的形状（`ThemeConfig.donate`，见 `src/core/config/theme/types.ts`）：
 *
 * ```yaml
 * donate:
 *   enabled: true
 *   label: 赞赏
 *   qrcode:
 *     - name: 微信
 *       url: https://static.example.com/wechat.webp
 * ```
 *
 * 为什么配置已经过 `parseThemeConfig` 还要再校验一次：
 *
 * - `qrcode[].url` 最终进入 `<img src>`，只允许 http(s) 绝对地址。
 *   文本层的 `javascript:` / `data:` / 协议相对地址都在这里被丢弃。
 * - `label` / `name` 直接渲染成文本，收敛长度以免配置把版面撑坏；
 *   React 会转义文本，因此不存在 HTML 注入面。
 * - 无效条目按条丢弃（不是整块丢弃）：一张坏图不应该让其余二维码消失。
 *
 * 本模块**不复制 ThemeConfig 类型**，只按结构读取：解析器把 `donate` 从
 * `{ site, page }` 换成 `{ enabled, label, qrcode }` 时，这里不需要跟着改；
 * 反过来，任何绕过解析器直接传进来的对象也会被同样对待——UI 不信任输入。
 * 规则与 `parseDonateQrcodes()` 逐条一致（长度上限、顺序、去重、按条丢弃）。
 */

import {
  DONATE_LABEL_MAX,
  DONATE_NAME_MAX,
  DONATE_QRCODE_MAX,
  DONATE_URL_MAX_LENGTH,
} from '@/core/config/theme'
import type { ThemeDonateQrcode } from '@/core/config/theme'

/**
 * UI 侧直接沿用主题层的二维码结构，不另立一份同形类型。
 *
 * 这样 parser 若调整字段（例如以后加 `alt`），两处不会各自漂移。
 */
export type DonateQrcode = ThemeDonateQrcode

export interface DonateConfig {
  enabled: boolean
  label: string
  qrcodes: DonateQrcode[]
}

export const DONATE_DEFAULT_LABEL = '赞赏'

/** 上限与 `ThemeConfig` 同源：两边各写一个数字迟早会不一致 */
export const DONATE_MAX_QRCODES = DONATE_QRCODE_MAX

export { DONATE_LABEL_MAX, DONATE_NAME_MAX }

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * 只接受 http(s) 绝对地址。
 *
 * 不用 `startsWith('http')` 这类字符串判断：`httpfoo://` 与
 * `https://` 后跟空白都能骗过前缀检查，而 `new URL()` 会明确给出协议。
 */
export function safeQrcodeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw || raw.length > DONATE_URL_MAX_LENGTH) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

/** 逐条校验二维码；非法条目忽略，顺序保持配置顺序 */
export function parseDonateQrcodes(value: unknown): DonateQrcode[] {
  if (!Array.isArray(value)) return []

  const items: DonateQrcode[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (items.length >= DONATE_MAX_QRCODES) break

    const source = record(entry)
    const url = safeQrcodeUrl(source.url)
    if (!url) continue

    // 同一张图配两遍只保留第一条：React 的 key 需要唯一，
    // 视觉上重复的二维码也没有意义。
    if (seen.has(url)) continue
    seen.add(url)

    // 名称缺省时用序号兜底：二维码本身仍然可辨，比整条丢弃更有用
    const name = shortText(source.name, DONATE_NAME_MAX) ?? `二维码 ${items.length + 1}`
    items.push({ name, url })
  }

  return items
}

/**
 * 从主题配置（或任何同形对象）读取 Donate 配置。
 *
 * 输入来自服务端 Snippet，这里不信任其形状：不是对象、字段类型不对，
 * 一律退化为「关闭 + 默认文案 + 空列表」。
 */
export function readDonateConfig(theme: unknown): DonateConfig {
  const donate = record(record(theme).donate)

  return {
    enabled: donate.enabled === true,
    label: shortText(donate.label, DONATE_LABEL_MAX) ?? DONATE_DEFAULT_LABEL,
    qrcodes: parseDonateQrcodes(donate.qrcode),
  }
}

/**
 * 入口是否可见：开关打开 **且** 至少有一张合法二维码。
 * 两个条件缺一不可 —— 一个点开是空白的入口比不显示更差。
 */
export function isDonateVisible(config: DonateConfig): boolean {
  return config.enabled && config.qrcodes.length > 0
}

/** 页面侧只需要「有没有」时用它，避免在 JSX 里重复读两次配置 */
export function hasDonate(theme: unknown): boolean {
  return isDonateVisible(readDonateConfig(theme))
}
