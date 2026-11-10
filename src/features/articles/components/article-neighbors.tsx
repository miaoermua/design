import Link from 'next/link'
import type { Article } from '@/lib/api'
import { articlePath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'

interface ArticleNeighborsProps {
  /** 较新的一篇（按 createdAt 倒序时位于当前文章之前） */
  newer: Article | null
  older: Article | null
}

/**
 * 上下篇
 *
 * v2 没有相邻文章接口：数据来自 /posts?sortBy=createdAt&sortOrder=-1&size=50。
 * 若当前文章不在这 50 条之内，就不展示对应方向，而不是猜一个「最接近」的标题。
 */
export function ArticleNeighbors({ newer, older }: ArticleNeighborsProps) {
  const newerHref = newer ? articlePath(newer.category?.slug, newer.slug) : null
  const olderHref = older ? articlePath(older.category?.slug, older.slug) : null

  if (!newerHref && !olderHref) return null

  return (
    <nav
      aria-label="相邻文章"
      className="mt-12 grid gap-px border border-[var(--edge)] bg-[var(--edge)] sm:grid-cols-2"
    >
      <NeighborLink
        href={newerHref}
        article={newer}
        direction="newer"
        label="较新的文章"
        emptyLabel="已经是最新一篇"
        empty={!newerHref}
      />
      <NeighborLink
        href={olderHref}
        article={older}
        direction="older"
        label="较早的文章"
        emptyLabel="已经是最早一篇"
        empty={!olderHref}
        alignEnd
      />
    </nav>
  )
}

interface NeighborLinkProps {
  href: string | null
  article: Article | null
  direction: 'newer' | 'older'
  label: string
  emptyLabel: string
  empty: boolean
  alignEnd?: boolean
}

function NeighborLink({
  href,
  article,
  direction,
  label,
  emptyLabel,
  empty,
  alignEnd,
}: NeighborLinkProps) {
  const arrow = direction === 'newer' ? '←' : '→'

  if (empty || !href || !article) {
    return (
      <div className={cn('bg-[var(--reading-surface)] px-5 py-5', alignEnd && 'sm:text-right')}>
        <p className="meta text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-1.5 text-small text-[var(--text-tertiary)]">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'group block bg-[var(--reading-surface)] px-5 py-5 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)]',
        alignEnd && 'sm:text-right',
      )}
    >
      <p className="meta text-[var(--text-secondary)]">
        <span aria-hidden="true" className="mr-1.5 inline-block text-[var(--accent)]">
          {arrow}
        </span>
        {label}
      </p>
      <p className="mt-1.5 font-serif text-h3 leading-[1.45] text-[var(--text-heading)]">
        {article.title}
      </p>
    </Link>
  )
}
