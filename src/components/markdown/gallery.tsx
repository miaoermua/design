'use client'

/**
 * 相册 / 轮播（同一个组件，两种交互形态）
 *
 * 相册与轮播共用一套图片数据结构、一套横向轨道、一套预览入口；
 * 差别只在交互：轮播多出「上一张 / 下一张」按钮，并且默认铺满一屏一张。
 * 因此不另建「第二套解析系统」，也不建 Carousel 组件。
 *
 * 服务端已经产出可用的静态轨道（无 JS 也能横向滚动、点开原图），
 * `MediaEnhancer` 挂载时把它替换成这个组件，以换取索引同步、按钮、键盘与预览。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import type { GalleryImage, GalleryVariant } from '@/lib/content/gallery'
import { openPreview } from './image-preview'

const DEFAULT_AUTOPLAY_DELAY = 5000

/** 只给悬停/预览用的最小状态：当前索引由滚动位置反推，不额外维护一份 */
export function nearestImageIndex(track: HTMLElement): number {
  const items = Array.from(track.children) as HTMLElement[]
  if (items.length === 0) return 0

  const center = track.scrollLeft + track.clientWidth / 2
  let nearest = 0
  let distance = Number.POSITIVE_INFINITY

  items.forEach((item, index) => {
    const itemCenter = item.offsetLeft + item.offsetWidth / 2
    const next = Math.abs(itemCenter - center)
    if (next < distance) {
      distance = next
      nearest = index
    }
  })

  return nearest
}

interface GalleryProps {
  images: readonly GalleryImage[]
  variant?: GalleryVariant
  /** 可选能力，默认关闭；一旦用户滚动 / 点击 / 按键就永久停止 */
  autoplay?: boolean
  autoplayDelay?: number
}

export function Gallery({
  images,
  variant = 'gallery',
  autoplay = false,
  autoplayDelay = DEFAULT_AUTOPLAY_DELAY,
}: GalleryProps): ReactElement {
  const trackRef = useRef<HTMLUListElement>(null)
  const indexRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const autoplayRef = useRef(autoplay)
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set())

  const total = images.length
  const isCarousel = variant === 'carousel'

  const activate = useCallback((next: number) => {
    indexRef.current = next
    setIndex(next)
  }, [])

  const scrollToIndex = useCallback((next: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current
    if (!track) return
    const item = track.children.item(next) as HTMLElement | null
    if (!item) return

    // 居中滚动：当前项落在轨道正中，两侧留出相邻图作为提示
    const left = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left, behavior })
    } else {
      track.scrollLeft = left
    }
  }, [])

  const goTo = useCallback(
    (next: number, behavior: ScrollBehavior = 'smooth') => {
      if (total === 0) return
      const clamped = Math.min(Math.max(next, 0), total - 1)
      activate(clamped)
      scrollToIndex(clamped, behavior)
    },
    [activate, scrollToIndex, total],
  )

  const step = useCallback(
    (delta: number) => {
      if (total < 2) return
      const next = (((indexRef.current + delta) % total) + total) % total
      activate(next)
      scrollToIndex(next)
    },
    [activate, scrollToIndex, total],
  )

  // 滚动即更新索引：用 rAF 合并同一帧内的多次 scroll 事件
  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return
    const track = trackRef.current
    if (!track) return

    const schedule =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16)

    frameRef.current = schedule(() => {
      frameRef.current = null
      const nearest = nearestImageIndex(track)
      if (nearest !== indexRef.current) activate(nearest)
    })
  }, [activate])

  // 卸载：丢掉还没执行的帧回调
  useEffect(
    () => () => {
      if (frameRef.current === null) return
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frameRef.current)
      } else {
        window.clearTimeout(frameRef.current)
      }
      frameRef.current = null
    },
    [],
  )

  useEffect(() => {
    autoplayRef.current = autoplay
    if (!autoplay || total < 2) return
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const timer = window.setInterval(() => {
      if (!autoplayRef.current) return
      step(1)
    }, autoplayDelay)

    return () => window.clearInterval(timer)
  }, [autoplay, autoplayDelay, step, total])

  const stopAutoplay = useCallback(() => {
    autoplayRef.current = false
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    stopAutoplay()
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      goTo(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      goTo(total - 1)
    }
  }

  return (
    <div
      className="md-gallery__root"
      role="group"
      aria-roledescription={isCarousel ? 'carousel' : 'gallery'}
      aria-label={isCarousel ? '图片轮播' : '图片相册'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={stopAutoplay}
      onWheel={stopAutoplay}
    >
      <ul ref={trackRef} className="md-gallery__track" onScroll={handleScroll}>
        {images.map((image, position) => (
          <li className="md-gallery__item" key={`${image.src}#${position}`}>
            {failed.has(position) ? (
              <span className="md-gallery__broken">{image.alt || '图片加载失败'}</span>
            ) : (
              <a
                className="md-gallery__link"
                href={image.src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.preventDefault()
                  stopAutoplay()
                  openPreview(images, position)
                }}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  title={image.title}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onError={() =>
                    setFailed((previous) => {
                      const next = new Set(previous)
                      next.add(position)
                      return next
                    })
                  }
                />
              </a>
            )}
          </li>
        ))}
      </ul>

      {isCarousel && total > 1 ? (
        <>
          <button
            type="button"
            className="md-gallery__nav md-gallery__nav--prev"
            aria-label="上一张"
            onClick={() => {
              stopAutoplay()
              step(-1)
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="md-gallery__nav md-gallery__nav--next"
            aria-label="下一张"
            onClick={() => {
              stopAutoplay()
              step(1)
            }}
          >
            ›
          </button>
        </>
      ) : null}

      <p className="md-gallery__counter">
        {total === 0 ? 0 : index + 1} / {total}
      </p>

      {total > 1 ? (
        <div className="md-gallery__dots">
          {images.map((image, position) => (
            <button
              type="button"
              key={`${image.src}#dot-${position}`}
              className="md-gallery__dot"
              aria-label={`第 ${position + 1} 张`}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => {
                stopAutoplay()
                goTo(position)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
