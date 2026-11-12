import { postV2, requestV2 } from '../client/http'
import type { LikeInput, SubscribeType, V2SubscribeStatus } from '../contracts/v2/interaction'

/**
 * POST /activity/like
 *
 * core 的实现按 IP 计数：同 IP 重复点赞不会继续加数，但仍然返回成功。
 * 因此这里只表示「请求被接受」，不能当作「计数 +1」的证据。
 */
export async function likeRecord(input: LikeInput): Promise<void> {
  await postV2<unknown>('/activity/like', { id: input.id, type: input.type })
}

export interface SubscribeCapability {
  enabled: boolean
  /** core 允许订阅的类型（post_c = 新文章，note_c = 新日记） */
  types: SubscribeType[]
}

const SUBSCRIBE_TYPES: SubscribeType[] = ['post_c', 'note_c']

function isSubscribeType(value: string): value is SubscribeType {
  return (SUBSCRIBE_TYPES as string[]).includes(value)
}

/**
 * 订阅能力探测（GET /subscribe/status）
 *
 * 三种结果必须区分开：
 *   - `enable: false`      → 站点没开订阅，界面不提供入口
 *   - 请求失败             → 能力未知，同样不提供入口（不猜、不降级成假成功）
 *   - `enable: true`       → 按 `allow_types` 过滤出本站真正支持的类型
 */
export async function getSubscribeCapability(): Promise<SubscribeCapability> {
  try {
    const body = await requestV2<V2SubscribeStatus>('/subscribe/status', { revalidate: 300 })
    const allowed = (body.allow_types ?? []).filter(isSubscribeType)
    return { enabled: Boolean(body.enable) && allowed.length > 0, types: allowed }
  } catch {
    return { enabled: false, types: [] }
  }
}

/**
 * POST /subscribe
 *
 * core 会先发确认邮件，未确认前不算订阅成功；主题只能如实提示「确认邮件已发送」。
 */
export async function subscribeEmail(email: string, types: SubscribeType[]): Promise<void> {
  await postV2<unknown>('/subscribe', { email, types })
}
