import type { FeatureManifest } from '../types'

export const taxonomyFeature: FeatureManifest = {
  key: 'taxonomy',
  name: '分类与标签',
  description: '按分类与标签重新组织文章，不提供前端伪搜索。',
  routes: ['/tags', '/tags/[tag]', '/categories', '/categories/[slug]'],
  endpoints: [
    'GET /categories?type=0',
    'GET /categories?type=1',
    'GET /categories/:slug',
    'GET /categories/:tag?tag=true',
  ],
}
