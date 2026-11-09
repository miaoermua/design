/**
 * Mix Space API v2 — 日记契约
 *
 * 来源：线上实测（/notes、/notes/:id、/aggregate/timeline）
 *
 *   实测字段：id / nid / title / slug / text / content / content_format / images / meta
 *             is_published / has_password / public_at / mood / weather / bookmark
 *             coordinates / location / read_count / like_count / topic_id
 *             created_at / modified_at / topic
 *
 *   ⚠️ slug 实测可以为 null（并非所有日记都有 slug）。
 *   ⚠️ public_at 可以为 null，此时以 created_at 作为展示时间。
 *   ⚠️ 受密码保护时详情接口返回 403 + code 14000，或 text 为空。
 */

import type { EntityId, IsoDateString, V2Image } from './common'

export interface V2NoteTopic {
  id: EntityId
  name: string
  slug?: string | null
  icon?: string | null
}

export interface V2NoteRow {
  id: EntityId
  /** 自增序号，用于 /notes/nid/:nid */
  nid: number
  title: string
  slug?: string | null
  /** Markdown / 纯文本正文（受密码保护时为空） */
  text?: string | null
  content?: string | null
  content_format?: string
  images?: V2Image[] | null
  meta?: Record<string, unknown> | null
  is_published?: boolean
  has_password?: boolean
  public_at?: IsoDateString | null
  mood?: string | null
  weather?: string | null
  bookmark?: boolean
  coordinates?: { latitude: number; longitude: number } | null
  location?: string | null
  read_count?: number
  like_count?: number
  topic_id?: EntityId | null
  topic?: V2NoteTopic | null
  created_at: IsoDateString
  modified_at?: IsoDateString | null
}

export interface V2NoteDetail extends V2NoteRow {
  liked?: boolean | null
}
