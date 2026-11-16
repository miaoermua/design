import type { EntityId, IsoDateString, V2Paginated } from './common'

/** GET /api/v2/says — 一言条目 */
export interface V2Say {
  id: EntityId
  text: string
  source: string
  author: string
  created_at: IsoDateString
}

export type V2SayList = V2Paginated<V2Say>
