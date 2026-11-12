/**
 * Theme 配置 — 类型定义
 *
 * 数据来自 Mix Space 的 YAML Snippet（`GET /snippets/theme/:name`）。
 *
 * 协议事实（已核对 core v5.0.0 `snippet.service.ts`）：
 *   - 写入时 `SnippetService.validateTypeAndCleanup()` 用 `js-yaml` 的 `load()` 校验 raw；
 *   - 读取时 `getPublicSnippetByName()` → `attachSnippet()` 里
 *     `Reflect.set(model, 'data', load(model.raw))`，最终 `return res.data`。
 *
 * 即**后端返回的是已解析的 JSON 对象，不是 YAML 字符串**。
 * 因此本模块不做 YAML 解析，只做对象形状校验 —— 这样既不重复解析，
 * 也不引入前端 YAML 库（避免原型污染与自定义标签风险）。
 *
 * 所有字段都是可选的：Snippet 缺失、字段缺失、字段非法，都退化为默认值。
 */

export interface ThemeFooterLink {
  name: string
  url: string
}

export interface ThemeIcp {
  enabled: boolean
  label: string | null
  url: string | null
}

export interface ThemeFooter {
  /** 起始年份，用于 `© 2021–2026`；null 表示不配置，只显示当前年 */
  since: number | null
  links: ThemeFooterLink[]
  icp: ThemeIcp
}

export interface ThemeSocial {
  enabled: boolean
  /** 平台键的展示顺序；未列出的平台排在后面，保持 /aggregate 原始顺序 */
  order: string[]
  /** 平台键 → 图标名覆盖；值只接受字符串，不接受 SVG/HTML */
  icons: Record<string, string>
}

export interface ThemeCustom {
  /**
   * 外部样式表地址列表（已校验、已去重、已截断）。
   *
   * 语义与 Kami 一致：`custom.css` 是**外部 CSS URL 数组**，由服务端渲染成
   * `<link rel="stylesheet">`。空数组表示不输出任何 link。
   *
   * 刻意不接受内联 CSS 字符串：内联样式需要「让配置里的文本进入 HTML」，
   * 而那正是注入面。改成 URL 之后，配置只能决定「去加载哪个已存在的文件」，
   * 不再能决定「HTML 里出现什么内容」。
   */
  css: string[]
}

export interface ThemeHomepageSection {
  enabled: boolean
  /** 仅 articles / notes 有意义；已做上下限收敛 */
  limit: number
}

export interface ThemeHomepage {
  profile: ThemeHomepageSection
  articles: ThemeHomepageSection
  notes: ThemeHomepageSection
}

/** 单张赞赏二维码：名称只用于展示，地址已校验为 http(s) 绝对地址 */
export interface ThemeDonateQrcode {
  name: string
  url: string
}

export interface ThemeDonate {
  /** 只有显式 `true` 才显示入口 */
  enabled: boolean
  /** 入口文案，默认「赞赏」 */
  label: string
  /** 按配置顺序展示；非法条目已在解析阶段丢弃 */
  qrcode: ThemeDonateQrcode[]
}

export interface ThemeConfig {
  footer: ThemeFooter
  social: ThemeSocial
  custom: ThemeCustom
  homepage: ThemeHomepage
  donate: ThemeDonate
  bandevtool: { enabled: boolean }
}

/** Repository 的原始返回：配置对象 + 诊断信息 */
export type ThemeConfigStatus =
  /** 读取成功并解析出对象 */
  | 'ok'
  /** Snippet 不存在（404）——正常状态，不是错误 */
  | 'missing'
  /** 网络异常 / 超时 */
  | 'unavailable'
  /** 响应不是普通对象（数组、字符串、null） */
  | 'invalid'
  /** Snippet 存在但被标记为 private */
  | 'forbidden'

export interface ThemeConfigResult {
  /** 已合并默认值的结果；任何失败都返回默认配置，永不抛错 */
  config: ThemeConfig
  /** 远端是否真的返回了可用配置（用于诊断与测试） */
  status: ThemeConfigStatus
}
