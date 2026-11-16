import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ContainerProps {
  children: ReactNode
  className?: string
  /** wide：列表与导航；prose：正文；narrow：日记 */
  width?: 'wide' | 'prose' | 'narrow'
}

const widthClass = {
  wide: 'max-w-[var(--container-wide)]',
  prose: 'max-w-[calc(var(--measure-copy)+4rem)]',
  narrow: 'max-w-[var(--container-narrow)]',
} as const

export function Container({ children, className, width = 'wide' }: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-[var(--spacing-gutter)]',
        widthClass[width],
        className,
      )}
    >
      {children}
    </div>
  )
}
