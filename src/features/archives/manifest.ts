import type { FeatureManifest } from '../types'

/**
 * 探索与归档（**一个开关、一份清单**）
 *
 * `/explore` 与 `/archives` 共用 `archives` 这一个开关：前者是后者的新版入口，
 * 两者读的是同一条时间轴。因此它们只能属于**同一份 manifest** —— 曾经拆成
 * `archives/manifest.ts` 与 `explore/manifest.ts` 两片、都写 `key: 'archives'`，
 * 结果 `featureManifestByKey` 用 key 建索引时后者的条目把前者**静默覆盖**，
 * 归档那份 manifest 永远取不到。清单只有一份才不会自相矛盾。
 *
 * `/tags`、`/categories` 不在这里：它们归 `taxonomy`，有自己的开关与清单。
 */
export const archivesFeature: FeatureManifest = {
  key: 'archives',
  name: '探索与归档',
  description: '把文章与日记合并到同一条时间轴，按年月或主题找到文章。',
  routes: ['/explore', '/archives'],
  endpoints: ['GET /aggregate/timeline', 'GET /categories?type=0', 'GET /categories?type=1'],
}
