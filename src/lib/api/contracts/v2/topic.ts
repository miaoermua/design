/**
 * 日记专栏（topic）契约
 *
 * 来源：Mix Space Core `modules/topic`。`GET /topics/all` 返回 `{ data: [...] }`，
 * 用于顶栏「日记 → 专栏」选择器；按专栏取日记走 `GET /notes/topics/:id`（只接受 entity id）。
 */
export interface V2TopicRow {
  id: string
  name: string
  slug: string
  description?: string | null
  introduce?: string | null
  icon?: string | null
  created_at: string
}
