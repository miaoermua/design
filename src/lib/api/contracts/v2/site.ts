/**
 * Mix Space API v2 — 站点/聚合契约
 *
 * 来源：线上实测（/aggregate、/aggregate/timeline）
 *
 *   GET /aggregate → 原样对象：
 *     {
 *       user: { id, name, username, introduce, avatar, social_ids, ... },
 *       seo: { title, description, icon, icon_dark, keywords },
 *       url: { ws_url, server_url, web_url },
 *       comment_options: { disable_comment, allow_guest_comment },
 *       latest_note_id: { id, nid } | null,
 *       ai: { enable_summary }
 *     }
 *
 *   ⚠️ 实测 latest_note_id 是对象 { id, nid }，不是字符串。
 *   ⚠️ 实测 URL 字段是 snake_case：web_url / server_url / ws_url。
 *
 *   GET /aggregate/timeline?year= → { data: { posts: PostRow[], notes: NoteRow[] } }
 */

import type { EntityId, IsoDateString } from './common'
import type { V2NoteRow } from './note'
import type { V2PostRow } from './post'

export interface V2Owner {
  id?: EntityId
  name: string
  username?: string
  introduce?: string | null
  avatar?: string | null
  url?: string | null
  /** 实测键名：social_ids */
  social_ids?: Record<string, string | undefined> | null
  [key: string]: unknown
}

export interface V2Seo {
  title?: string
  description?: string
  /** 实测空字符串表示未配置 */
  icon?: string | null
  icon_dark?: string | null
  keywords?: string[]
}

export interface V2Url {
  web_url?: string
  server_url?: string
  ws_url?: string
}

export interface V2CommentOptions {
  disable_comment?: boolean
  disableComment?: boolean
  allow_guest_comment?: boolean
  allowGuestComment?: boolean
}

/** 实测 latest_note_id 的对象形状 */
export interface V2LatestNoteRef {
  id: EntityId
  nid: number
}

/**
 * GET /aggregate 的响应
 *
 * ⚠️ 实测（api.miaoer.net，2026-11）**没有** `theme` 字段——该键不存在，
 * 不是 null。主题配置走独立的 Snippet（`GET /snippets/theme/:name`），
 * 不要再往 aggregate 上挂主题配置。
 */
export interface V2Aggregate {
  user?: V2Owner
  seo?: V2Seo
  url?: V2Url
  comment_options?: V2CommentOptions
  latest_note_id?: V2LatestNoteRef | null
  ai?: { enable_summary?: boolean }
}

/** GET /aggregate/site（未在本次实测中使用，字段一律 optional） */
export interface V2SiteInfo {
  title?: string
  description?: string
  keywords?: string[]
  icon?: string
}

/** TimelineType 枚举 */
export enum V2TimelineType {
  Post = 0,
  Note = 1,
}

export interface V2TimelineBody {
  data: {
    posts: V2PostRow[]
    notes: V2NoteRow[]
  }
}

/** 友链（/links/all 实测：created_at、state、hide 等） */
export interface V2LinkRow {
  id: string
  name: string
  url: string
  avatar?: string | null
  description?: string | null
  type?: number
  state: number
  email?: string | null
  hide?: boolean
  created_at?: IsoDateString
}
