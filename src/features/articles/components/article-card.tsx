import Link from 'next/link'
import type { Article } from '@/lib/api'
import { CoverImage } from '@/components/ui/cover-image'
import { articlePath, tagPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'
import { formatCompact } from '@/lib/utils/date'

interface ArticleCardProps {
  article: Article
  timeZone: string
  /** lead 用于首页主推；card 用于相关阅读 */
  variant?: 'lead' | 'card'
  priority?: boolean
}

export function ArticleCard({ article, timeZone, variant = 'card', priority }: ArticleCardProps) {
  const href = articlePath(article.category?.slug, article.slug)
  const titleClass =
    variant === 'lead'
      ? 'text-title leading-[1.28]'
      : 'text-h3 leading-[1.4]'

  return (
    <article className="group flex flex-col">
      {article.cover && href ? (
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block overflow-hidden">
          <CoverImage
            src={article.cover.src}
            alt=""
            width={article.cover.width}
            height={article.cover.height}
            priority={priority}
            className={cn(
              'w-full transition-transform duration-[600ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.012]',
              variant === 'lead' ? 'aspect-[16/9]' : 'aspect-[16/10]',
            )}
          />
        </Link>
      ) : null}

      <div className={cn(article.cover ? 'mt-4' : 'mt-0')}>
        <p className="meta">
          {article.category ? (
            <Link href={`/categories/${encodeURIComponent(article.category.slug)}`} className="link-quiet">
              {article.category.name}
            </Link>
          ) : null}
          <time className={article.category ? 'meta-sep' : undefined} dateTime={article.createdAt}>
            {formatCompact(article.createdAt, timeZone)}
          </time>
        </p>

        <h3 className={cn('mt-2 font-serif text-[var(--text-primary)]', titleClass)}>
          {href ? (
            <Link href={href} className="link-quiet">
              {article.title}
            </Link>
          ) : (
            article.title
          )}
        </h3>

        {article.summary ? (
          <p
            className={cn(
              'mt-2 text-small text-[var(--text-secondary)]',
              variant === 'card' ? 'line-clamp-3' : 'max-w-[var(--container-prose)]',
            )}
          >
            {article.summary}
          </p>
        ) : null}

        {variant === 'lead' && article.tags.length > 0 ? (
          <p className="meta mt-3 flex flex-wrap gap-x-2">
            {article.tags.map((tag) => (
              <Link key={tag} href={tagPath(tag)} className="link-quiet">
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
    </article>
  )
}
