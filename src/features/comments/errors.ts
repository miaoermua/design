import { ApiError } from '@/lib/api'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t, type MessageKey } from '@/lib/i18n/dictionary'

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

/** 失败原因 → 字典键。文案不写在这里：这里只保证「原因」与「界面文案」一一对应 */
const MESSAGE_KEY: Record<CommentFailureReason, MessageKey> = {
  disabled: 'comments.errorDisabled',
  'guest-blocked': 'comments.errorGuestBlocked',
  'content-missing': 'comments.errorContentMissing',
  duplicate: 'comments.errorDuplicate',
  invalid: 'comments.errorInvalid',
  unauthorized: 'comments.errorUnauthorized',
  network: 'comments.errorNetwork',
}

export function commentFailureMessage(
  reason: CommentFailureReason,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return t(locale, MESSAGE_KEY[reason])
}
