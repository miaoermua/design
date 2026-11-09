import type { FeatureKey } from '@/core/registry/features'
import { aboutFeature } from './about/manifest'
import { archivesFeature } from './archives/manifest'
import { articlesFeature } from './articles/manifest'
import { diariesFeature } from './diaries/manifest'
import { friendsFeature } from './friends/manifest'
import { searchFeature } from './search/manifest'
import { taxonomyFeature } from './taxonomy/manifest'
import type { FeatureManifest } from './types'

/**
 * 模块清单索引
 *
 * 这份清单描述「已实现的模块」，开关仍在 core/registry/features。
 * 两者的一致性由 tests/features.test.ts 校验：
 *   - 清单里的 key 必须存在；
 *   - 每个启用的模块至少要有一条真实路由。
 */
export const featureManifests: FeatureManifest[] = [
  articlesFeature,
  diariesFeature,
  taxonomyFeature,
  archivesFeature,
  searchFeature,
  aboutFeature,
  friendsFeature,
]

export const featureManifestByKey: Partial<Record<FeatureKey, FeatureManifest>> =
  Object.fromEntries(featureManifests.map((manifest) => [manifest.key, manifest]))
