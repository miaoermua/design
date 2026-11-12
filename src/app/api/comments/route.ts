import { NextResponse } from 'next/server'
import { createGuestComment, listComments, type CommentSort } from '@/lib/api'
import { isFeatureEnabled } from '@/core/registry/features'
import { toCommentFailureReason } from '@/features/comments/errors'
import { validateCommentDraft } from '@/features/comments/validation'
import { isSafeId } from '@/lib/realtime/protocol'

/**
 * /api/comments —— 评论的读取与匿名提交
 *
 * 浏览器不直连 Core：后端地址、UA、错误体都只留在服务端（与 /api/search、
 * /api/interactions/* 保持同一条网络边界）。
 *
 *   GET  ?refId=&page=&size=&sort=   「加载更多」用
 *   POST { refId, author, text, mail, url? }  匿名发表
 *
 * 返回给浏览器的只有枚举化的失败原因，不含上游 message。
 */

export const dynamic = 'force-dynamic'

const SORTS = new Set<CommentSort>(['pinned', 'newest', 'oldest'])

function disabledResponse() {
  return NextResponse.json({ status: 'error', reason: 'disabled' }, { status: 403 })
}

export async function GET(request: Request) {
  if (!isFeatureEnabled('comments')) return disabledResponse()

  const { searchParams } = new URL(request.url)
  const refId = searchParams.get('refId')
  if (!isSafeId(refId)) {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  const page = Number(searchParams.get('page') ?? '1')
  const size = Number(searchParams.get('size') ?? '20')
  const sortParam = searchParams.get('sort')
  const sort: CommentSort =
    sortParam && SORTS.has(sortParam as CommentSort) ? (sortParam as CommentSort) : 'pinned'

  try {
    const result = await listComments(refId, {
      page: Number.isFinite(page) ? page : 1,
      size: Number.isFinite(size) ? size : 20,
      sort,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ status: 'error', reason: 'network' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!isFeatureEnabled('comments')) return disabledResponse()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  const record = (payload ?? {}) as Record<string, unknown>
  const refId = record.refId
  if (!isSafeId(refId)) {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  const draft = validateCommentDraft(record)
  if (!draft.ok) {
    return NextResponse.json(
      { status: 'error', reason: 'invalid', field: draft.field, message: draft.message },
      { status: 400 },
    )
  }

  try {
    await createGuestComment(refId, draft.value)
    // 只承诺「已提交」：审核与否由 Core 的策略决定，前端无从得知，也不该猜
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    const reason = toCommentFailureReason(error)
    return NextResponse.json(
      { status: 'error', reason },
      { status: reason === 'network' ? 502 : 400 },
    )
  }
}
