/**
 * 评论表单的字段约束
 *
 * 数值来自 core v12 的 `CommentSchema`（`comment.schema.ts:45-66`），
 * 但**复制到这里而不是引用后端**：主题不能假设部署方永远用 v12，
 * 也不能在 Core 改上限时静默失配。写在同一处，表单与服务端路由共用。
 */

import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'

export const COMMENT_LIMITS = {
  author: 20,
  text: 500,
  mail: 50,
  url: 50,
} as const

export interface CommentDraft {
  author: string
  text: string
  mail: string
  /** 可选；留空表示不填 */
  url: string
}

export type CommentField = keyof CommentDraft

export type CommentValidation =
  | { ok: true; value: { author: string; text: string; mail: string; url?: string } }
  | { ok: false; field: CommentField; message: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 校验一条评论草稿。
 *
 * 与 core 的规则一一对应，但**不做过度限制**：不做敏感词、不做频率判断，
 * 那些属于后端策略；前端只保证「发出去不会被 422 打回来」。
 */
export function validateCommentDraft(
  input: unknown,
  locale: Locale = DEFAULT_LOCALE,
): CommentValidation {
  if (!input || typeof input !== 'object') {
    return { ok: false, field: 'text', message: t(locale, 'comments.invalidText') }
  }

  const record = input as Record<string, unknown>
  const author = text(record.author)
  const body = text(record.text)
  const mail = text(record.mail)
  const url = text(record.url)

  if (!author) return { ok: false, field: 'author', message: t(locale, 'comments.invalidAuthor') }
  if (author.length > COMMENT_LIMITS.author) {
    return {
      ok: false,
      field: 'author',
      message: tf(locale, 'comments.invalidAuthorLength', { count: COMMENT_LIMITS.author }),
    }
  }

  if (!mail) return { ok: false, field: 'mail', message: t(locale, 'comments.invalidMail') }
  if (mail.length > COMMENT_LIMITS.mail || !EMAIL.test(mail)) {
    return { ok: false, field: 'mail', message: t(locale, 'comments.invalidMailFormat') }
  }

  if (url) {
    if (url.length > COMMENT_LIMITS.url || !isHttpUrl(url)) {
      return { ok: false, field: 'url', message: t(locale, 'comments.invalidUrl') }
    }
  }

  if (!body) return { ok: false, field: 'text', message: t(locale, 'comments.invalidBody') }
  if (body.length > COMMENT_LIMITS.text) {
    return {
      ok: false,
      field: 'text',
      message: tf(locale, 'comments.invalidBodyLength', { count: COMMENT_LIMITS.text }),
    }
  }

  return {
    ok: true,
    value: { author, text: body, mail, ...(url ? { url } : {}) },
  }
}
