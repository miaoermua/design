/**
 * Theme 配置模块
 *
 * 分层（每层只做一件事，互不越界）：
 *   repository.ts   远端读取 → 状态（ok / missing / forbidden / unavailable / invalid）
 *   parser.ts       对象校验 + 字段级降级 → ThemeConfig
 *   css-url.ts      自定义样式表的 URL 校验、去重、截断
 *   social.ts       社交项目与图标（builtin / css / iconify）的校验
 *   defaults.ts     默认值（Snippet 缺失时页面行为与引入前一致）
 *   loader.ts       组合以上三者，对页面暴露「一定可用」的配置
 *   types.ts        类型定义
 *
 * 页面只用 `getThemeConfig()` / `loadThemeConfig()`，不直接碰 repository。
 */

export { getThemeConfig, loadThemeConfig, type LoadedTheme } from './loader'
export { fetchThemeSnippet, type ThemeFetchResult, type ThemeFetchStatus } from './repository'
export {
  footerYearRange,
  parseThemeConfig,
  parseFooter,
  parseHomepage,
  parseDonateQrcodes,
  safeHttpUrl,
} from './parser'
export { normalizeCustomCssList, normalizeCssUrl, type CustomCssUrlResult } from './css-url'
export {
  IMPLEMENTED_ICON_TYPES,
  parseIconStylesheets,
  parseSocialIcon,
  parseSocialItems,
  safeCssIconClass,
  safeSocialColor,
  safeSocialUrl,
} from './social'
export {
  CUSTOM_CSS_MAX_URLS,
  CUSTOM_CSS_URL_MAX_LENGTH,
  DEFAULT_THEME_CONFIG,
  DONATE_LABEL_MAX,
  DONATE_NAME_MAX,
  DONATE_QRCODE_MAX,
  DONATE_URL_MAX_LENGTH,
  HOME_LIMIT_MAX,
  HOME_LIMIT_MIN,
  SOCIAL_ICON_CLASS_MAX,
  SOCIAL_ICON_CLASS_PARTS_MAX,
  SOCIAL_ICON_STYLESHEET_MAX,
  SOCIAL_ITEM_MAX,
  SOCIAL_TITLE_MAX,
  SOCIAL_URL_MAX_LENGTH,
  cloneDefaultThemeConfig,
} from './defaults'
export type {
  SocialIconType,
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
  ThemeSocialIcon,
  ThemeSocialItem,
} from './types'
