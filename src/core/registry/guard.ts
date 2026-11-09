import { notFound } from 'next/navigation'
import { isFeatureEnabled, type FeatureKey } from './features'

/**
 * 在页面入口调用：模块被禁用时直接走 404。
 * 放在页面顶层（任何取数之前），保证禁用模块零请求。
 */
export function requireFeature(key: FeatureKey): void {
  if (!isFeatureEnabled(key)) notFound()
}
