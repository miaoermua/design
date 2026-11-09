import Link from 'next/link'
import type { Pagination as PaginationModel } from '@/lib/api'
import { cn } from '@/lib/utils/cn'

interface PaginationProps {
  pagination: PaginationModel
  /** 由调用方决定 URL 形状（保留现有查询参数） */
  buildHref: (page: number) => string
  prevLabel?: string
  nextLabel?: string
  className?: string
}

/**
 * 分页：只依赖后端返回的 hasNext/hasPrev 与 totalPage，
 * 不猜测总数、不生成超出范围的页码。
 */
export function Pagination({
  pagination,
  buildHref,
  prevLabel = '上一页',
  nextLabel = '下一页',
  className,
}: PaginationProps) {
  if (pagination.totalPages <= 1) return null

  const linkClass = 'link-quiet text-small text-[var(--text-secondary)]'
  const disabledClass = 'text-small text-[var(--text-tertiary)]'

  return (
    <nav
      aria-label="分页"
      className={cn(
        'mt-10 flex items-center justify-between gap-4 border-t border-[var(--edge)] pt-5',
        className,
      )}
    >
      {pagination.hasPrev ? (
        <Link href={buildHref(pagination.page - 1)} rel="prev" className={linkClass}>
          ← {prevLabel}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          ← {prevLabel}
        </span>
      )}

      <p className="meta">
        第 {pagination.page} / {pagination.totalPages} 页
        {pagination.total > 0 ? ` · 共 ${pagination.total} 篇` : null}
      </p>

      {pagination.hasNext ? (
        <Link href={buildHref(pagination.page + 1)} rel="next" className={linkClass}>
          {nextLabel} →
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {nextLabel} →
        </span>
      )}
    </nav>
  )
}
