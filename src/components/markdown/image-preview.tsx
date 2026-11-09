'use client'

/**
 * 图片预览（Lightbox）
 *
 * 普通图片与相册/轮播共用同一个预览：调用方只负责把「图片集合 + 起始索引」交给
 * `openPreview()`，界面由 `ImageViewer` 渲染。集合可以只有一张（普通图片），
 * 此时左右切换按钮不出现。
 *
 * 为什么用模块级 store 而不是把状态挂在某个组件里：
 * 正文是服务端产出的 HTML 字符串，相册增强与普通图片点击发生在不同的客户端组件中，
 * 而预览浮层全局只应出现一个。store 让「谁打开」与「在哪渲染」解耦，
 * `ImageViewer` 由 root layout 挂载一次，多个正文实例也不会叠出多个浮层。
 */

import { useEffect, useRef, useSyncExternalStore, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryImage } from '@/lib/content/gallery'

export interface PreviewState {
  images: readonly GalleryImage[]
  index: number
}

let current: PreviewState | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function wrapIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return ((index % total) + total) % total
}

/** 打开预览；空集合直接忽略 */
export function openPreview(images: readonly GalleryImage[], index = 0): void {
  if (images.length === 0) return
  current = { images, index: wrapIndex(index, images.length) }
  emit()
}

export function closePreview(): void {
  if (!current) return
  current = null
  emit()
}

/** 左右切换（循环）；只有一张时不动 */
export function stepPreview(delta: number): void {
  if (!current) return
  const total = current.images.length
  if (total < 2) return
  current = { images: current.images, index: wrapIndex(current.index + delta, total) }
  emit()
}

/** 供测试与调试读取当前状态 */
export function getPreviewState(): PreviewState | null {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePreviewState(): PreviewState | null {
  return useSyncExternalStore(subscribe, getPreviewState, () => null)
}

interface ImagePreviewProps {
  images: readonly GalleryImage[]
  index: number
  onClose: () => void
  onStep: (delta: number) => void
}

/**
 * 预览浮层本体：只受 props 驱动，卸载即清理监听、滚动锁与焦点。
 */
export function ImagePreview({ images, index, onClose, onStep }: ImagePreviewProps): ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const total = images.length
  const image = images[index]

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight

    // 打开时锁滚动并补偿滚动条宽度，关闭时原样恢复
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onStep(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onStep(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
      previousFocus?.focus()
    }
  }, [onClose, onStep])

  // 焦点留在浮层内：只有几个按钮，Tab / Shift+Tab 在首尾之间循环
  const handleTab = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button')
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="md-preview"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="md-preview__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={image?.alt ? `图片预览：${image.alt}` : '图片预览'}
        onKeyDown={handleTab}
      >
        <button
          ref={closeRef}
          type="button"
          className="md-preview__close"
          aria-label="关闭预览"
          onClick={onClose}
        >
          ×
        </button>

        {total > 1 ? (
          <>
            <button
              type="button"
              className="md-preview__nav md-preview__nav--prev"
              aria-label="上一张"
              onClick={() => onStep(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="md-preview__nav md-preview__nav--next"
              aria-label="下一张"
              onClick={() => onStep(1)}
            >
              ›
            </button>
          </>
        ) : null}

        {image ? (
          <figure className="md-preview__stage">
            <img className="md-preview__image" src={image.src} alt={image.alt} decoding="async" />
            {image.alt ? (
              <figcaption className="md-preview__caption">{image.alt}</figcaption>
            ) : null}
          </figure>
        ) : null}

        {total > 1 ? (
          <p className="md-preview__counter">
            {index + 1} / {total}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** 全局唯一的预览宿主：挂在 root layout，任何一个正文实例都可驱动它 */
export function ImageViewer(): ReactElement | null {
  const preview = usePreviewState()

  if (!preview || typeof document === 'undefined') return null

  return createPortal(
    <ImagePreview
      images={preview.images}
      index={preview.index}
      onClose={closePreview}
      onStep={stepPreview}
    />,
    document.body,
  )
}
