import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface PageHeaderProps {
  /** 小号引导词，例如「文章」「2026」 */
  kicker?: string | null
  title: string
  description?: string | null
  /** 标题下方的元信息（数量、筛选等） */
  meta?: ReactNode
  children?: ReactNode
  className?: string
}

/** 内页统一的编辑式页头：小引导词 + 衬线大标题 + 摘要 */
export function PageHeader({
  kicker,
  title,
  description,
  meta,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('pt-12 pb-8 sm:pt-16', className)}>
      {kicker ? (
        <p className="meta flex items-center gap-3">
          <span aria-hidden="true" className="h-px w-7 shrink-0 bg-[var(--accent-line)]" />
          {kicker}
        </p>
      ) : null}
      <h1 className="mt-4 font-serif text-title leading-[1.24] tracking-[-0.02em] text-[var(--text-heading)] sm:text-[calc(var(--text-display)*0.92)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 max-w-[var(--container-prose)] font-serif text-[1.0625rem] leading-[1.8] text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
      {meta ? <div className="mt-6">{meta}</div> : null}
      {children}
    </header>
  )
}

interface SectionHeadingProps {
  title: string
  /** 右侧动作（「全部 →」之类） */
  action?: ReactNode
  className?: string
}

export function SectionHeading({ title, action, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <h2 className="font-serif text-h2 text-[var(--text-heading)]">{title}</h2>
      {action}
    </div>
  )
}
