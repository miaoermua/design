'use client'

import { useEffect, useRef, useState } from 'react'
import { computeReadingProgress, progressPercent } from '@/lib/reading/progress'
import { cn } from '@/lib/utils/cn'

interface ReadingProgressRingProps {
  /** 正文元素 id：环的进度以这段内容的顶部/底部为口径 */
  targetId: string
  className?: string
}

/**
 * 环形阅读进度
 *
 * 尺寸刻意压到 26px：它是目录标题行右侧的辅助信息，不该和目录抢视觉主体。
 * 百分比放在圆圈**右侧**（`items-center` 横向居中对齐），不再压在环心：
 * 26px 内径里塞三个字符会让描边与数字互相挤压，移到环外后字号回到 12px
 * （与同行「目录」同级），`tabular-nums` 让数字换位时不抖动。
 *
 * 只读取真实滚动位置，不做插值动画：数字与环永远描述同一时刻。
 * 环本身 `aria-hidden`，百分比以普通文本呈现——它不播报，
 * 否则每滚一行都会打断读屏用户。
 */
const SIZE = 26
const STROKE = 2
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ReadingProgressRing({ targetId, className }: ReadingProgressRingProps) {
  const [percent, setPercent] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return

    const update = () => {
      frame.current = 0
      const rect = target.getBoundingClientRect()
      const contentTop = window.scrollY + rect.top
      setPercent(
        progressPercent(
          computeReadingProgress({
            scrollY: window.scrollY,
            viewportHeight: window.innerHeight,
            contentTop,
            contentHeight: rect.height,
          }),
        ),
      )
    }

    const schedule = () => {
      if (frame.current) return
      frame.current = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame.current) window.cancelAnimationFrame(frame.current)
    }
  }, [targetId])

  const offset = CIRCUMFERENCE * (1 - percent / 100)

  return (
    <div
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
      data-reading-progress={percent}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="shrink-0 -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--edge)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-150"
        />
      </svg>
      <span className="text-meta leading-none font-medium tracking-[-0.02em] text-[var(--text-secondary)] tabular-nums">
        {percent}%
      </span>
    </div>
  )
}

/**
 * 竖向线性阅读进度条（桌面端右栏用）
 *
 * 参考 Shiro 的 ReadIndicatorVertical：一条竖向进度线 + 底部百分比数字。
 * 高度由容器决定（默认 48px），进度条填充 accent 色从底部上升。
 * 与环形进度共用同一套 scroll 监听和计算逻辑。
 */
export function ReadingProgressBar({ targetId, className }: ReadingProgressRingProps) {
  const [percent, setPercent] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return

    const update = () => {
      frame.current = 0
      const rect = target.getBoundingClientRect()
      const contentTop = window.scrollY + rect.top
      setPercent(
        progressPercent(
          computeReadingProgress({
            scrollY: window.scrollY,
            viewportHeight: window.innerHeight,
            contentTop,
            contentHeight: rect.height,
          }),
        ),
      )
    }

    const schedule = () => {
      if (frame.current) return
      frame.current = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame.current) window.cancelAnimationFrame(frame.current)
    }
  }, [targetId])

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      data-reading-progress={percent}
    >
      {/* 竖向进度线：底色 edge，填充色 accent，高度 2rem */}
      <div className="relative h-[2rem] w-px overflow-hidden bg-[var(--edge)]">
        <div
          className="absolute bottom-0 left-0 w-full bg-[var(--accent)] motion-safe:transition-[height] motion-safe:duration-150"
          style={{ height: `${percent}%` }}
        />
      </div>
      <span className="text-meta leading-none font-medium tracking-[-0.02em] text-[var(--text-secondary)] tabular-nums">
        {percent}%
      </span>
    </div>
  )
}
