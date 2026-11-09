import type { V2Aggregate, V2TimelineBody } from '../contracts/v2/site'
import type { SiteIdentity } from '../domain/taxonomy'
import { readField, stringArray, stringOrNull } from './common'
import { toArticle } from './article'
import { toDiary } from './diary'

/** 从 social_ids 里剔除空值：'{ github: undefined }' 不该出现在 UI 数据里 */
function toSocialIds(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalized = stringOrNull(raw)
    if (normalized) result[key] = normalized
  }
  return result
}

/** latest_note_id 实测是 { id, nid } 对象；兼容旧部署的裸字符串 */
function toLatestNoteId(value: unknown): string | null {
  if (typeof value === 'string') return stringOrNull(value)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return stringOrNull(record.id)
  }
  return null
}

export function toSiteIdentity(aggregate: V2Aggregate): SiteIdentity {
  const seo = aggregate.seo
  const owner = aggregate.user
  const commentOptions = aggregate.comment_options

  return {
    title: stringOrNull(seo?.title) ?? stringOrNull(owner?.name),
    description: stringOrNull(seo?.description) ?? stringOrNull(owner?.introduce),
    keywords: stringArray(seo?.keywords),
    icon: stringOrNull(seo?.icon),
    siteUrl: stringOrNull(readField(aggregate.url ?? {}, 'web_url', 'webUrl')),
    owner: {
      name: stringOrNull(owner?.name),
      introduce: stringOrNull(owner?.introduce),
      avatar: stringOrNull(owner?.avatar),
      socialIds: toSocialIds(readField(owner ?? {}, 'social_ids', 'socialIds')),
    },
    commentsEnabled: readField(commentOptions ?? {}, 'disable_comment', 'disableComment') !== true,
    latestDiaryId: toLatestNoteId(readField(aggregate, 'latest_note_id', 'latestNoteId')),
  }
}

/** 时间线：`{ data: { posts, notes } }` */
export function toTimeline(body: V2TimelineBody) {
  return {
    articles: Array.isArray(body.data?.posts) ? body.data.posts.map(toArticle) : [],
    diaries: Array.isArray(body.data?.notes) ? body.data.notes.map(toDiary) : [],
  }
}
