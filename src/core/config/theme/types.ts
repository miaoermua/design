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

/**
 * 图标来源类型。
 *
 * 三种类型的能力**并不对等**，这一点必须写在类型里而不是留给读者猜：
 *   - `builtin`：主题自带的纯内联 SVG，随 RSC payload 一起到达，永远可用；
 *   - `css`：一个图标字体 class 名，只有当 `iconStylesheets` 真的声明了
 *     对应样式表时才有意义，否则浏览器无从解析这个 class；
 *   - `iconify`：仅保存图标标识，**当前没有运行时加载器**，渲染时降级为
 *     builtin 的兜底图形。保留该类型是为了让配置可以被无损解析、
 *     被将来的加载器接管，而不是假装已经支持。
 */
export type SocialIconType = 'builtin' | 'css' | 'iconify'

export interface ThemeSocialIcon {
  type: SocialIconType
  /**
   * `builtin` → 内置图标键（如 `github`）
   * `css` → 一个或多个 class 名，空格分隔（如 `fa fa-at`）
   * `iconify` → 图标标识（如 `mingcute:telegram-fill`）
   */
  name: string
}

/**
 * 单个社交项目。
 *
 * 每一项都自带地址，不由平台键推导 URL。因此同一平台可以出现多次
 * （例如两个 Telegram 频道），也不会因为平台名相同而互相覆盖。
 */
export interface ThemeSocialItem {
  /** 展示标题；缺失时由解析层用主机名兜底，不会留下无标题的链接 */
  title: string
  /** 已校验：http(s) 绝对地址或 mailto: */
  url: string
  /** null 表示不指定图标，由渲染层按 URL 猜一个兜底图形 */
  icon: ThemeSocialIcon | null
  /** 已校验为安全的颜色字面量（hex 或 var(--accent-strong)）；null 表示用主题默认色 */
  color: string | null
}

export interface ThemeSocial {
  enabled: boolean
  /**
   * 自定义社交项目，顺序即展示顺序。
   *
   * 这些项目会与 `/aggregate` 的 `user.social_ids` 合并：
   * URL 相同的视为同一个项目，以这里的配置为准；其余追加在后面。
   */
  items: ThemeSocialItem[]
  /**
   * 为 `css` 类型图标准备的样式表地址（已校验、去重、截断）。
   *
   * 与 `custom.css` 分开配置，是因为两者的语义不同：`custom.css` 是
   * 「整体外观覆盖」，这里只是「图标字体」，混在一起会让「我只想加一个
   * 图标字体」变成「我顺手改了整个站点的样式」。
   */
  iconStylesheets: string[]
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
