import { NextResponse } from 'next/server'
import { replyToGuestComment } from '@/lib/api'
import { isFeatureEnabled } from '@/core/registry/features'
import { toCommentFailureReason } from '@/features/comments/errors'
import { validateCommentDraft } from '@/features/comments/validation'
import { getLocale } from '@/lib/i18n/server'
import { isSafeId } from '@/lib/realtime/protocol'

/**
 * POST /api/comments/reply —— 匿名回复某条评论
 *
 * 入参是 `parentId`（被回复的那条评论 id），core 自己会把它归到对应的根评论下，
 * 因此前端不需要关系「回复的第几层」这件事。
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isFeatureEnabled('comments')) {
    return NextResponse.json({ status: 'error', reason: 'disabled' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  const record = (payload ?? {}) as Record<string, unknown>
  const parentId = record.parentId
  if (!isSafeId(parentId)) {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  // 字段级提示是给读者看的：跟随请求方当前语言，不让中文文案漏到英文界面
  const locale = await getLocale()
  const draft = validateCommentDraft(record, locale)
  if (!draft.ok) {
    return NextResponse.json(
      { status: 'error', reason: 'invalid', field: draft.field, message: draft.message },
      { status: 400 },
    )
  }

  try {
    const isWhispers = record.isWhispers === true
    await replyToGuestComment(parentId, { ...draft.value, ...(isWhispers ? { isWhispers: true } : {}) })
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    const reason = toCommentFailureReason(error)
    return NextResponse.json(
      { status: 'error', reason },
      { status: reason === 'network' ? 502 : 400 },
    )
  }
}
