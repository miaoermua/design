import type { FeatureManifest } from '../types'

export const pagesFeature: FeatureManifest = {
  key: 'pages',
  name: '页面',
  description: 'Mix Space 独立页面：不进入时间轴、没有分类与标签的常驻内容。',
  routes: ['/pages', '/pages/[slug]'],
  endpoints: ['GET /pages', 'GET /pages/slug/:slug'],
}