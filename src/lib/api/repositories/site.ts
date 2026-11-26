import { postV2, requestV2 } from '../client/http'
import type {
  V2Aggregate,
  V2LinkApplicationInput,
  V2LinkAuditCapability,
  V2LinkRow,
  V2TimelineBody,
} from '../contracts/v2'
import { expectObject, unwrapListBody } from '../adapters/common'
import { toSiteIdentity, toTimeline } from '../adapters/site'
import { toFriendLink } from '../adapters/taxonomy'
import type { FriendLink, FriendLinkApplicationInput, SiteIdentity } from '../domain/taxonomy'
import type { V2TimelineType } from '../contracts/v2/site'
import { ApiError } from '../errors'

/** GET /aggregate —— 站点身份、SEO、评论开关、最新日记 */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const body = await requestV2<unknown>('/aggregate', { revalidate: 600, tags: ['site'] })
  return toSiteIdentity(expectObject<V2Aggregate>(body, '/aggregate'))
}

/**
 * GET /aggregate/timeline?type=&year=&lang=
 *
 * 时间线只回标题，但它同样是**内容**：core 的 `AggregateController.getTimeline`
 * （v12.10.0）接收 `@Lang()`，命中译文时用 `translateTitleWithMeta` 逐条替换
 * posts / notes 的标题。不传 `lang` 就会在英文界面里列出一整屏中文标题。
 */
export async function getTimeline(
  options: {
    type?: V2TimelineType
    year?: number
    sort?: 1 | -1
    lang?: string
  } = {},
): Promise<{
  articles: ReturnType<typeof toTimeline>['articles']
  diaries: ReturnType<typeof toTimeline>['diaries']
}> {
  const body = await requestV2<unknown>('/aggregate/timeline', {
    query: { type: options.type, year: options.year, sort: options.sort ?? -1, lang: options.lang },
    revalidate: 300,
    tags: ['timeline'],
  })
  return toTimeline(expectObject<V2TimelineBody>(body, '/aggregate/timeline'))
}

/** GET /links/all 的全部友链（不过滤状态）。同一次渲染里两个调用方共用一次请求。 */
async function fetchFriendLinks(): Promise<FriendLink[]> {
  const body = await requestV2<unknown>('/links/all', { revalidate: 600, tags: ['links'] })
  return unwrapListBody<V2LinkRow>(body, '/links/all').map(toFriendLink)
}

/**
 * GET /links/all —— 只取已通过审核（LinkState.Pass = 0）且未被隐藏的友链。
 *
 * ⚠️ 语义易错：core 的 LinkState 是 0=已通过 / 1=审核中 / 2=已过期 / 3=已屏蔽 / 4=已拒绝，
 * 不是「1 表示通过」。
 */
export async function listFriendLinks(): Promise<FriendLink[]> {
  const links = await fetchFriendLinks()
  return links.filter((link) => link.state === 0 && !link.hidden)
}

/**
 * 已过期（LinkState.Expired = 2）且未被隐藏的友链。
 *
 * `/friends` 把它们当作信封之外的单开一类列在下方，所以与 `listFriendLinks` 分开取；
 * 审核中、已屏蔽、已拒绝三类仍然不展示。
 */
export async function listExpiredFriendLinks(): Promise<FriendLink[]> {
  const links = await fetchFriendLinks()
  return links.filter((link) => link.state === 2 && !link.hidden)
}

/** GET /links/audit — 申请入口是否开放 */
export async function getFriendLinkApplicationCapability(): Promise<{ canApply: boolean }> {
  const body = expectObject<V2LinkAuditCapability>(
    await requestV2<unknown>('/links/audit', { revalidate: 0 }),
    '/links/audit',
  )
  if (typeof body.can !== 'boolean') {
    throw new ApiError('响应缺少布尔型 can 字段', {
      status: 200,
      path: '/links/audit',
      body,
    })
  }
  return { canApply: body.can }
}

/** POST /links/audit — 申请由 Core 再次按当前站点配置校验 */
export async function applyForFriendLink(input: FriendLinkApplicationInput): Promise<void> {
  const payload: V2LinkApplicationInput = {
    author: input.author,
    name: input.name,
    url: input.url,
    avatar: input.avatar,
    description: input.description,
    email: input.email,
  }
  await postV2<unknown>('/links/audit', payload)
}
