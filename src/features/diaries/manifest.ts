import type { FeatureManifest } from '../types'

export const diariesFeature: FeatureManifest = {
  key: 'diaries',
  name: '日记',
  description: '以日为单位的时间流：情绪、天气、地点与密码保护。',
  /**
   * `/notes`      — 主入口，定位最新一篇（307）
   * `/notes/list` — 时间线：分页 + 按天分组 + 专栏筛选
   * `/notes/[nid]`— 详情
   *
   * `/diaries`、`/diaries/[id]` 是**旧路由的兼容层**（分别重定向到时间线与
   * 按 nid 定位的详情）。它们带 `requireFeature` 守卫、也确实属于这个模块，
   * 所以一并登记：漏登记的话关模块时这两条会被漏掉，还会让
   * `tests/feature-manifest.test.ts` 的覆盖率检查失败。
   */
  routes: ['/notes', '/notes/list', '/notes/[nid]', '/diaries', '/diaries/[id]'],
  endpoints: ['GET /notes', 'GET /notes/nid/:nid', 'GET /aggregate'],
}
