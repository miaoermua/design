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
 * 顶栏工具按钮
 *
 * 「气泡」的落地方式不是四个独立风格的按钮，而是同一枚尺寸的圆形按钮：
 * 统一 40px 点击区域、统一圆角、统一冰面材质。材质来自 `.glass-control`
 * （material.css），组件只负责尺寸与状态——工具组未来要换位置或换组合，
 * 改的是工具组的排布，不是四个按钮各自的样式。
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
        'group/tt glass-control relative flex size-10 items-center justify-center rounded-full',
        'transition-colors duration-[var(--duration-fast)]',
        'outline-none focus-visible:outline focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-[var(--focus-ring-width)]',
        active
          ? 'text-[var(--accent-strong)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
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

/** 工具组容器：间距与竖向排列在这里定义，按钮本身不关心相邻元素 */
export function ToolbarGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2" role="group" aria-label="站点工具">
      {children}
    </div>
  )
}
