import { NextResponse } from 'next/server'
import { listThreadReplies } from '@/lib/api'
import { isFeatureEnabled } from '@/core/registry/features'
import { isSafeId } from '@/lib/realtime/protocol'

/**
 * GET /api/comments/thread?rootId=&cursor= —— 长线程中段补页
 *
 * 根评论的 `reply_window.has_hidden` 为真时，页面只拿到首尾几条，
 * 中间部分要点这里。游标原样透传，不猜格式。
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isFeatureEnabled('comments')) {
    return NextResponse.json({ status: 'error', reason: 'disabled' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rootId = searchParams.get('rootId')
  if (!isSafeId(rootId)) {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  try {
    const result = await listThreadReplies(rootId, { cursor: searchParams.get('cursor') })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ status: 'error', reason: 'network' }, { status: 502 })
  }
}
