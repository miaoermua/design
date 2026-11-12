import { ApiError } from '@/lib/api'

/**
 * 评论失败原因
 *
 * 只在**前后端之间**传这几个枚举值，不传上游 message：
 * Core 的错误文案是英文、且可能带内部细节，不该出现在页面上。
 */
export type CommentFailureReason =
  | 'disabled'
  | 'guest-blocked'
  | 'content-missing'
  | 'duplicate'
  | 'invalid'
  | 'unauthorized'
  | 'network'

/** core 的业务码（`apps/core/src/constants/error-code.constant.ts`） */
const CODE_DISABLED = 30000
const CODE_FORBIDDEN = 14005
const CODE_POST_MISSING = 16003

/**
 * 把后台错误收敛成可展示的原因
 *
 * 特别注意：**不从 `state` 推断审核**。`state` 是收件箱读态，
 * 与「是否要审核」无关；提交成功统一说「已提交」，不承诺已发布或待审核。
 */
export function toCommentFailureReason(error: unknown): CommentFailureReason {
  if (!(error instanceof ApiError)) return 'network'

  const code = typeof error.code === 'number' ? error.code : null
  if (code === CODE_DISABLED) return 'disabled'
  if (code === CODE_FORBIDDEN) return 'guest-blocked'
  if (code === CODE_POST_MISSING) return 'content-missing'
  if (error.status === 422) return 'invalid'
  // 401 是「服务端没拿到可用凭据」而不是「读者该去登录」：
  // 本站不提供读者登录，文案不能暗示读者点一下就能解决。
  if (error.status === 401) return 'unauthorized'
  // 幂等窗口（20 秒）内重复提交时 core 返回 400 + 这句固定文案
  if (/already said this/i.test(error.message)) return 'duplicate'

  return 'network'
}

const MESSAGES: Record<CommentFailureReason, string> = {
  disabled: '本站已关闭评论',
  'guest-blocked': '本站当前不接受匿名评论',
  'content-missing': '内容不存在，无法评论',
  duplicate: '同样的内容刚刚已经提交过了',
  invalid: '提交内容不符合要求，请检查昵称、邮箱与正文',
  unauthorized: '本站暂时无法接收评论，请稍后再试',
  network: '提交失败，请稍后再试',
}

export function commentFailureMessage(reason: CommentFailureReason): string {
  return MESSAGES[reason]
}
