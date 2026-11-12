/**
 * Feature Registry
 *
 * 单一开关源。关闭某个模块必须同时做到：
 *   1. 导航不再出现（core/navigation 过滤）
 *   2. 路由不可达（页面入口调用 requireFeature）
 *   3. 不产生该模块的 API 请求（页面在取数之前就 404）
 *
 * 因此「关模块」= 改这里的一个布尔值，不需要删文件、不需要留失效链接。
 */

export const featureFlags = {
  articles: true,
  diaries: true,
  taxonomy: true,
  archives: true,
  /** 独立页面（Mix Space /pages）：与文章/日记并列的内容类型 */
  pages: true,
  search: true,
  about: true,
  friends: true,
  /**
   * 评论（`src/features/comments`）
   *
   * 只做 Core v12 真正支持的部分：读取、匿名发表、匿名回复、分页、
   * 长线程补页、排序。不做点赞 / 举报 / 读者自助删改 / 悄悄话 / 图片 /
   * 登录读者评论 —— 那些要么 Core 没有，要么需要整套登录态。
   */
  comments: true,
  /**
   * AI 摘要 / AI 精读（`src/features/ai-summary` / `src/features/ai-insights`）
   *
   * 两者都只读 Core 已生成的资源，不在前端触发任何生成。
   * 开关关掉时不发请求，页面上也不会留下空容器。
   * 只有 post / note 支持，page 不接（Core 对该类型返回 1002）。
   */
  aiSummary: true,
  aiInsights: true,
  /**
   * 点赞 / 邮件订阅（`src/features/interactions`）
   *
   * 与 `comments` 分开：这两件事都有官方接口且已接入
   * （POST /activity/like、GET /subscribe/status + POST /subscribe）。
   * 关掉它会让操作栏的 Like / Subscribe 一起消失，并且不再探测 /subscribe/status。
   */
  interactions: true,
} as const

export type FeatureKey = keyof typeof featureFlags

export function isFeatureEnabled(key: FeatureKey): boolean {
  return featureFlags[key]
}

export const DEFAULT_FEATURE_STATE: Readonly<Record<FeatureKey, boolean>> = featureFlags
