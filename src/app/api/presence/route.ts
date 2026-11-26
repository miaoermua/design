import { NextResponse } from 'next/server'
import { toPresenceEntries } from '@/features/presence/entries'
import { getActivityRooms } from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/server'
import { isRealtimeEnabled } from '@/lib/realtime/config'

/**
 * GET /api/presence —— 页脚「谁在读」预览的数据源
 *
 * 为什么需要这一层：
 * - 浏览器不直连后端（后端地址、UA、语言只在服务端），这是全站既有边界；
 * - 上游的房间键名是 snake_case 之后的 `article_<id>`，把它和路由拼接放在
 *   客户端会把两个知识各存一份（见 `lib/api/contracts/v2/activity.ts`）；
 * - 失败必须是**静默降级**：页脚是装饰，一次 5xx 不该影响阅读。
 *
 * 语义边界（写在这里是为了让调用方别误解）：
 * - `entries[].viewers` 是那个房间的**连接数**（core 按 socket 计，含当前访客），
 *   与 `VISITOR_ONLINE` 的全站人数不是一个口径，前端文案不能混。
 * - 这里不返回 IP / sessionId / 设备：上游本来也没给，主题不猜。
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  // 人数每次都要现算，任何一层缓存都会把「正在看」变成「刚才在看」
  const headers = { 'cache-control': 'no-store' }

  // 实时能力关闭（未配置后端 / mock / MX_REALTIME=off）时没有房间可言
  if (!isRealtimeEnabled()) return NextResponse.json({ entries: [] }, { headers })

  const locale = await getLocale()

  try {
    const rooms = await getActivityRooms({ lang: toContentLang(locale) })
    return NextResponse.json({ entries: toPresenceEntries(rooms) }, { headers })
  } catch {
    // 失败只需要让浮层说一句「暂时不可用」，堆栈留给服务端日志
    return NextResponse.json({ entries: [], failed: true }, { headers })
  }
}
