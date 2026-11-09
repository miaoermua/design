import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border-line flex flex-col items-start gap-3 border border-dashed px-6 py-12">
      <p className="font-serif text-[1.0625rem] text-[var(--text-secondary)]">{title}</p>
      {description ? (
        <p className="text-meta text-[var(--text-tertiary)]">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
