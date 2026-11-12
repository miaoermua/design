'use client'

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * 通用模态窗口原语
 *
 * 为什么新增而不是复用 `ImagePreview`：图片灯箱是**专用**实现（左右翻页、
 * 计数器、图片尺寸约束），把它抽成通用组件会同时改到已验收的图片交互。
 * 这里只复用它的**行为契约**——portal 挂载点、遮罩样式来源、Esc 关闭、
 * 焦点恢复、`body` 滚动锁 —— 而不是复制它的图片逻辑。
 *
 * 契约：
 *   - 打开后焦点进入面板（`tabIndex=-1`），Tab / Shift+Tab 在面板内循环；
 *   - Esc、关闭按钮、点击遮罩都能关闭，关闭后焦点回到触发元素；
 *   - 打开期间锁定 `body` 滚动，并补偿滚动条宽度，避免背景横向跳动；
 *   - 面板是 flex 列，头部固定、内容区自己滚（由使用方给内容区加滚动样式）。
 *
 * 不做的：动画编排（交给 CSS 类）、`aria-hidden` 背景（`aria-modal` 已足够，
 * 全站只在这一处出现模态，没必要为此维护一棵 inert 树）。
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface DialogProps {
  /** 面板的可访问名称来源：消费方渲染的标题 id */
  labelledBy: string
  describedBy?: string
  onClose: () => void
  children: ReactNode
  /** 面板附加类（宽度、高度、滚动等尺寸约束由使用方决定） */
  className?: string
  /** 点击遮罩是否关闭；默认 true */
  closeOnBackdrop?: boolean
  /**
   * 关闭后把焦点还给谁。
   * 不传就退回 `document.activeElement`——多数浏览器点按钮会聚焦它，
   * 但 Safari 不会（按钮不参与键盘焦点），所以触发按钮明确传 ref 更可靠。
   */
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function Dialog({
  labelledBy,
  describedBy,
  onClose,
  children,
  className,
  closeOnBackdrop = true,
  returnFocusRef,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement
    restoreRef.current = previous instanceof HTMLElement ? previous : null
    // 在挂载时取一次：触发按钮在窗口打开期间不会消失，关闭时再读 ref 只是重复取值
    const preferred = returnFocusRef?.current ?? null

    const body = document.body
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    // 滚动条消失会让内容横向跳一下：按实际占位补回来
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`

    panelRef.current?.focus({ preventScroll: true })

    return () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
      // 触发元素可能已随导航卸载；`isConnected` 为 false 时不强行聚焦
      const target = preferred ?? restoreRef.current
      if (target?.isConnected) target.focus({ preventScroll: true })
    }
    // returnFocusRef 是稳定的 ref 对象，行为只在挂载/卸载两侧发生
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const trapFocus = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (!panel) return

    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (nodes.length === 0) {
      event.preventDefault()
      panel.focus()
      return
    }

    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault()
      last.focus()
      return
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  // SSR 阶段没有 document：这个组件只在客户端交互后才挂载，但仍加一层保护
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="folio-dialog">
      <div
        className="folio-dialog__backdrop"
        onMouseDown={(event) => {
          if (!closeOnBackdrop) return
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          tabIndex={-1}
          onKeyDown={trapFocus}
          className={className ? `folio-dialog__panel ${className}` : 'folio-dialog__panel'}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** 关闭按钮：位置与焦点样式固定在原语里，避免每个窗口各写一套 */
export function DialogClose({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button type="button" className="folio-dialog__close" aria-label={label} onClick={onClose}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
