import type { FeatureManifest } from '../types'

export const saysFeature: FeatureManifest = {
  key: 'says',
  name: '一言',
  description: '语录式短内容：一句话加时间，按发布时间倒序。',
  routes: ['/says'],
  endpoints: ['GET /says'],
}
