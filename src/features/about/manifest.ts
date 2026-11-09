import type { FeatureManifest } from '../types'

export const aboutFeature: FeatureManifest = {
  key: 'about',
  name: '关于',
  description: '独立页面（pages/about）与站点主人的公开信息。',
  routes: ['/about'],
  endpoints: ['GET /pages/slug/about', 'GET /aggregate'],
}
