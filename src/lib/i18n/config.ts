/**
 * 语言配置
 *
 * Folio 的语言能力分两层，这里的配置同时服务两层：
 *
 *   1. **内容层**（文章 / 日记 / 页面 / 搜索结果）：由 Mix Space 后端翻译。
 *      实测协议是查询参数 `?lang=en`（`?locale=` 无效），详情与列表都生效。
 *      本主题不改写正文、不调用未公开的 AI 接口。
 *   2. **界面层**（导航、按钮、区块标题）：后端没有 UI 文案接口，
 *      由 `dictionary.ts` 提供静态字典。这一层数量有限且可穷举。
 *
 * 界面只有**两种**语言：简体中文与英文。中文不再分简繁——
 * `zh-TW` / `zh-HK` / `zh-Hant` 等变体一律按简体处理（见 `normalizeLocale`），
 * 不做繁简转换，也不维护第二套中文字典。
 *
 * 语言状态有两个来源，优先级固定：
 *   1. 用户手动选择 → cookie `folio-lang`（一年有效）
 *   2. 浏览器 `Accept-Language`（仅在 cookie 缺失或非法时参与）
 *   3. `FALLBACK_LOCALE`（英文）
 *
 * 手动选择与自动协商的区别是刻意的：**自动协商不写 cookie**。
 * 因此「cookie 是否存在」本身就是「用户有没有手动选过」的判据，
 * 不需要再引入第二个标记；用户选过之后，刷新、路由切换、
 * 换浏览器语言都不会被自动识别覆盖。
 */

export const LOCALES = ['zh-CN', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/**
 * 内容层的基准语言：不发 `?lang=`，让后端返回原文。
 *
 * 它与「自动识别失败时的兜底」不是同一件事，刻意分开：
 * 前者决定取数参数，后者决定界面语言。若把兜底也写成 `zh-CN`，
 * 没有 `Accept-Language` 的访客就会拿到中文界面；
 * 若把基准语言写成 `en`，英文正文反而会因为「等于默认」而不发 `?lang=en`。
 */
export const DEFAULT_LOCALE: Locale = 'zh-CN'

/** 自动识别不出中文时的兜底：没有 header、全是无效标签、首选语言非中文 */
export const FALLBACK_LOCALE: Locale = 'en'

/** 与 ThemeToggle 的 localStorage 键同构：cookie 供服务端读，避免 hydration 差异 */
export const LOCALE_COOKIE = 'folio-lang'

const LOCALE_SET: readonly string[] = LOCALES

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALE_SET.includes(value)
}

/**
 * 任意语言标签 → 本站支持的两种 Locale 之一。
 *
 * 中文（`zh` 及其任意地区、文字变体）一律归为 `zh-CN`：
 * 本站只提供一套简体界面，`zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant` 都按简体处理，
 * 不做繁简转换，也不允许由此产生第三个 locale。
 * 其余语言（`en` / `ja` / `ko` / `fr` …）统一归入 `en`——
 * 本站没有第三套字典，与其给日语用户一屏中文，不如给英文。
 *
 * 返回值 `null` 只表示「这不是一个可识别的语言标签」，用于协商时跳过该条目；
 * **凡识别得出的结果，一定是 `zh-CN` 或 `en` 之一。**
 */
export function normalizeLocale(tag: string | null | undefined): Locale | null {
  if (typeof tag !== 'string') return null

  const trimmed = tag.trim().toLowerCase().replaceAll('_', '-')
  if (!trimmed) return null

  // `Accept-Language: *` 只表示「什么都行」，不代表任何具体语言
  if (trimmed === '*') return null

  const primary = trimmed.split('-')[0] ?? ''
  // 排除私有用标签（x-…）、纯数字与残缺标签
  if (!/^[a-z]{2,3}$/.test(primary)) return null

  // 中文的任意地区/脚本变体都按简体处理：站点只有一套中文
  if (primary === 'zh') return 'zh-CN'

  return 'en'
}

/**
 * cookie 值 → Locale。
 *
 * 除当前支持的两个值之外，额外接受中文变体（裸 `zh`，以及旧版本的
 * `zh-TW` / `zh-HK` / `zh-Hant`）：那些都曾是合法的手动选择，
 * 直接判非法会让老用户的偏好被静默重置回浏览器语言。
 *
 * 非中文的未知值仍然判非法、交回协商——cookie 只由本站写入，
 * 出现 `ja` 之类基本意味着被手工改过，不该被当成用户偏好。
 */
export function parseLocaleCookie(value: unknown): Locale | null {
  if (isLocale(value)) return value
  if (typeof value !== 'string') return null
  return normalizeLocale(value) === 'zh-CN' ? 'zh-CN' : null
}

interface LanguageRange {
  tag: string
  quality: number
  /** 原始顺序，用于同权重时保持声明次序 */
  index: number
}

/**
 * 解析单个条目的 q 参数。
 *
 * `null` = 该条目不可用（q 值不合法或为 0，即「明确拒绝」）；
 * 未声明 q 按 HTTP 语义视为 1。
 */
function parseQuality(params: readonly string[]): number | null {
  for (const param of params) {
    const separator = param.indexOf('=')
    if (separator < 0) continue
    if (param.slice(0, separator).trim().toLowerCase() !== 'q') continue

    const raw = param.slice(separator + 1).trim()
    // RFC 7231 §5.3.1：0 或 1，最多三位小数；其他写法一律视为无效
    if (!/^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/.test(raw)) return null
    return Number(raw)
  }
  return 1
}

/**
 * `Accept-Language` → Locale。
 *
 * 规则：
 *   - 按 `,` 拆分，逐条取 `tag;q=`；
 *   - 按 q 降序，**同权重保持原始顺序**；
 *   - 无效标签（`123`、`x-private`、空）与无效 q 值（`q=abc`、`q=2`、`q=0`）跳过；
 *   - `*` 不产生匹配；
 *   - 全部条目都不命中时返回 `null`，由 `detectLocale` 落到兜底语言。
 *
 * 只读第一个条目是不够的：`ja, zh-CN;q=0.9` 与 `zh-CN, ja;q=0.9` 必须得到不同结果。
 *
 * **按首选语言判断，不扫描「列表里有没有中文」**：`ja-JP, zh-CN;q=0.9`
 * 得到的是英文——用户把日语放在第一位，就不该被强行切成中文。
 */
export function negotiateLocale(header: string | null | undefined): Locale | null {
  if (typeof header !== 'string' || !header.trim()) return null

  const ranges: LanguageRange[] = []
  header.split(',').forEach((chunk, index) => {
    const trimmed = chunk.trim()
    if (!trimmed) return

    const [rawTag, ...params] = trimmed.split(';')
    const tag = rawTag?.trim() ?? ''
    if (!tag) return

    const quality = parseQuality(params)
    if (quality === null || quality === 0) return

    ranges.push({ tag, quality, index })
  })

  ranges.sort((a, b) => b.quality - a.quality || a.index - b.index)

  for (const range of ranges) {
    const locale = normalizeLocale(range.tag)
    if (locale) return locale
  }

  return null
}

/**
 * `Accept-Language` → 最终界面语言，**保证落在两种 Locale 内**。
 *
 * 与 `negotiateLocale` 的差别只在兜底：后者用 `null` 表示「没有可用条目」，
 * 前者把它落成 `FALLBACK_LOCALE`。调用方拿到的一定是可用的语言，
 * 不必在每处再写一次 `?? FALLBACK_LOCALE`。
 */
export function detectLocale(header: string | null | undefined): Locale {
  return negotiateLocale(header) ?? FALLBACK_LOCALE
}

/**
 * 归一化后端可接受的语言标记。
 *
 * 默认语言不传参数——让后端返回原文，避免把中文正文再「翻译」一次。
 * 界面层只有两种语言，因此内容层也只可能出现 `?lang=en` 这一种取值。
 */
export function toContentLang(locale: Locale): string | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale
}

/** OpenGraph 用 `语言_地区` 形式，与 `<html lang>` 的 BCP 47 不同 */
export function toOgLocale(locale: Locale): string {
  return locale === 'en' ? 'en_US' : 'zh_CN'
}

/**
 * 短标识：`中` / `EN`。
 *
 * 工具条按钮与菜单 Settings 共用同一份——「显示什么」只在这里定义一次，
 * 避免两处一个写 `简`、一个写 `中`。
 */
export function localeLabel(locale: Locale): string {
  return locale === 'en' ? 'EN' : '中'
}

/** 全名：无障碍名称与悬停提示用，不做截断 */
export function localeName(locale: Locale): string {
  return locale === 'en' ? 'English' : '中文'
}

/**
 * 任意 BCP 47 语言代码 → 中文名称
 *
 * AI 摘要 / 精读的语言由 Core 决定（`zh` / `en` / `ja` …），不受本主题的
 * LOCALES 限制，所以不能用 `localeName`。取不到名称时退回代码本身，
 * 宁可显示 `ja` 也不显示 `undefined`。
 */
export function languageLabel(code: string): string {
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
