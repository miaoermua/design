'use client'

import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import type { SubscribeType } from '@/lib/api/contracts/v2/interaction'
import type { SubscribeChannel } from '@/features/interactions'
import { SocialIcon } from '@/components/ui/social-icon'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { useLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'
import { t, type MessageKey } from '@/lib/i18n/dictionary'
import { notify } from '@/lib/notifications/store'
import { systemNotifications, type SystemNotifyState } from '@/lib/notifications/system'
import { cn } from '@/lib/utils/cn'

/** 只存字典键：文案在渲染时按当前 locale 取 */
const TYPE_LABEL: Record<SubscribeType, MessageKey> = {
  post_c: 'subscribe.post',
  note_c: 'subscribe.note',
}

type EmailStatus = 'idle' | 'submitting' | 'sent' | 'failed'

export interface SubscribeModalProps {
  /** 后端允许的订阅类型；为空时不渲染邮件表单 */
  types: SubscribeType[]
  /** 频道订阅：来自 social.items 里标记为频道的项 */
  channels: SubscribeChannel[]
  /** 控制弹窗显隐 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 关闭后把焦点还给触发元素 */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * 公有订阅弹窗
 *
 * 合并四种订阅渠道：邮件表单、RSS、外部频道、浏览器通知。
 * 基于 Dialog 原语，全站任何入口都可以触发——阅读侧栏、首页 More 行、
 * 未来的 Footer 或导航栏都只需要管 `open` 状态。
 *
 * 与旧 subscribe-panel 的能力差异：
 *   - 旧面板是 popover（不锁滚动、不遮背景），适合阅读时的轻触碰；
 *   - 本弹窗是模态（锁滚动、遮罩、焦点陷阱），适合「我要订阅」的明确意图。
 *   - 新增浏览器通知渠道（从 home-more 迁入）。
 */
export function SubscribeModal({
  types,
  channels,
  open,
  onClose,
  returnFocusRef,
}: SubscribeModalProps) {
  const locale = useLocale()
  const titleId = useId()

  if (!open) return null

  return (
    <Dialog
      labelledBy={titleId}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      className="subscribe-modal"
    >
      {/* 头部 */}
      <div className="subscribe-modal__head">
        <div>
          <h2 id={titleId} className="subscribe-modal__title">
            {t(locale, 'subscribe.heading')}
          </h2>
          <p className="subscribe-modal__intro">{t(locale, 'subscribe.intro')}</p>
        </div>
        <DialogClose label={t(locale, 'subscribe.close')} onClose={onClose} />
      </div>

      {/* 内容区：可滚动 */}
      <div className="subscribe-modal__body">
        {/* ── 邮件订阅 ── */}
        {types.length > 0 ? <EmailSection types={types} locale={locale} /> : null}

        {/* ── RSS ── */}
        <RssSection locale={locale} />

        {/* ── 浏览器通知 ── */}
        <NotifySection locale={locale} />

        {/* ── 外部频道 ── */}
        {channels.length > 0 ? <ChannelSection channels={channels} locale={locale} /> : null}
      </div>
    </Dialog>
  )
}

/* ── 邮件表单 ───────────────────────────────────────────────────── */

function EmailSection({ types, locale }: { types: SubscribeType[]; locale: Locale }) {
  const [status, setStatus] = useState<EmailStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const formId = useId()

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (status === 'submitting' || status === 'sent') return

      const form = event.currentTarget
      const data = new FormData(form)
      const email = String(data.get('email') ?? '').trim()
      const selected = types.filter((type) => data.get(`type-${type}`) === 'on')

      if (selected.length === 0) {
        setStatus('failed')
        setMessage(t(locale, 'subscribe.errorChoose'))
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
        setMessage(t(locale, 'subscribe.success'))
        form.reset()
      } catch {
        setStatus('failed')
        setMessage(t(locale, 'subscribe.failed'))
      }
    },
    [types, locale, status],
  )

  return (
    <section className="subscribe-modal__section">
      <p className="subscribe-modal__section-label">{t(locale, 'subscribe.emailLabel')}</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor={`${formId}-email`} className="sr-only">
          {t(locale, 'subscribe.emailPlaceholder')}
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@example.com"
          disabled={status === 'sent'}
          className="subscribe-modal__input"
        />

        <fieldset className="subscribe-modal__types">
          <legend className="sr-only">{t(locale, 'subscribe.contentLabel')}</legend>
          {types.map((type) => (
            <label key={type} className="subscribe-modal__type-label">
              <input
                type="checkbox"
                name={`type-${type}`}
                defaultChecked
                className="subscribe-modal__checkbox"
              />
              {t(locale, TYPE_LABEL[type])}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={status === 'submitting' || status === 'sent'}
          className="subscribe-modal__submit"
        >
          {status === 'submitting'
            ? t(locale, 'subscribe.sending')
            : status === 'sent'
              ? t(locale, 'subscribe.sent')
              : t(locale, 'subscribe.send')}
        </button>

        {message ? (
          <p
            role={status === 'failed' ? 'alert' : 'status'}
            className={cn(
              'subscribe-modal__message',
              status === 'failed' && 'subscribe-modal__message--error',
            )}
          >
            {message}
          </p>
        ) : null}
      </form>
    </section>
  )
}

/* ── RSS ────────────────────────────────────────────────────────── */

function RssSection({ locale }: { locale: Locale }) {
  return (
    <section className="subscribe-modal__section">
      <p className="subscribe-modal__section-label">{t(locale, 'subscribe.rssTitle')}</p>
      <Link
        href="/feed"
        target="_blank"
        rel="noopener noreferrer"
        className="subscribe-modal__rss-link"
      >
        /feed
        <span aria-hidden="true">↗</span>
      </Link>
      <p className="subscribe-modal__hint">{t(locale, 'subscribe.rssHint')}</p>
    </section>
  )
}

/* ── 浏览器通知 ─────────────────────────────────────────────────── */

function NotifySection({ locale }: { locale: Locale }) {
  const [state, setState] = useState<SystemNotifyState>(() => systemNotifications.getState())

  const handleToggle = async () => {
    if (state === 'on') {
      systemNotifications.disable()
      setState('off')
      notify({ level: 'info', title: t(locale, 'subscribe.notifyDisabled') })
      return
    }

    const next = await systemNotifications.enable()
    setState(next)

    if (next === 'on') {
      notify({ level: 'success', title: t(locale, 'subscribe.notifyEnabled') })
    } else if (next === 'blocked') {
      notify({
        level: 'warning',
        title: t(locale, 'subscribe.notifyDenied'),
        durationMs: 0,
      })
    } else if (next === 'unsupported') {
      notify({ level: 'info', title: t(locale, 'subscribe.notifyUnsupported') })
    }
  }

  const stateLabel =
    state === 'on'
      ? t(locale, 'subscribe.notifyOn')
      : state === 'blocked'
        ? t(locale, 'subscribe.notifyBlocked')
        : state === 'unsupported'
          ? t(locale, 'subscribe.notifyUnsupported')
          : t(locale, 'subscribe.notifyOff')

  const disabled = state === 'blocked' || state === 'unsupported'

  return (
    <section className="subscribe-modal__section">
      <div className="subscribe-modal__notify-row">
        <div className="subscribe-modal__notify-info">
          <p className="subscribe-modal__section-label">{t(locale, 'subscribe.notifyTitle')}</p>
          <p className="subscribe-modal__hint">{t(locale, 'subscribe.notifyHint')}</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          aria-pressed={state === 'on'}
          className={cn(
            'subscribe-modal__notify-toggle',
            state === 'on' && 'subscribe-modal__notify-toggle--on',
          )}
        >
          {stateLabel}
        </button>
      </div>
    </section>
  )
}

/* ── 频道 ───────────────────────────────────────────────────────── */

function ChannelSection({ channels, locale }: { channels: SubscribeChannel[]; locale: Locale }) {
  return (
    <section className="subscribe-modal__section">
      <p className="subscribe-modal__section-label">{t(locale, 'subscribe.channelsLabel')}</p>
      <ul className="subscribe-modal__channels">
        {channels.map((channel) => (
          <li key={channel.id}>
            <a
              href={channel.url}
              target="_blank"
              rel="me noopener noreferrer"
              style={channel.color ? { color: channel.color } : undefined}
              className="subscribe-modal__channel"
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
      <p className="subscribe-modal__hint">{t(locale, 'subscribe.channelNote')}</p>
    </section>
  )
}
