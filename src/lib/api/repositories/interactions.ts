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

/**
 * `GET /like_this` —— 站点总「喜欢」数
 *
 * core 把它存在 config 的 `like` 选项里（`ConfigsService.getOptionValue`），
 * 返回的是一个裸数字而不是对象。取不到时返回 null：
 * 计数是附加信息，缺失就不显示，不伪造 0。
 */
export async function getSiteLikeCount(): Promise<number | null> {
  try {
    const body = await requestV2<unknown>('/like_this', { revalidate: 0 })
    return typeof body === 'number' && Number.isFinite(body) ? body : null
  } catch {
    return null
  }
}

/**
 * `POST /like_this` —— 喜欢本站
 *
 * core 用 Redis 按 IP 做「一天一次」的限制：重复提交会抛 400
 * 「Once a day is enough」。因此调用方要把 400 与网络错误区分开，
 * 前者是「今天已经赞过」，不是失败。
 */
export async function likeSite(): Promise<void> {
  await postV2<unknown>('/like_this', {})
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
