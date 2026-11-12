'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils/cn'

import type { DonateQrcode } from '../config'

interface DonateActionProps {
  label: string
  qrcodes: DonateQrcode[]
  className?: string
}

type OpenedBy = 'hover' | 'click'

/**
 * 赞赏入口 + 二维码浮层。
 *
 * 交互分工（同一份 UI，不区分两套实现）：
 * - 有 hover 能力的指针设备：移入展开，移出整体关闭；点击可把浮层「钉住」，
 *   之后由点击外部 / Escape 关闭。
 * - 触摸设备：点击切换，点击外部关闭。
 *
 * 浮层是绝对定位的普通元素，不锁定滚动、不挂 portal、不抢焦点，
 * 因此不会干扰页面正常滚动与阅读位置。
 */
export function DonateAction({ label, qrcodes, className }: DonateActionProps) {
  const [open, setOpen] = useState(false)
  const [openedBy, setOpenedBy] = useState<OpenedBy>('click')
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set())

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    setOpenedBy('click')
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  /**
   * 只在「真的能 hover」时启用浮层跟随指针。
   * 用 pointerType 再拦一道，避免触摸设备合成 mouse 事件时误展开。
   */
  const supportsHover = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }

  /** 部分环境（含 jsdom）不会填 pointerType，按鼠标处理；触摸设备一定带 'touch' */
  const isMousePointer = (pointerType: string) => !pointerType || pointerType === 'mouse'

  const handlePointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMousePointer(event.pointerType) || !supportsHover()) return
    setOpen(true)
    setOpenedBy('hover')
  }

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMousePointer(event.pointerType) || !supportsHover()) return
    // 点击钉住的浮层不因移出鼠标而消失，否则「点开再移开」会立刻关闭
    if (openedBy === 'hover') setOpen(false)
  }

  const handleClick = () => {
    if (!open) {
      setOpen(true)
      setOpenedBy('click')
      return
    }

    // hover 展开状态下点一下 = 钉住，而不是关掉
    if (openedBy === 'hover') {
      setOpenedBy('click')
      return
    }

    setOpen(false)
  }

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && rootRef.current?.contains(next)) return
    setOpen(false)
  }

  const markFailed = (url: string) => {
    setFailedUrls((previous) => {
      if (previous.has(url)) return previous
      const next = new Set(previous)
      next.add(url)
      return next
    })
  }

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-flex', className)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onBlur={handleBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={handleClick}
        className="meta inline-flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-[var(--focus-ring-width)]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[0.95rem]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
          <path d="M2 7h20v5H2z" />
          <path d="M12 22V7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z" />
        </svg>
        <span>{label}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`${label}二维码`}
          // pb-2 是「鼠标从入口移向浮层」的过渡带：没有它，两者之间的空隙
          // 会触发 pointerleave，浮层闪烁关闭。
          className="absolute bottom-full left-0 z-30 w-max max-w-[calc(100vw-2.5rem)] pb-2"
        >
          <ul className="flex flex-wrap gap-4 border border-[var(--edge)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-pop)]">
            {qrcodes.map((qrcode) => {
              const failed = failedUrls.has(qrcode.url)

              return (
                <li key={qrcode.url} className="flex w-[7rem] flex-col items-center gap-1.5">
                  {failed ? (
                    <span className="text-meta flex size-28 items-center justify-center border border-dashed border-[var(--edge)] bg-[var(--surface-sunk)] px-2 text-center text-[var(--text-tertiary)]">
                      二维码加载失败
                    </span>
                  ) : (
                    <img
                      src={qrcode.url}
                      alt={`${qrcode.name}赞赏二维码`}
                      width={112}
                      height={112}
                      loading="lazy"
                      decoding="async"
                      onError={() => markFailed(qrcode.url)}
                      className="size-28 bg-[var(--surface-sunk)] object-contain"
                    />
                  )}
                  <span className="text-meta text-[var(--text-secondary)]">{qrcode.name}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
