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
  search: true,
  about: true,
  friends: true,
  /** P3：评论需要登录态与审核策略，本版本未启用 */
  comments: false,
  /** P3：点赞/阅读上报等写操作未启用，站点为只读 */
  interactions: false,
} as const

export type FeatureKey = keyof typeof featureFlags

export function isFeatureEnabled(key: FeatureKey): boolean {
  return featureFlags[key]
}

export const DEFAULT_FEATURE_STATE: Readonly<Record<FeatureKey, boolean>> = featureFlags
