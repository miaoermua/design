/**
 * 活动 / 房间（presence）
 *
 * 为什么用 REST 而不是实时事件：core 的房间人数**没有**任何推送通道——
 * `VISITOR_ONLINE` 只带全站人数，房间维度只能从 `/activity/rooms` 读。
 * 于是这里把它当成一个「按需读取的只读快照」，不订阅、不轮询到主题里。
 *
 * 代价必须写清楚：这个端点内部会 `fetchSockets()` 拉全集群连接再逐房间分桶，
 * 并为每个房间回查内容标题（一次 DB）。所以：
 *   - 不缓存（`revalidate: 0`），否则人数是上一次的；
 *   - 只允许在「用户真的把鼠标停在在线状态上」时才调用（见 `features/presence`），
 *     不做首屏预取、不做后台轮询。
 */

import { toPresenceRooms } from '../adapters/presence'
import { requestV2 } from '../client/http'
import type { PresenceRoom } from '../domain/presence'

/**
 * `GET /activity/rooms`
 *
 * - 路径是**单数** `activity`：`/activities/rooms` 在 v12.10.0 上返回 404；
 * - `lang` 交给 core 的译文服务，与其它列表接口一致（不传则回原文标题）。
 */
export async function getActivityRooms(options: { lang?: string } = {}): Promise<PresenceRoom[]> {
  const body = await requestV2<unknown>('/activity/rooms', {
    query: { lang: options.lang },
    revalidate: 0,
  })
  return toPresenceRooms(body)
}
