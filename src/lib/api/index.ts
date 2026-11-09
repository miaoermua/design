/**
 * 数据访问层公开入口
 *
 * 页面与 feature 只从这里取数据，不允许直接 import client/ 或 contracts/。
 * 依赖方向：页面 → feature → 本层 → 契约。
 */

export * from './domain/article'
export * from './domain/diary'
export * from './domain/taxonomy'
export * from './domain/common'

export * from './errors'

export { listArticles, getArticle } from './repositories/posts'
export { listDiaries, getDiary, getDiaryByNid } from './repositories/notes'
export {
  listCategories,
  listTags,
  getCategoryBySlug,
  listArticlesByTag,
} from './repositories/taxonomy'
export { getSiteIdentity, getTimeline, listFriendLinks } from './repositories/site'
export { searchArticles } from './repositories/search'
export { getPageBySlug, type PageContent } from './repositories/pages'

export { API_VERSION, getSiteTimezone, getSiteUrl, isApiConfigured } from './config'
