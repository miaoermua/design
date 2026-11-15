'use client'

/**
 * 连接状态胶囊
 *
 * 只表达「读者需要知道的连接状态」，不显示 URL、状态码或堆栈。
 * - 位置：全站右下角通知堆栈中的最下方。
 * - 交互：支持横向拖动或键盘关闭；状态快照变化时再次显示，恢复后由 store 自动隐藏。
 * - 语义：role="status" + aria-live="polite"，屏幕阅读器不会被打断。
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useStatusSnapshot } from '@/lib/status/use-status'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t, tf, type MessageKey } from '@/lib/i18n/dictionary'
import type { StatusSnapshot } from '@/lib/status/store'

export interface StatusCapsuleProps {
  locale?: Locale
}

/** 每种连接状态对应一条字典文案；文案本身不在这里维护 */
const MESSAGE_KEY: Record<Exclude<StatusSnapshot['kind'], null>, MessageKey> = {
  offline: 'status.offline',
  realtime: 'status.realtime',
  api: 'status.api',
  recovered: 'status.recovered',
}

export function StatusCapsule({ locale = DEFAULT_LOCALE }: StatusCapsuleProps) {
  const status = useStatusSnapshot()
  const [dismissedStatus, setDismissedStatus] = useState<StatusSnapshot | null>(null)
  const pointerStartX = useRef<number | null>(null)

  if (status.kind === null || dismissedStatus === status) return null

  const recovered = status.kind === 'recovered'
  const base = t(locale, MESSAGE_KEY[status.kind])
  const retrying = status.kind === 'realtime' && status.attempt && status.attempt > 1
  const message = retrying
    ? tf(locale, 'status.attempt', { base, count: status.attempt ?? 1 })
    : base
  const dismiss = () => setDismissedStatus(status)
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    pointerStartX.current = event.clientX
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return
    const distance = event.clientX - pointerStartX.current
    pointerStartX.current = null
    if (Math.abs(distance) >= 52) dismiss()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartX.current = null
      }}
      className="pointer-events-auto flex max-w-full cursor-grab touch-pan-y select-none items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-1.5 text-[var(--text-secondary)] shadow-[var(--shadow-raise)] active:cursor-grabbing"
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-[var(--radius-pill)]"
        style={{
          backgroundColor: recovered ? 'var(--state-success)' : 'var(--state-warning)',
        }}
      />
      <span className="text-meta min-w-0 truncate">{message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t(locale, 'status.dismiss')}
        className="text-meta shrink-0 rounded-full px-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        ×
      </button>
    </div>
  )
}
