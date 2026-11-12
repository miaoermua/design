import { HOME_RECENT_ARTICLES, HOME_RECENT_DIARIES } from '../site'
import type { ThemeConfig } from './types'

/**
 * Theme 配置默认值
 *
 * 与「构建期常量」的关系：`core/config/site.ts` 里的数值仍是默认来源，
 * 这里只是把它们组装成 ThemeConfig 的形状。Snippet 缺失时页面行为
 * 与引入 Theme 配置之前**完全一致**——这是刻意的，降级不能带来视觉回退。
 */

/** 版权起始年份的合理区间：太早或未来年份都视为配置错误 */
export const SINCE_MIN = 1990
/** 年份上限用「当前年 + 1」，允许跨年时提前写好 */

export const FOOTER_LINK_NAME_MAX = 24
export const FOOTER_LINK_MAX = 12

/** 首页条数上下限：下限 1（否则等于关闭），上限对齐 v2 的 size 上限 50 */
export const HOME_LIMIT_MIN = 1
export const HOME_LIMIT_MAX = 50

/**
 * 外部自定义样式表条数上限。
 *
 * 8 条足够「一个基础样式 + 若干覆盖」，再多就说明把站点样式拆得太碎；
 * 每条都是一次阻塞渲染的额外请求，无上限等于允许配置拖慢首屏。
 */
export const CUSTOM_CSS_MAX_URLS = 8

/** 单条 CSS URL 的长度上限：正常 CDN 地址远小于这个值 */
export const CUSTOM_CSS_URL_MAX_LENGTH = 2048

/** 赞赏入口文案长度上限 */
export const DONATE_LABEL_MAX = 16
/** 二维码展示名长度上限：过长的名字会把浮层撑宽 */
export const DONATE_NAME_MAX = 16

/**
 * 二维码条数上限。
 *
 * 4 张足够覆盖「微信 + 支付宝 + 其它」的常见组合；再多会把浮层拉成一长条，
 * 而不是一个「扫一下」的轻量入口。
 */
export const DONATE_QRCODE_MAX = 4

/** 单条二维码地址长度上限，与消费层的校验保持一致 */
export const DONATE_URL_MAX_LENGTH = 2048

/**
 * 自定义社交项目条数上限。
 *
 * 社交图标是「自我介绍」的一行，不是名片墙。24 条已经远超正常使用，
 * 再多的配置只会把首页撑成一排按钮；上限同时保证 SSR 输出可预期。
 */
export const SOCIAL_ITEM_MAX = 24

/** 单条社交地址长度上限；正常主页地址远小于这个值 */
export const SOCIAL_URL_MAX_LENGTH = 2048

/** 社交项目标题长度上限：过长的标题会破坏图标行的对齐 */
export const SOCIAL_TITLE_MAX = 32

/**
 * CSS 图标样式表条数上限。
 *
 * 一个图标字体 = 一次额外请求（且通常带字体文件）。2 条足够
 * 「Font Awesome + 一个补充字体」，再多就是配置失控。
 */
export const SOCIAL_ICON_STYLESHEET_MAX = 2

/** 单个 CSS 图标 class 串的长度上限（如 `fa fa-at` 远小于这个值） */
export const SOCIAL_ICON_CLASS_MAX = 48

/** CSS 图标最多由几个 class 组成：`fa fa-at fa-lg` 已经是 3 个 */
export const SOCIAL_ICON_CLASS_PARTS_MAX = 4

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  footer: {
    since: null,
    links: [],
    icp: { enabled: false, label: null, url: null },
  },
  social: {
    enabled: true,
    items: [],
    iconStylesheets: [],
    order: [],
    icons: {},
  },
  custom: {
    css: [],
  },
  homepage: {
    profile: { enabled: true, limit: 0 },
    articles: { enabled: true, limit: HOME_RECENT_ARTICLES },
    notes: { enabled: true, limit: HOME_RECENT_DIARIES },
  },
  donate: {
    enabled: false,
    label: '赞赏',
    qrcode: [],
  },
  bandevtool: { enabled: false },
}

/** 深拷贝默认值：避免调用方修改到共享常量 */
export function cloneDefaultThemeConfig(): ThemeConfig {
  return structuredClone(DEFAULT_THEME_CONFIG)
}
