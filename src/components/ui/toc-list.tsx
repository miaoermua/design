'use client'

import { useEffect, useRef, useState } from 'react'
import type { TocItem } from '@/lib/content/markdown'
import { cn } from '@/lib/utils/cn'

interface TocListProps {
  items: TocItem[]
  variant: 'rail' | 'inline'
}

/**
 * 目录列表（客户端增强）
 *
 * 静态 HTML 由服务端输出，滚动监听只是增强：
 *   1. 用 rAF 节流的 scroll 读取标题位置，标出当前位置所在小节；
 *   2. 触底时把最后一节标为当前（短小节在视口底部常常到不了顶部）；
 *   3. 没有 JS 时列表仍然可点、可读，只是没有高亮。
 */
export function TocList({ items, variant }: TocListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const frame = useRef(0)

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null)

    if (headings.length === 0) return

    const update = () => {
      frame.current = 0
      const offset = 96
      let current = headings[0]?.id ?? null

      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - offset > 0) break
        current = heading.id
      }

      const reachedBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8
      if (reachedBottom) current = headings[headings.length - 1]?.id ?? current

      setActiveId(current)
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
  }, [items])

  const isRail = variant === 'rail'

  return (
    <ul className={cn(isRail ? 'border-l border-[var(--edge)]' : 'mt-3 space-y-0.5')}>
      {items.map((item) => {
        const active = item.id === activeId
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active ? 'location' : undefined}
              className={cn(
                'relative block py-1.5 pr-2 text-caption leading-[1.5] transition-colors duration-[var(--duration-fast)]',
                item.depth === 3 ? 'pl-6' : 'pl-4',
                active
                  ? 'text-[var(--text-heading)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 bottom-0.5 -left-px w-px bg-[var(--accent)]"
                />
              ) : null}
              {item.text}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
