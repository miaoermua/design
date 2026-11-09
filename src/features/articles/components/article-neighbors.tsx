import Link from 'next/link'
import type { Article } from '@/lib/api'
import { articlePath } from '@/lib/routes'

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
      className="mt-16 grid gap-6 border-t border-dashed border-[var(--edge-strong)] pt-8 sm:grid-cols-2"
    >
      <div>
        {newer && newerHref ? (
          <Link href={newerHref} className="group block">
            <span className="meta">较新的文章</span>
            <span className="link-quiet mt-1 block font-serif text-h3 text-[var(--text-primary)]">
              {newer.title}
            </span>
          </Link>
        ) : null}
      </div>
      <div className="sm:text-right">
        {older && olderHref ? (
          <Link href={olderHref} className="group block">
            <span className="meta">较早的文章</span>
            <span className="link-quiet mt-1 block font-serif text-h3 text-[var(--text-primary)]">
              {older.title}
            </span>
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
