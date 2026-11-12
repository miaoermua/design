'use client'

import { cn } from '@/lib/utils/cn'

interface BackToTopProps {
  label?: string
  className?: string
}

/**
 * 回到顶部：图标 + 文字，内联在阅读辅助区里。
 *
 * 不做固定在右下角的浮标：那个位置会盖住正文与移动端操作栏，
 * 而「回到顶部」是阅读辅助，不该比正文更抢眼。
 * 平滑滚动只在用户没有要求减少动效时启用。
 */
export function BackToTop({ label = '回到顶部', className }: BackToTopProps) {
  const handleClick = () => {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group text-meta inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-heading)] focus-visible:outline focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[var(--focus-ring-color)]',
        className,
      )}
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
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
      <span>{label}</span>
    </button>
  )
}
