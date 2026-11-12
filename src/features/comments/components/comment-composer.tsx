'use client'

import { useEffect, useId, useRef, useState } from 'react'
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
  const [draft, setDraft] = useState<Draft>({ author: '', mail: '', url: '' })
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [invalidField, setInvalidField] = useState<CommentField | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const identityLoaded = useRef(false)
  const messageId = useId()
  const compact = variant === 'reply'

  useEffect(() => {
    if (identityLoaded.current) return
    identityLoaded.current = true
    try {
      const stored = window.localStorage.getItem(IDENTITY_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<Draft>
      setDraft({
        author: typeof parsed.author === 'string' ? parsed.author : '',
        // 旧版本可能存过邮箱：不再回填
        mail: '',
        url: typeof parsed.url === 'string' ? parsed.url : '',
      })
    } catch {
      // 本地存储坏了不影响发评论
    }
  }, [])

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

    const checked = validateCommentDraft({ ...draft, text })
    if (!checked.ok) {
      setInvalidField(checked.field)
      setMessage({ kind: 'error', text: checked.message })
      return
    }

    setInvalidField(null)
    setPending(true)
    setMessage(null)

    const endpoint = parentId ? '/api/comments/reply' : '/api/comments'
    const payload = parentId ? { parentId, ...checked.value } : { refId, ...checked.value }

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
        setMessage({ kind: 'ok', text: '评论已提交' })
        onSuccess()
        return
      }

      setInvalidField(result.field ?? null)
      setMessage({
        kind: 'error',
        // 服务端把字段级提示算好了（与 core 的约束同源），有就直接用
        text: result.message ?? (result.reason ? commentFailureMessage(result.reason) : '提交失败'),
      })
    } catch {
      setMessage({ kind: 'error', text: '网络异常，请稍后再试' })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className={compact ? 'comment-composer comment-composer--reply' : 'comment-composer'}
      aria-label={compact ? `回复 ${replyTo ?? ''}` : '发表评论'}
    >
      <div className="comment-composer__head">
        <p className="comment-composer__title">
          {compact ? `回复 ${replyTo ?? '这条评论'}` : '写一条评论'}
        </p>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="comment-composer__cancel">
            取消回复
          </button>
        ) : null}
      </div>

      <div className="comment-composer__fields">
        <label className="comment-composer__field">
          <span>昵称</span>
          <input
            value={draft.author}
            onChange={(event) => setDraft({ ...draft, author: event.target.value })}
            maxLength={COMMENT_LIMITS.author}
            required
            autoComplete="nickname"
            aria-invalid={invalidField === 'author' || undefined}
            aria-describedby={invalidField === 'author' ? messageId : undefined}
            className="comment-composer__input"
          />
        </label>

        <label className="comment-composer__field">
          <span>邮箱（不公开）</span>
          <input
            value={draft.mail}
            onChange={(event) => setDraft({ ...draft, mail: event.target.value })}
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
          <span>网址（可选）</span>
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
        <span>评论</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={COMMENT_LIMITS.text}
          required
          rows={compact ? 3 : 4}
          autoFocus={compact}
          aria-invalid={invalidField === 'text' || undefined}
          aria-describedby={invalidField === 'text' ? messageId : undefined}
          className="comment-composer__textarea"
        />
      </label>

      <div className="comment-composer__foot">
        <button type="submit" disabled={pending} className="comment-composer__submit">
          {pending ? '提交中…' : parentId ? '回复' : '发表评论'}
        </button>

        <span className="comment-composer__hint">邮箱仅用于识别身份，不会公开显示。</span>

        <span className="comment-composer__count">
          {text.length}/{COMMENT_LIMITS.text}
        </span>

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
      </div>
    </form>
  )
}
