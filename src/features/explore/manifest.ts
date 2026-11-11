import type { FeatureManifest } from '../types'

export const exploreFeature: FeatureManifest = {
  key: 'archives',
  name: '探索',
  description: '归档与标签的统一入口：按时间或按主题找到文章。',
  routes: ['/explore', '/archives', '/tags', '/tags/[tag]', '/categories', '/categories/[slug]'],
  endpoints: ['GET /aggregate/timeline', 'GET /categories?type=0', 'GET /categories?type=1'],
}