import { NextResponse } from 'next/server'
import { likeSite } from '@/lib/api'
import { isFeatureEnabled } from '@/core/registry/features'

/**
 * POST /api/interactions/like-site —— 喜欢本站
 *
 * core 的 `/like_this` 用 Redis 按 IP 限制「一天一次」，重复提交返回
 * 400 `Once a day is enough`。这里把它翻译成稳定的 `already` 语义，
 * 让界面能区分「今天已经赞过」和「真的失败了」——前者不该弹红色错误。
 *
 * 浏览器不直连后端，后端地址与 UA 仍然只留在服务端。
 */

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!isFeatureEnabled('interactions')) {
    return NextResponse.json({ status: 'disabled' }, { status: 403 })
  }

  try {
    await likeSite()
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    // core 用 400 表达「今天已经赞过」；网络异常则不是 400
    const status =
      typeof error === 'object' && error !== null
        ? (error as { status?: number }).status
        : undefined
    if (status === 400) {
      return NextResponse.json({ status: 'already' }, { status: 200 })
    }
    return NextResponse.json({ status: 'error' }, { status: 502 })
  }
}
