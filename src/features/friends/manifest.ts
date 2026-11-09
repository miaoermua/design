import type { FeatureManifest } from '../types'

export const friendsFeature: FeatureManifest = {
  key: 'friends',
  name: '友链',
  description: '只展示已通过审核的友链（state === 1）。',
  routes: ['/friends'],
  endpoints: ['GET /links/all'],
}
