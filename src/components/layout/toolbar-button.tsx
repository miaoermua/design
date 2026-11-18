'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍名称，同时作为 Tooltip 文本 */
  label: string
  children: ReactNode
  /** 当前是否处于激活态（例如搜索面板打开） */
  active?: boolean
}

/**
 * 悬浮工具条按钮
 *
 * 外观不再是「三个独立冰面小圆」：材质已经上移到外面的 `.toolbar-dock`
 * 一整块玻璃上（与顶栏同一个 `.glass-nav` + 光斑层），这里只负责格子本身——
 * 尺寸、圆角、悬停浅底、激活洗底。三个按钮共用一套，不各自维护。
 *
 * 悬停/激活用的也是导航的语义 Token（`--nav-item-hover` / `--nav-item-active`），
 * 所以两块玻璃在鼠标经过时的反馈是同一个颜色，不出现「顶栏偏蓝、浮标偏灰」。
 *
 * Tooltip 用 CSS 实现（group-hover / group-focus-visible），
 * 不引入 JS 定位库：它只需要在桌面端显示一行文字，且必须能被键盘触达
 * （focus-visible 时同样显示，否则纯键盘用户永远看不到提示）。
 * 移动端不显示 Tooltip——那里没有 hover 语义，`aria-label` 已经够了。
 */
export function ToolbarButton({
  label,
  children,
  active,
  className,
  ...props
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-active={active ? 'true' : undefined}
      className={cn(
        'group/tt relative flex size-[2.1875rem] items-center justify-center rounded-[var(--radius-pill)]',
        'transition-colors duration-[var(--duration-fast)]',
        'outline-none focus-visible:outline focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-[var(--focus-ring-width)]',
        active
          ? 'bg-[var(--nav-item-active)] text-[var(--nav-item-active-ink)]'
          : 'text-[var(--nav-ink)] hover:bg-[var(--nav-item-hover)] hover:text-[var(--nav-ink-strong)]',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 right-[calc(100%+0.5rem)] z-10 -translate-y-1/2',
          'hidden rounded-[var(--radius-xs)] border border-[var(--edge)] whitespace-nowrap',
          'text-meta bg-[var(--surface-raised)] px-2 py-1 text-[var(--text-secondary)]',
          'shadow-[var(--shadow-pop)]',
          // 只在桌面端显示：触屏没有 hover，且空间紧张
          'sm:group-hover/tt:block sm:group-focus-visible/tt:block',
        )}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * 工具组容器：三个格子竖排在玻璃胶囊里。
 *
 * `relative z-[1]` 是必须的：玻璃层是 `inset: 0` 的定位元素，会盖住同一
 * 层叠上下文里未定位的内容，按钮必须抬到它上面才点得到。
 */
export function ToolbarGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="relative z-[1] flex flex-col items-center gap-1"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  )
}
