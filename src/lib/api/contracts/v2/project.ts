import type { EntityId, IsoDateString, V2Paginated } from './common'

/** GET /api/v2/projects — 项目条目 */
export interface V2Project {
  id: EntityId
  name: string
  description: string
  preview_url: string | null
  doc_url: string | null
  project_url: string
  images: string[]
  avatar: string | null
  text: string
  created_at: IsoDateString
}

export type V2ProjectList = V2Paginated<V2Project>
