'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { SubscribeType } from '@/lib/api/contracts/v2/interaction'
import type { SubscribeChannel } from '@/features/interactions'
import { SocialIcon } from '@/components/ui/social-icon'
import { cn } from '@/lib/utils/cn'

const TYPE_LABEL: Record<SubscribeType, string> = {
  post_c: '新文章',
  note_c: '新日记',
}

type Status = 'idle' | 'submitting' | 'sent' | 'failed'

interface SubscribePanelProps {
  /** 后端允许的订阅类型；为空时不渲染邮件表单（频道仍可单独存在） */
  types: SubscribeType[]
  /** 频道订阅：来自 `social.items` 里显式标记为频道的项 */
  channels: SubscribeChannel[]
  className?: string
}

/**
 * 订阅入口：一封邮件、一个 RSS 地址、若干外部频道。
 *
 * 交互沿用 DonateAction 的形态：点击展开、点外关闭、Escape 关闭并把焦点还给入口。
 * 不做模态：订阅不是必须先处理的事情，锁滚动只会打断阅读。
 *
 * 三种方式的能力边界不同，界面必须说清楚：
 *   - 邮件：core 发确认邮件，用户点链接之后才算订阅成功，所以成功文案
 *     只能说「确认邮件已发送」。
 *   - RSS：主题只提供 `/feed.xml`，是否「已订阅」由阅读器自己维护。
 *   - 频道：纯跳转，站内不记录任何订阅状态。
 */
export function SubscribePanel({ types, channels, className }: SubscribePanelProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    // 有邮箱表单时把焦点交给第一个可输入项；只有频道时停在面板本身
    const focusTarget = inputRef.current ?? panelRef.current
    focusTarget?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close(true)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting' || status === 'sent') return

    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const selected = types.filter((type) => data.get(`type-${type}`) === 'on')

    if (selected.length === 0) {
      setStatus('failed')
      setMessage('至少选择一种订阅内容。')
      return
    }

    setStatus('submitting')
    setMessage(null)

    try {
      const response = await fetch('/api/interactions/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, types: selected }),
      })
      if (!response.ok) throw new Error(String(response.status))

      setStatus('sent')
      setMessage('确认邮件已发送，请查收后完成订阅。')
      form.reset()
    } catch {
      setStatus('failed')
      setMessage('订阅请求失败，请稍后再试。')
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="action-rail-button"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[1.05rem]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16v12H4z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        <span>订阅</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="订阅方式"
          tabIndex={-1}
          className="absolute top-full left-1/2 z-30 mt-2 w-[min(19rem,calc(100vw-2.5rem))] -translate-x-1/2 border border-[var(--edge)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-pop)] outline-none xl:top-0 xl:left-full xl:mt-0 xl:ml-3 xl:translate-x-0"
        >
          <p className="text-small text-[var(--text-heading)]">订阅更新</p>
          <p className="text-meta mt-1 text-[var(--text-secondary)]">选一种跟得上更新的方式。</p>

          {types.length > 0 ? (
            <form
              onSubmit={handleSubmit}
              className="mt-3 border-t border-dashed border-[var(--edge)] pt-3"
            >
              <p className="text-meta text-[var(--text-secondary)]">邮件</p>
              <label htmlFor={`${panelId}-email`} className="sr-only">
                邮箱地址
              </label>
              <input
                ref={inputRef}
                id={`${panelId}-email`}
                name="email"
                type="email"
                required
                autoComplete="off"
                placeholder="name@example.com"
                disabled={status === 'sent'}
                className="text-small mt-1.5 w-full border border-[var(--edge)] bg-[var(--surface)] px-2.5 py-2 text-[var(--text-heading)] outline-none focus:border-[var(--accent)]"
              />

              <fieldset className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                <legend className="sr-only">订阅内容</legend>
                {types.map((type) => (
                  <label
                    key={type}
                    className="text-meta flex items-center gap-1.5 text-[var(--text-secondary)]"
                  >
                    <input
                      type="checkbox"
                      name={`type-${type}`}
                      defaultChecked
                      className="size-3.5 accent-[var(--accent)]"
                    />
                    {TYPE_LABEL[type]}
                  </label>
                ))}
              </fieldset>

              <button
                type="submit"
                disabled={status === 'submitting' || status === 'sent'}
                className="text-meta mt-3 w-full border border-[var(--text-primary)] bg-[var(--text-primary)] px-3 py-2 text-[var(--surface)] transition-opacity disabled:opacity-60"
              >
                {status === 'submitting'
                  ? '发送中…'
                  : status === 'sent'
                    ? '已发送'
                    : '发送确认邮件'}
              </button>

              {message ? (
                <p
                  role={status === 'failed' ? 'alert' : 'status'}
                  className={cn(
                    'text-meta mt-3 leading-relaxed',
                    status === 'failed'
                      ? 'text-[var(--color-danger)]'
                      : 'text-[var(--text-secondary)]',
                  )}
                >
                  {message}
                </p>
              ) : null}
            </form>
          ) : null}

          <div className="mt-3 border-t border-dashed border-[var(--edge)] pt-3">
            <p className="text-meta text-[var(--text-secondary)]">RSS</p>
            <a
              href="/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-small mt-1 inline-flex items-center gap-1 text-[var(--text-heading)] underline decoration-[var(--edge-strong)] underline-offset-4 transition-colors hover:text-[var(--accent-strong)]"
            >
              /feed.xml
              <span aria-hidden="true">↗</span>
            </a>
            <p className="text-meta mt-1 text-[var(--text-tertiary)]">
              用阅读器主动拉取，不需要留下邮箱。
            </p>
          </div>

          {channels.length > 0 ? (
            <div className="mt-3 border-t border-dashed border-[var(--edge)] pt-3">
              <p className="text-meta text-[var(--text-secondary)]">频道订阅</p>
              <ul className="mt-1 space-y-px">
                {channels.map((channel) => (
                  <li key={channel.id}>
                    <a
                      href={channel.url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      style={channel.color ? { color: channel.color } : undefined}
                      className="text-small flex items-center gap-2 py-1 text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent-strong)]"
                    >
                      <SocialIcon icon={channel.icon} className="size-[1.05rem] shrink-0" />
                      <span className="min-w-0 truncate">{channel.title}</span>
                      <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-meta mt-1 text-[var(--text-tertiary)]">
                跳转到外部频道，站内不记录订阅状态。
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
