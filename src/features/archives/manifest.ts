import type { FeatureManifest } from '../types'

export const archivesFeature: FeatureManifest = {
  key: 'archives',
  name: '归档',
  description: '把文章与日记合并到同一条时间轴，按年月分组。',
  routes: ['/archives'],
  endpoints: ['GET /aggregate/timeline'],
}
