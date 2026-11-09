import type { FeatureManifest } from '../types'

export const articlesFeature: FeatureManifest = {
  key: 'articles',
  name: '文章',
  description: '长文列表与阅读页：分类、标签、相关阅读与上下篇。',
  routes: ['/articles', '/articles/[category]/[slug]'],
  endpoints: ['GET /posts', 'GET /posts/:category/:slug', 'GET /aggregate'],
}
