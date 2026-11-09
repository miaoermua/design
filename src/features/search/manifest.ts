import type { FeatureManifest } from '../types'

export const searchFeature: FeatureManifest = {
  key: 'search',
  name: '搜索',
  description: '服务端全文搜索，片段高亮只保留后端插入的 <mark>。',
  routes: ['/search'],
  endpoints: ['GET /search/post'],
}
