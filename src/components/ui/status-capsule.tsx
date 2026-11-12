'use client'

/**
 * 连接状态胶囊
 *
 * 只表达「读者需要知道的连接状态」，不显示 URL、状态码或堆栈。
 * - 位置：移动端在页头下方，桌面端左下；不覆盖正文与操作区。
 * - 交互：纯展示，`pointer-events-none`，不需要点关闭；
 *   恢复后由 store 在几秒后自动隐藏。
 * - 语义：role="status" + aria-live="polite"，屏幕阅读器不会被打断。
 */

import { useStatusSnapshot } from '@/lib/status/use-status'
import type { Locale } from '@/lib/i18n/config'

export interface StatusCapsuleProps {
  locale?: Locale
}

const MESSAGES: Record<Locale, Record<'offline' | 'realtime' | 'api' | 'recovered', string>> = {
  zh: {
    offline: '网络不可用，正在等待恢复连接',
    realtime: '实时连接已断开，正在重试',
    api: '未能获取最新内容，页面显示的是稍早的版本',
    recovered: '连接已恢复',
  },
  en: {
    offline: 'You are offline. Waiting for the connection to come back.',
    realtime: 'Live updates disconnected. Retrying.',
    api: 'Could not load the latest version. Showing an earlier copy.',
    recovered: 'Connection restored.',
  },
}

export function StatusCapsule({ locale = 'zh' }: StatusCapsuleProps) {
  const status = useStatusSnapshot()

  if (status.kind === null) return null

  const recovered = status.kind === 'recovered'
  const base = MESSAGES[locale][status.kind]
  const retrying = status.kind === 'realtime' && status.attempt && status.attempt > 1
  const message = retrying
    ? locale === 'en'
      ? `${base} (attempt ${status.attempt})`
      : `${base}（第 ${status.attempt} 次）`
    : base

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-20 z-[60] flex justify-center sm:inset-x-auto sm:bottom-6 sm:left-6 sm:top-auto sm:justify-start"
    >
      <p className="text-meta flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-1.5 text-[var(--text-secondary)] shadow-[var(--shadow-raise)]">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-[var(--radius-pill)]"
          style={{
            backgroundColor: recovered ? 'var(--color-success)' : 'var(--color-warning)',
          }}
        />
        {message}
      </p>
    </div>
  )
}
