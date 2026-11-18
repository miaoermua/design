'use client'

/**
 * 单条通知卡片（Sonner 自定义 toast 的内容）
 *
 * 这里保留的是迁移前的**全部**可见与可访问语义：
 *   - 6px 语义色圆点 + 级别标签行（提示/成功/注意/错误）；
 *   - 方角、纸张底、1px 边框 + 2px 左侧色条；
 *   - info/success → `role="status"` + `aria-live="polite"`；
 *     warning/error → `role="alert"` + `aria-live="assertive"`；
 *   - action 渲染成 `next/link`（保留站内路由与 prefetch）；
 *   - 文本 `×` 关闭按钮，带 `aria-label`。
 *
 * 为什么由 JSX 自绘而不是让 Sonner 排版：Sonner 的默认卡片没有「级别标签行」，
 * 也没有 `role="alert"`（它的容器恒为 polite），更没有左侧色条。改用
 * `toast.xxx()` 会丢掉这三样，属于改版而非迁移。
 *
 * 关于双层 live region：Sonner 的 <section> 恒带 `aria-live="polite"`，
 * 而本卡片自己也声明了 live 级别 —— 两层同时生效会导致重复播报。
 * `sonner-toaster.tsx` 会把外层 section 的 `aria-live` 置为 `off`，
 * 让播报只由这里负责。
 */

import Link from 'next/link'
import { t, type MessageKey } from '@/lib/i18n/dictionary'
import type { Locale } from '@/lib/i18n/config'
import type { NotificationItem, NotificationLevel } from '@/lib/notifications/store'

const TONE: Record<NotificationLevel, string> = {
  info: 'var(--state-info)',
  success: 'var(--state-success)',
  warning: 'var(--state-warning)',
  error: 'var(--state-danger)',
}

const LABEL_KEY: Record<NotificationLevel, MessageKey> = {
  info: 'notify.info',
  success: 'notify.success',
  warning: 'notify.warning',
  error: 'notify.error',
}

export interface ToastCardProps {
  item: NotificationItem
  locale: Locale
  onClose: () => void
}

export function ToastCard({ item, locale, onClose }: ToastCardProps) {
  const urgent = item.level === 'warning' || item.level === 'error'

  return (
    <div
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
        <p className="text-meta text-[var(--text-secondary)]">{t(locale, LABEL_KEY[item.level])}</p>
        <p className="text-body mt-0.5 break-words text-[var(--text-primary)]">{item.title}</p>
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
        onClick={onClose}
        aria-label={t(locale, 'notify.dismiss')}
        className="text-meta shrink-0 px-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        ×
      </button>
    </div>
  )
}
