import type { FeatureManifest } from '../types'

export const diariesFeature: FeatureManifest = {
  key: 'diaries',
  name: '日记',
  description: '以日为单位的时间流：情绪、天气、地点与密码保护。',
  routes: ['/diaries', '/diaries/[id]'],
  endpoints: ['GET /notes', 'GET /notes/:id', 'GET /aggregate'],
}
