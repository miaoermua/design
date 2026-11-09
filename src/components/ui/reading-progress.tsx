'use client'

import { useEffect, useState } from 'react'

/**
 * 阅读进度：页面顶部一条 2px 细线。
 * 只读取真实滚动位置，不做任何平滑动画之外的视觉修饰。
 */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return

    const update = () => {
      const rect = target.getBoundingClientRect()
      const start = window.scrollY + rect.top
      const total = rect.height - window.innerHeight
      if (total <= 0) {
        setProgress(rect.bottom <= window.innerHeight ? 1 : 0)
        return
      }
      const current = (window.scrollY - start) / total
      setProgress(Math.min(1, Math.max(0, current)))
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [targetId])

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent"
      role="presentation"
    >
      <div
        className="h-full origin-left bg-[var(--accent)] opacity-70 motion-safe:transition-transform motion-safe:duration-150"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  )
}
