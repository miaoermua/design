import Link from 'next/link'
import type { Article } from '@/lib/api'
import { articlePath, categoryPath, tagPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'
import { formatCompact } from '@/lib/utils/date'

interface ArticleRowProps {
  article: Article
  timeZone: string
  /** 无日期栏的紧凑行（首页侧栏） */
  compact?: boolean
}

/**
 * 列表行：左侧日期、右侧标题与摘要。
 * 只显示后端真实提供的计数；readCount 为 null 时整项不渲染。
 */
export function ArticleRow({ article, timeZone, compact = false }: ArticleRowProps) {
  const href = articlePath(article.category?.slug, article.slug)

  return (
    <article
      className={cn(
        'group grid gap-2',
        compact ? 'py-5 first:pt-0 last:pb-0' : 'py-8 sm:grid-cols-[7.5rem_1fr] sm:gap-8',
      )}
    >
      {compact ? null : (
        <p className="meta pt-1 leading-[1.7] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--text-secondary)]">
          <time dateTime={article.createdAt}>{formatCompact(article.createdAt, timeZone)}</time>
        </p>
      )}

      <div className="min-w-0">
        <h3
          className={cn(
            'font-serif text-[var(--text-heading)]',
            compact ? 'text-h3 leading-[1.45]' : 'text-[1.625rem] leading-[1.3] tracking-[-0.01em]',
          )}
        >
          {href ? (
            <Link href={href} className="link-quiet">
              {article.title}
            </Link>
          ) : (
            <span title="该文章没有分类，v2 详情路由无法生成链接">{article.title}</span>
          )}
        </h3>

        {article.summary && !compact ? (
          <p className="mt-2.5 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]">
            {article.summary}
          </p>
        ) : null}

        <div className="meta mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {compact ? (
            <time dateTime={article.createdAt}>{formatCompact(article.createdAt, timeZone)}</time>
          ) : null}
          {article.category ? (
            <Link
              href={categoryPath(article.category.slug)}
              className={cn(
                'text-[var(--accent-strong)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-heading)]',
                compact && 'meta-sep',
              )}
            >
              {article.category.name}
            </Link>
          ) : null}
          {!compact
            ? article.tags.map((tag) => (
                <Link
                  key={tag}
                  href={tagPath(tag)}
                  className="text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-heading)]"
                >
                  {`#${tag}`}
                </Link>
              ))
            : null}
          {article.readCount !== null ? (
            <span className="text-[var(--text-secondary)]">
              {article.readCount.toLocaleString('zh-CN')} 次阅读
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
