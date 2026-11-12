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
  /** P3：评论需要登录态与审核策略，本版本未启用 */
  comments: false,
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
