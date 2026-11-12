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
 * 语言状态存在 cookie `folio-lang` 里，服务端读取后同时作用于上面两层，
 * 因此首帧就是目标语言，不会出现「先中文再变英文」的闪烁。
 */

export const LOCALES = ['zh', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'zh'

/** 与 ThemeToggle 的 localStorage 键同构：cookie 供服务端读，避免 hydration 差异 */
export const LOCALE_COOKIE = 'folio-lang'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * 归一化后端可接受的语言标记。
 *
 * 后端接受 `en` 与 `en-US` 这类 BCP 47 标记，取主语言子标签即可。
 * 默认语言不传参数——让后端返回原文，避免把中文正文再「翻译」一次。
 */
export function toContentLang(locale: Locale): string | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale
}

export function localeLabel(locale: Locale): string {
  return locale === 'en' ? 'EN' : '中'
}

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