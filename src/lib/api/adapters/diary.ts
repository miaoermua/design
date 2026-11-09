import type { V2NoteRow } from '../contracts/v2/note'
import type { Diary, DiaryTopic } from '../domain/diary'
import { readField, readNumber, readString, stringOrNull, toAttachments } from './common'

function toTopic(row: V2NoteRow): DiaryTopic | null {
  const topic = row.topic
  if (!topic || typeof topic.name !== 'string') return null
  return { id: String(topic.id ?? ''), name: topic.name }
}

export function toDiary(row: V2NoteRow): Diary {
  const text = stringOrNull(row.text)
  const content = stringOrNull(row.content)
  const format = readString(row, 'content_format', 'contentFormat')
  const body = format === 'lexical' ? (content ?? text ?? '') : (text ?? content ?? '')

  return {
    id: String(row.id),
    nid: typeof row.nid === 'number' ? row.nid : 0,
    title: row.title,
    slug: stringOrNull(row.slug),
    content: body,
    contentFormat: format ?? 'markdown',
    // 实测 public_at 大量为 null：没有公开时间就用创建时间，不编造第三个时间
    publishedAt:
      readString(row, 'public_at', 'publicAt') ?? readString(row, 'created_at', 'createdAt') ?? '',
    modifiedAt: readString(row, 'modified_at', 'modifiedAt'),
    mood: stringOrNull(row.mood),
    weather: stringOrNull(row.weather),
    location: stringOrNull(row.location),
    bookmark: Boolean(row.bookmark),
    hasPassword: Boolean(readField(row, 'has_password', 'hasPassword')),
    topic: toTopic(row),
    images: toAttachments(row.images),
    readCount: readNumber(row, 'read_count', 'readCount'),
    likeCount: readNumber(row, 'like_count', 'likeCount'),
  }
}
