'use client'

import { useEffect, useRef, useState } from 'react'
import { computeReadingProgress, progressPercent } from '@/lib/reading/progress'
import { cn } from '@/lib/utils/cn'

interface ReadingProgressRingProps {
  /** 正文元素 id：环的进度以这段内容的顶部/底部为口径 */
  targetId: string
  className?: string
}

const SIZE = 30
const STROKE = 2
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * 环形阅读进度。
 *
 * 只读取真实滚动位置，不做插值动画：数字与环永远描述同一时刻。
 * 环本身 `aria-hidden`，百分比以普通文本呈现——它不播报，
 * 否则每滚一行都会打断读屏用户。
 */
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
      className={cn('flex items-center gap-2 text-[var(--text-secondary)]', className)}
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
      <span className="text-meta tabular-nums">{percent}%</span>
    </div>
  )
}
