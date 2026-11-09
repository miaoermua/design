import type { V2PostDetail, V2PostRow } from '../contracts/v2/post'
import type { Article, ArticleDetail, ArticleCategoryRef } from '../domain/article'
import {
  readArray,
  readNumber,
  readString,
  stringArray,
  stringOrNull,
  toAttachment,
} from './common'

function toCategoryRef(row: V2PostRow): ArticleCategoryRef | null {
  const category = row.category
  if (!category || typeof category.slug !== 'string' || category.slug.length === 0) return null
  return {
    id: String(category.id ?? ''),
    name: typeof category.name === 'string' ? category.name : category.slug,
    slug: category.slug,
  }
}

/**
 * 正文取值：`text` 是 Markdown，`content` 是 Lexical JSON。
 * 按 content_format 选择权威来源，仅在一个缺失时用另一个兜底。
 */
function pickContent(row: V2PostRow): string {
  const text = stringOrNull(row.text)
  const content = stringOrNull(row.content)
  if (row.content_format === 'lexical') return content ?? text ?? ''
  return text ?? content ?? ''
}

export function toArticle(row: V2PostRow): Article {
  // 实测封面在 meta.cover（字符串 URL）；没有时才退回 images[0]
  const meta = row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : null
  const metaCover = stringOrNull(meta?.cover)
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    summary: stringOrNull(row.summary),
    category: toCategoryRef(row),
    tags: stringArray(row.tags),
    cover: metaCover ? { src: metaCover, kind: 'image' } : toAttachment(row.images?.[0]),
    createdAt: readString(row, 'created_at', 'createdAt') ?? row.created_at,
    modifiedAt: readString(row, 'modified_at', 'modifiedAt'),
    readCount: readNumber(row, 'read_count', 'readCount'),
    likeCount: readNumber(row, 'like_count', 'likeCount'),
    // 实测列表不返回评论数：契约里没有该字段，这里也不造假
    commentCount: null,
    isPinned: Boolean(readString(row, 'pin_at', 'pinAt')),
  }
}

export function toArticleDetail(row: V2PostDetail): ArticleDetail {
  const related = readArray(row, 'related', 'related')
  return {
    ...toArticle(row),
    content: pickContent(row),
    contentFormat: stringOrNull(row.content_format) ?? 'markdown',
    copyright: Boolean(row.copyright),
    related: related.map((item) => toArticle(item as V2PostRow)),
    liked: typeof row.liked === 'boolean' ? row.liked : null,
  }
}
