'use client'

import { useId, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocale } from '@/lib/i18n/client'
import { t, tf } from '@/lib/i18n/dictionary'
import { commentFailureMessage, type CommentFailureReason } from '../errors'
import { COMMENT_LIMITS, validateCommentDraft, type CommentField } from '../validation'

interface CommentComposerProps {
  /** 发根评论时用 refId；回复时用 parentId */
  refId?: string
  parentId?: string
  /** 回复对象的名字，仅用于把「回给谁」写清楚 */
  replyTo?: string
  onSuccess: () => void
  onCancel?: () => void
  variant?: 'root' | 'reply'
}

interface Draft {
  author: string
  mail: string
  url: string
}

const IDENTITY_KEY = 'folio-comment-identity'

/** 记住的身份串（原始 JSON）；空串 = 没有记住过 */
function readIdentity(): string {
  try {
    return window.localStorage.getItem(IDENTITY_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 服务端读不到 localStorage：固定空串，保证水合与服务端输出一致 */
function readServerIdentity(): string {
  return ''
}

function subscribeIdentity(onChange: () => void): () => void {
  // 同标签页内的写入不会触发 storage 事件，但本地写入已经落在 draft 覆盖值上，
  // 这里只负责跨标签页的同步。
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

const EMPTY_IDENTITY = { author: '', url: '' }

function parseIdentity(raw: string): { author: string; url: string } {
  if (!raw) return EMPTY_IDENTITY
  try {
    const parsed = JSON.parse(raw) as Partial<Draft>
    return {
      author: typeof parsed.author === 'string' ? parsed.author : '',
      // 旧版本可能存过邮箱：不再回填
      url: typeof parsed.url === 'string' ? parsed.url : '',
    }
  } catch {
    return EMPTY_IDENTITY
  }
}

/**
 * 匿名评论表单（发评论与回复共用）
 *
 * 设计取舍：
 *   - 只把**昵称和网址**记进 localStorage。邮箱属于个人信息，为了少打几个字
 *     就长期留在浏览器里不划算，也超出「表单便捷」的正当范围；旧版本存过的
 *     `mail` 字段会在下次成功提交时被自然覆盖掉。
 *   - 提交按钮进入 pending 后直接挡住重复点击：Core 的幂等窗口是 20 秒，
 *     「没反应再点一次」只会换来一句「同样的内容刚刚已经提交过了」。
 *   - 前端校验直接复用服务端那份 `validateCommentDraft`（同一处规则），
 *     只为了即时反馈；Core 仍然是最终判定方。
 *   - 成功文案只说「评论已提交」。审核状态在公开接口里不存在，前端不猜。
 */
export function CommentComposer({
  refId,
  parentId,
  replyTo,
  onSuccess,
  onCancel,
  variant = 'root',
}: CommentComposerProps) {
  const locale = useLocale()
  // 记住的昵称/网址只在客户端存在：用 useSyncExternalStore 读取，
  // 服务端快照是空串，水合时与服务端输出一致。
  const storedIdentity = useSyncExternalStore(subscribeIdentity, readIdentity, readServerIdentity)
  const identity = useMemo(() => parseIdentity(storedIdentity), [storedIdentity])

  // 输入框的初始值由已记住的身份派生；用户只要动过输入框，就切到本地覆盖值。
  const [editedDraft, setEditedDraft] = useState<Draft | null>(null)
  const draft: Draft = editedDraft ?? {
    author: identity.author,
    mail: '',
    url: identity.url,
  }
  const setDraft = setEditedDraft

  const [text, setText] = useState('')
  const [isWhispers, setIsWhispers] = useState(false)
  const [pending, setPending] = useState(false)
  const [invalidField, setInvalidField] = useState<CommentField | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const messageId = useId()
  const whisperHintId = useId()
  const compact = variant === 'reply'
  const hasText = text.trim().length > 0

  function remember(next: Draft) {
    try {
      window.localStorage.setItem(
        IDENTITY_KEY,
        JSON.stringify({ author: next.author, url: next.url }),
      )
    } catch {
      // 隐私模式下可能写不进去，忽略
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const checked = validateCommentDraft({ ...draft, text }, locale)
    if (!checked.ok) {
      setInvalidField(checked.field)
      setMessage({ kind: 'error', text: checked.message })
      return
    }

    setInvalidField(null)
    setPending(true)
    setMessage(null)

    const endpoint = parentId ? '/api/comments/reply' : '/api/comments'
    const payload = parentId
      ? { parentId, ...checked.value, ...(isWhispers ? { isWhispers: true } : {}) }
      : { refId, ...checked.value, ...(isWhispers ? { isWhispers: true } : {}) }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as {
        status?: string
        reason?: CommentFailureReason
        message?: string
        field?: CommentField
      }

      if (result.status === 'ok') {
        remember(draft)
        setText('')
        setIsWhispers(false)
        setMessage({ kind: 'ok', text: t(locale, 'comments.submitted') })
        onSuccess()
        return
      }

      setInvalidField(result.field ?? null)
      setMessage({
        kind: 'error',
        // 服务端把字段级提示算好了（与 core 的约束同源），有就直接用
        text:
          result.message ??
          (result.reason
            ? commentFailureMessage(result.reason, locale)
            : t(locale, 'comments.submitFailed')),
      })
    } catch {
      setMessage({ kind: 'error', text: t(locale, 'comments.networkFailed') })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className={compact ? 'comment-composer comment-composer--reply' : 'comment-composer'}
      aria-label={
        compact
          ? tf(locale, 'comments.replyLabel', { name: replyTo ?? '' })
          : t(locale, 'comments.composerLabel')
      }
    >
      {compact ? (
        <div className="comment-composer__head">
          <p className="comment-composer__title">
            {replyTo
              ? tf(locale, 'comments.replyTo', { name: replyTo })
              : t(locale, 'comments.reply')}
          </p>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="comment-composer__cancel">
              {t(locale, 'comments.cancelReply')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="comment-composer__fields">
        <label className="comment-composer__field">
          <span className="sr-only">{t(locale, 'comments.name')}</span>
          <input
            value={draft.author}
            onChange={(event) => setDraft({ ...draft, author: event.target.value })}
            placeholder={`${t(locale, 'comments.name')} *`}
            maxLength={COMMENT_LIMITS.author}
            required
            autoComplete="nickname"
            aria-invalid={invalidField === 'author' || undefined}
            aria-describedby={invalidField === 'author' ? messageId : undefined}
            className="comment-composer__input"
          />
        </label>

        <label className="comment-composer__field">
          <span className="sr-only">{t(locale, 'comments.mail')}</span>
          <input
            value={draft.mail}
            onChange={(event) => setDraft({ ...draft, mail: event.target.value })}
            placeholder={`${t(locale, 'comments.mail')} *`}
            type="email"
            maxLength={COMMENT_LIMITS.mail}
            required
            autoComplete="email"
            aria-invalid={invalidField === 'mail' || undefined}
            aria-describedby={invalidField === 'mail' ? messageId : undefined}
            className="comment-composer__input"
          />
        </label>

        <label className="comment-composer__field">
          <span className="sr-only">{t(locale, 'comments.url')}</span>
          <input
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            maxLength={COMMENT_LIMITS.url}
            placeholder="https://"
            inputMode="url"
            aria-invalid={invalidField === 'url' || undefined}
            aria-describedby={invalidField === 'url' ? messageId : undefined}
            className="comment-composer__input"
          />
        </label>
      </div>

      <label className="comment-composer__field comment-composer__field--wide">
        <span className="sr-only">{t(locale, 'comments.body')}</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            parentId && replyTo
              ? tf(locale, 'comments.replyPlaceholder', { name: replyTo })
              : t(locale, 'comments.writePlaceholder')
          }
          maxLength={COMMENT_LIMITS.text}
          required
          rows={compact ? 3 : 4}
          autoFocus={compact}
          aria-invalid={invalidField === 'text' || undefined}
          aria-describedby={invalidField === 'text' ? messageId : undefined}
          className="comment-composer__textarea"
        />
      </label>

      {hasText ? (
        <div className="comment-composer__foot">
          <span className="comment-composer__count">
            {text.length}/{COMMENT_LIMITS.text}
          </span>

          <div className="comment-composer__actions">
            <div className="comment-composer__whisper">
              <label className="comment-composer__whisper-toggle">
                <input
                  type="checkbox"
                  checked={isWhispers}
                  onChange={(event) => setIsWhispers(event.target.checked)}
                  className="comment-composer__whisper-check"
                />
                <span className="comment-composer__whisper-label">
                  {t(locale, 'comments.whisper')}
                </span>
              </label>
              <span className="comment-composer__whisper-help">
                <button
                  type="button"
                  aria-label={t(locale, 'comments.whisperInfo')}
                  aria-describedby={whisperHintId}
                  className="comment-composer__whisper-info"
                >
                  <span aria-hidden="true">?</span>
                </button>
                <span
                  id={whisperHintId}
                  role="tooltip"
                  className="comment-composer__whisper-tooltip"
                >
                  {t(locale, 'comments.whisperHint')}
                </span>
              </span>
            </div>

            <button type="submit" disabled={pending} className="comment-composer__submit">
              {pending
                ? t(locale, 'comments.submitting')
                : parentId
                  ? t(locale, 'comments.reply')
                  : t(locale, 'comments.submit')}
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <span
          id={messageId}
          role="status"
          className={`comment-composer__message comment-composer__message--${
            message.kind === 'ok' ? 'ok' : 'error'
          }`}
        >
          {message.text}
        </span>
      ) : null}
    </form>
  )
}
