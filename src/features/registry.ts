import type { FeatureKey } from '@/core/registry/features'
import { aboutFeature } from './about/manifest'
import { archivesFeature } from './archives/manifest'
import { articlesFeature } from './articles/manifest'
import { diariesFeature } from './diaries/manifest'
import { exploreFeature } from './explore/manifest'
import { friendsFeature } from './friends/manifest'
import { pagesFeature } from './pages/manifest'
import { searchFeature } from './search/manifest'
import { taxonomyFeature } from './taxonomy/manifest'
import type { FeatureManifest } from './types'

/**
 * 模块清单索引
 *
 * 这份清单描述「已实现的模块」，开关仍在 core/registry/features。
 *
 * `explore` 与 `archives` / `taxonomy` 共用开关：前者是「归档 + 标签」的统一入口，
 * 后两者保留各自的旧路由与查询语义。关闭开关时，导航入口与全部相关路由一起消失。
 */
export const featureManifests: FeatureManifest[] = [
  articlesFeature,
  diariesFeature,
  taxonomyFeature,
  archivesFeature,
  exploreFeature,
  pagesFeature,
  searchFeature,
  aboutFeature,
  friendsFeature,
]

export const featureManifestByKey: Partial<Record<FeatureKey, FeatureManifest>> =
  Object.fromEntries(featureManifests.map((manifest) => [manifest.key, manifest]))