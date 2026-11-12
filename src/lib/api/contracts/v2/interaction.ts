/**
 * 互动相关契约（点赞 / 订阅）
 *
 * 来源：Mix Space Core `modules/activity`、`modules/subscribe`。
 * 主题不扩展字段，只按官方形状收发。
 */

/** core 的 LikeBodyDto：`type` 是实体名，首字母大写 */
export type LikeRecordType = 'Post' | 'Note'

export interface LikeInput {
  id: string
  type: LikeRecordType
}

/** GET /subscribe/status（core 的 SubscribeStatusDto，snake_case） */
export interface V2SubscribeStatus {
  enable: boolean
  bit_map: Record<string, number>
  allow_bits: number[]
  allow_types: string[]
}

/** core 的 SubscribeType：post_c = 新文章，note_c = 新日记 */
export type SubscribeType = 'post_c' | 'note_c'

export interface SubscribeInput {
  email: string
  types: SubscribeType[]
}
