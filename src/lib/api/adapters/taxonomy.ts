import type { V2CategoryRow, V2LinkRow, V2TagSum } from '../contracts/v2'
import type { V2SearchResultItem } from '../contracts/v2/content'
import type { Category, FriendLink, SearchHit, Tag } from '../domain/taxonomy'
import { numberOrNull, readString, stringOrNull } from './common'

export function toCategory(row: V2CategoryRow): Category {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    count: numberOrNull(row.count),
  }
}

export function toTag(row: V2TagSum): Tag {
  return { name: row.name, count: numberOrNull(row.count) }
}

export function toFriendLink(row: V2LinkRow): FriendLink {
  return {
    id: String(row.id),
    name: stringOrNull(row.name) ?? row.url,
    url: row.url,
    avatar: stringOrNull(row.avatar),
    description: stringOrNull(row.description),
    state: typeof row.state === 'number' ? row.state : 0,
    hidden: row.hide === true,
  }
}

export function toSearchHit(row: V2SearchResultItem): SearchHit {
  const kind = row.type === 'post' ? 'post' : 'note'
  return {
    id: String(row.id),
    kind,
    // 标题用原始字段：highlight.title 可能带 <mark>，标题里不应该出现标记文本
    title: row.title,
    nid: typeof row.nid === 'number' ? row.nid : null,
    slug: stringOrNull(row.slug),
    snippet: stringOrNull(row.highlight?.snippet),
    categorySlug: stringOrNull(row.category?.slug),
    categoryName: stringOrNull(row.category?.name),
    createdAt: readString(row, 'created_at', 'createdAt') ?? new Date(0).toISOString(),
  }
}
