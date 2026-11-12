import { describe, expect, it } from 'vitest'
import { ApiError, NetworkError } from '@/lib/api'
import { toCommentItem } from '@/lib/api/adapters/comment'
import type { V2CommentRow } from '@/lib/api/contracts/v2/comment'
import { commentFailureMessage, toCommentFailureReason } from '@/features/comments/errors'
import { COMMENT_LIMITS, validateCommentDraft } from '@/features/comments/validation'

const valid = {
  author: '喵二',
  text: '写得不错',
  mail: 'a@b.co',
  url: 'https://example.com',
}

describe('validateCommentDraft', () => {
  it('接受合法草稿并去掉首尾空白', () => {
    const result = validateCommentDraft({ ...valid, author: '  喵二 ', text: ' 好 ' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ author: '喵二', text: '好', mail: 'a@b.co' })
  })

  it('网址留空时不进入请求体', () => {
    const result = validateCommentDraft({ ...valid, url: '   ' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).not.toHaveProperty('url')
  })

  it('昵称缺失或超长都被挡住，并指明字段', () => {
    expect(validateCommentDraft({ ...valid, author: '' })).toMatchObject({
      ok: false,
      field: 'author',
    })
    expect(
      validateCommentDraft({ ...valid, author: 'x'.repeat(COMMENT_LIMITS.author + 1) }),
    ).toMatchObject({ ok: false, field: 'author' })
  })

  it('邮箱必须填且必须合法', () => {
    expect(validateCommentDraft({ ...valid, mail: '' })).toMatchObject({
      ok: false,
      field: 'mail',
    })
    expect(validateCommentDraft({ ...valid, mail: 'not-an-email' })).toMatchObject({
      ok: false,
      field: 'mail',
    })
  })

  it('网址只接受 http(s)，拒绝 javascript:', () => {
    expect(validateCommentDraft({ ...valid, url: 'javascript:alert(1)' })).toMatchObject({
      ok: false,
      field: 'url',
    })
    expect(validateCommentDraft({ ...valid, url: 'ftp://example.com' })).toMatchObject({
      ok: false,
      field: 'url',
    })
  })

  it('正文必填且不超过 500 字', () => {
    expect(validateCommentDraft({ ...valid, text: '   ' })).toMatchObject({
      ok: false,
      field: 'text',
    })
    expect(
      validateCommentDraft({ ...valid, text: 'x'.repeat(COMMENT_LIMITS.text + 1) }),
    ).toMatchObject({ ok: false, field: 'text' })
  })

  it('非对象输入不抛异常', () => {
    expect(validateCommentDraft(null)).toMatchObject({ ok: false })
    expect(validateCommentDraft('x')).toMatchObject({ ok: false })
  })
})

describe('toCommentFailureReason', () => {
  const apiError = (status: number, code: number | null, message = 'upstream') =>
    new ApiError(message, { status, code, path: '/comments/guest/x' })

  it('把 core 的业务码映射成具体原因', () => {
    expect(toCommentFailureReason(apiError(403, 30000))).toBe('disabled')
    expect(toCommentFailureReason(apiError(403, 14005))).toBe('guest-blocked')
    expect(toCommentFailureReason(apiError(400, 16003))).toBe('content-missing')
    expect(toCommentFailureReason(apiError(422, null))).toBe('invalid')
  })

  it('401 不等于「请去登录」：本站没有读者登录，归到单独的 unauthorized', () => {
    expect(toCommentFailureReason(apiError(401, null))).toBe('unauthorized')
    // 文案不能暗示读者点一下就能解决
    expect(commentFailureMessage('unauthorized')).not.toContain('登录')
  })

  it('幂等窗口的重复提交单独识别', () => {
    expect(toCommentFailureReason(apiError(400, null, 'Whoops, you already said this'))).toBe(
      'duplicate',
    )
  })

  it('网络错误与未知错误都归到 network，不泄露上游 message', () => {
    expect(toCommentFailureReason(new NetworkError('boom', { path: '/comments' }))).toBe('network')
    expect(toCommentFailureReason(apiError(500, null))).toBe('network')
    expect(toCommentFailureReason(new Error('random'))).toBe('network')
  })
})

describe('toCommentItem', () => {
  const row: V2CommentRow = {
    id: '147657505176567833',
    text: '你好',
    author: '时雨',
    avatar: 'https://cravatar.cn/avatar/x',
    url: null,
    created_at: '2023-07-02T07:36:10.107Z',
    pin: true,
    reply_count: 5,
    parent_comment_id: null,
    // 下面两个字段线上确实存在，必须被丢弃
    ip: '36.228.218.212',
    agent: 'Mozilla/5.0 (Macintosh)',
    replies: [],
    reply_window: { hidden_count: 2, next_cursor: 'cursor-1' },
  }

  it('不把 ip / agent 带进领域模型', () => {
    const item = toCommentItem(row)

    expect(JSON.stringify(item)).not.toContain('36.228.218.212')
    expect(JSON.stringify(item)).not.toContain('Mozilla')
    expect(item).not.toHaveProperty('ip')
    expect(item).not.toHaveProperty('agent')
  })

  it('读取 reply_window 的隐藏数量与游标（snake_case）', () => {
    const item = toCommentItem(row)

    expect(item.hiddenCount).toBe(2)
    expect(item.nextCursor).toBe('cursor-1')
    expect(item.replyCount).toBe(5)
    expect(item.pinned).toBe(true)
  })

  it('没有窗口信息时用 replyCount 推算隐藏数', () => {
    const item = toCommentItem({ ...row, reply_window: null, reply_count: 3, replies: [] })

    expect(item.hiddenCount).toBe(3)
    expect(item.nextCursor).toBeNull()
  })

  it('头像与主页只放行 http(s)', () => {
    const item = toCommentItem({
      ...row,
      avatar: 'javascript:alert(1)',
      url: 'data:text/html,x',
    })

    expect(item.author.avatar).toBeNull()
    expect(item.author.url).toBeNull()
  })

  it('昵称为空时用固定兜底，不出现 undefined', () => {
    expect(toCommentItem({ ...row, author: '   ' }).author.name).toBe('匿名')
  })
})
