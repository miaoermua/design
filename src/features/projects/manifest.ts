import type { FeatureManifest } from '../types'

export const projectsFeature: FeatureManifest = {
  key: 'projects',
  name: '项目',
  description: '作品集：按时间排列的项目卡片，含名称、简介与行动链接。',
  routes: ['/projects'],
  endpoints: ['GET /projects'],
}
