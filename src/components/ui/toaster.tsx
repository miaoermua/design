'use client'

/**
 * 通知条（Toaster）
 *
 * 视觉：与站点的纸张/冰面体系一致——边框 + 一条左侧色条，不用彩色底块。
 * 行为：
 * - 移动端贴底居中，桌面端贴右下，容器 `pointer-events-none`，只有卡片本身可点，
 *   因此永远不会挡住正文的链接或按钮。
 * - 每条带关闭按钮（可 Tab 聚焦），自动关闭由 store 的计时器负责。
 * - info/success 用 role="status"（不打断），warning/error 用 role="alert"。
 */

import Link from 'next/link'
import { notificationStore, type NotificationLevel } from '@/lib/notifications/store'
import { useNotifications } from '@/lib/notifications/use-notifications'
import type { Locale } from '@/lib/i18n/config'

const TONE: Record<NotificationLevel, string> = {
  info: 'var(--color-info)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-danger)',
}

const LABEL: Record<Locale, Record<NotificationLevel, string>> = {
  zh: { info: '提示', success: '成功', warning: '注意', error: '错误' },
  en: { info: 'Notice', success: 'Done', warning: 'Warning', error: 'Error' },
}

export interface ToasterProps {
  locale?: Locale
}

export function Toaster({ locale = 'zh' }: ToasterProps) {
  const items = useNotifications()

  if (items.length === 0) return null

  return (
    <div
      className="pointer-events-none relative flex w-full flex-col items-stretch gap-2"
      role="region"
      aria-label={locale === 'en' ? 'Notifications' : '通知'}
    >
      {items.map((item) => {
        const urgent = item.level === 'warning' || item.level === 'error'
        return (
          <div
            key={item.id}
            role={urgent ? 'alert' : 'status'}
            aria-live={urgent ? 'assertive' : 'polite'}
            className="pointer-events-auto flex items-start gap-3 border border-[var(--edge)] border-l-2 bg-[var(--surface-raised)] px-4 py-3 shadow-[var(--shadow-pop)]"
            style={{ borderLeftColor: TONE[item.level] }}
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-[var(--radius-pill)]"
              style={{ backgroundColor: TONE[item.level] }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-meta text-[var(--text-tertiary)]">
                {LABEL[locale][item.level]}
              </p>
              <p className="text-body mt-0.5 break-words text-[var(--text-primary)]">
                {item.title}
              </p>
              {item.description ? (
                <p className="text-meta mt-1 break-words text-[var(--text-secondary)]">
                  {item.description}
                </p>
              ) : null}
              {item.action ? (
                <Link
                  href={item.action.href}
                  className="text-meta mt-2 inline-block text-[var(--accent-strong)] underline decoration-1 underline-offset-4"
                >
                  {item.action.label}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => notificationStore.dismiss(item.id)}
              aria-label={locale === 'en' ? 'Dismiss notification' : '关闭通知'}
              className="text-meta shrink-0 px-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
