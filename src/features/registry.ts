import type { FeatureKey } from '@/core/registry/features'
import { aboutFeature } from './about/manifest'
import { archivesFeature } from './archives/manifest'
import { articlesFeature } from './articles/manifest'
import { diariesFeature } from './diaries/manifest'
import { friendsFeature } from './friends/manifest'
import { pagesFeature } from './pages/manifest'
import { projectsFeature } from './projects/manifest'
import { saysFeature } from './says/manifest'
import { searchFeature } from './search/manifest'
import { taxonomyFeature } from './taxonomy/manifest'
import type { FeatureManifest } from './types'

/**
 * 模块清单索引
 *
 * 这份清单描述「有路由的模块」，开关仍在 `core/registry/features`。
 * 两条约束由 `tests/feature-manifest.test.ts` 守护，不是靠自觉：
 *   - **key 必须唯一**。曾经 `explore` 与 `archives` 两片清单都写 `key: 'archives'`，
 *     `featureManifestByKey` 用 key 建索引时后者静默覆盖前者——清单于是变成装饰品。
 *   - **routes 必须对应真实目录**，且该页面顶层的 `requireFeature()` 与这里的 key 一致。
 *     清单写错不会报错，只会让「关模块」这件事悄悄不成立。
 *
 * 没有独立路由的能力（`comments` / `aiSummary` / `aiInsights` / `interactions`）
 * 不登记 manifest：它们挂在文章与日记页内，边界写在各 feature 的源码注释里。
 */
export const featureManifests: FeatureManifest[] = [
  articlesFeature,
  diariesFeature,
  taxonomyFeature,
  archivesFeature,
  pagesFeature,
  searchFeature,
  aboutFeature,
  friendsFeature,
  saysFeature,
  projectsFeature,
]

export const featureManifestByKey: Partial<Record<FeatureKey, FeatureManifest>> =
  Object.fromEntries(featureManifests.map((manifest) => [manifest.key, manifest]))
