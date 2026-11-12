import { NextResponse } from 'next/server'
import { subscribeEmail } from '@/lib/api'
import type { SubscribeType } from '@/lib/api/contracts/v2/interaction'

/**
 * POST /api/interactions/subscribe —— 邮件订阅
 *
 * 只负责「校验 → 转发」，不解释结果：core 会先发确认邮件，
 * 未确认前不算订阅成功，因此成功响应也只有 `{ status: 'ok' }`。
 */

export const dynamic = 'force-dynamic'

const TYPES: SubscribeType[] = ['post_c', 'note_c']
const EMAIL_MAX = 254
/** 只做形状校验：真正的可达性由确认邮件证明，前端不猜 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SubscribeBody {
  email: string
  types: SubscribeType[]
}

function parseTypes(value: unknown): SubscribeType[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<SubscribeType>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    if (!TYPES.includes(item as SubscribeType)) continue
    seen.add(item as SubscribeType)
  }
  // 顺序固定，便于幂等与日志阅读
  return TYPES.filter((type) => seen.has(type))
}

function parseBody(value: unknown): SubscribeBody | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  const email = typeof record.email === 'string' ? record.email.trim() : ''
  if (!email || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) return null

  const types = parseTypes(record.types)
  if (types.length === 0) return null

  return { email, types }
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
    await subscribeEmail(input.email, input.types)
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 502 })
  }
}
