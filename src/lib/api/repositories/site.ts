import { requestV2 } from '../client/http'
import type { V2Aggregate, V2LinkRow, V2TimelineBody } from '../contracts/v2'
import { expectObject, unwrapListBody } from '../adapters/common'
import { toSiteIdentity, toTimeline } from '../adapters/site'
import { toFriendLink } from '../adapters/taxonomy'
import type { FriendLink, SiteIdentity } from '../domain/taxonomy'
import type { V2TimelineType } from '../contracts/v2/site'

/** GET /aggregate —— 站点身份、SEO、评论开关、最新日记 */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const body = await requestV2<unknown>('/aggregate', { revalidate: 600, tags: ['site'] })
  return toSiteIdentity(expectObject<V2Aggregate>(body, '/aggregate'))
}

/** GET /aggregate/timeline?type=&year= */
export async function getTimeline(options: {
  type?: V2TimelineType
  year?: number
  sort?: 1 | -1
} = {}): Promise<{ articles: ReturnType<typeof toTimeline>['articles']; diaries: ReturnType<typeof toTimeline>['diaries'] }> {
  const body = await requestV2<unknown>('/aggregate/timeline', {
    query: { type: options.type, year: options.year, sort: options.sort ?? -1 },
    revalidate: 300,
    tags: ['timeline'],
  })
  return toTimeline(expectObject<V2TimelineBody>(body, '/aggregate/timeline'))
}

/**
 * GET /links/all —— 只取已通过审核（LinkState.Pass = 0）且未被隐藏的友链。
 *
 * ⚠️ 语义易错：core 的 LinkState 是 0=已通过 / 1=审核中 / 2=已过期 / 3=已屏蔽 / 4=已拒绝，
 * 不是「1 表示通过」。
 */
export async function listFriendLinks(): Promise<FriendLink[]> {
  const body = await requestV2<unknown>('/links/all', { revalidate: 600, tags: ['links'] })
  return unwrapListBody<V2LinkRow>(body, '/links/all')
    .map(toFriendLink)
    .filter((link) => link.state === 0 && !link.hidden)
}
