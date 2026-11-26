import type { FeatureManifest } from '../types'

export const friendsFeature: FeatureManifest = {
  key: 'friends',
  name: '友链',
  description:
    '已通过审核的友链（state === 0）以明信片展示；已过期的（state === 2）单开一类列在下方。',
  routes: ['/friends'],
  endpoints: ['GET /links/all'],
}
