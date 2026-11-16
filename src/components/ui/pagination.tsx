import Link from 'next/link'
import type { Pagination as PaginationModel } from '@/lib/api'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { cn } from '@/lib/utils/cn'

interface PaginationProps {
  pagination: PaginationModel
  /** 由调用方决定 URL 形状（保留现有查询参数） */
  buildHref: (page: number) => string
  locale?: Locale
  /** 覆写默认文案：日记列表用「更新的一页 / 更早的一页」表达时间方向 */
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
  locale = DEFAULT_LOCALE,
  prevLabel,
  nextLabel,
  className,
}: PaginationProps) {
  if (pagination.totalPages <= 1) return null

  const previous = prevLabel ?? t(locale, 'pagination.previous')
  const following = nextLabel ?? t(locale, 'pagination.next')
  const linkClass = 'link-quiet text-small text-[var(--text-secondary)]'
  const disabledClass = 'text-small text-[var(--text-tertiary)]'

  return (
    <nav
      aria-label={t(locale, 'pagination.label')}
      className={cn(
        'mt-10 flex items-center justify-between gap-4 border-t border-[var(--edge)] pt-5',
        className,
      )}
    >
      {pagination.hasPrev ? (
        <Link href={buildHref(pagination.page - 1)} rel="prev" className={linkClass}>
          ← {previous}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          ← {previous}
        </span>
      )}

      <p className="meta">
        {tf(locale, 'pagination.position', {
          page: pagination.page,
          pages: pagination.totalPages,
        })}
        {pagination.total > 0 ? tf(locale, 'pagination.total', { total: pagination.total }) : null}
      </p>

      {pagination.hasNext ? (
        <Link href={buildHref(pagination.page + 1)} rel="next" className={linkClass}>
          {following} →
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {following} →
        </span>
      )}
    </nav>
  )
}
