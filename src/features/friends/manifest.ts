import type { FeatureManifest } from '../types'

export const friendsFeature: FeatureManifest = {
  key: 'friends',
  name: '友链',
  description:
    '已通过审核的友链（state === 0）以明信片展示；已过期的（state === 2）单开一类列在下方，并可查看、复制本站的 MX 友链数据以及提交申请。',
  routes: ['/friends'],
  endpoints: ['GET /aggregate', 'GET /links/all', 'GET /links/audit', 'POST /links/audit'],
}
