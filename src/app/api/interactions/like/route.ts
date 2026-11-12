import { NextResponse } from 'next/server'
import { likeRecord } from '@/lib/api'
import { isSafeId } from '@/lib/realtime/protocol'

/**
 * POST /api/interactions/like —— 点赞（Blog / Note 共用）
 *
 * 浏览器不直连后端：后端地址与 UA 只在服务端，这是主题一贯的网络边界。
 * 请求体只接受 `{ id, type }`，两个字段都按保守字符集校验后再转发。
 *
 * 成功只代表「请求被接受」：core 按 IP 计数，同 IP 重复点赞仍是成功，
 * 所以这里不返回计数，避免把「接受」说成「+1」。
 */

export const dynamic = 'force-dynamic'

const TYPES = new Set(['Post', 'Note'])

interface LikeBody {
  id: string
  type: 'Post' | 'Note'
}

function parseBody(value: unknown): LikeBody | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const { id, type } = record
  if (!isSafeId(id)) return null
  if (typeof type !== 'string' || !TYPES.has(type)) return null
  return { id, type: type as LikeBody['type'] }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 })
  }

  const input = parseBody(payload)
  if (!input) return NextResponse.json({ status: 'invalid' }, { status: 400 })

  try {
    await likeRecord(input)
    return NextResponse.json({ status: 'ok' })
  } catch {
    // 不把上游错误体、URL 或栈返回给浏览器
    return NextResponse.json({ status: 'error' }, { status: 502 })
  }
}
