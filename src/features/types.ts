import type { FeatureKey } from '@/core/registry/features'

/**
 * 模块清单
 *
 * 目的不是「文档」，而是让模块的边界可被程序检查：
 *   - routes 与真实目录一一对应（测试会校对）；
 *   - key 必须是 Feature Registry 里的开关。
 *
 * 关闭某个模块 = featureFlags[key] = false，清单与导航随之消失。
 */
export interface FeatureManifest {
  key: FeatureKey
  name: string
  description: string
  /** 该模块独占的路由前缀 */
  routes: string[]
  /** 该模块依赖的数据接口（用于审查「禁用后零请求」） */
  endpoints: string[]
}
