import Link from 'next/link'
import type { Article } from '@/lib/api'
import { buildArticleExcerpt } from '@/lib/content/excerpt'
import { articlePath, categoryPath, tagPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'
import { formatCompact } from '@/lib/utils/date'

interface ArticleRowProps {
  article: Article
  timeZone: string
  /** 无日期栏的紧凑行（首页侧栏） */
  compact?: boolean
  /**
   * 一行正文概览的显式开关：只有 /articles（含分页）开启。
   * 首页、探索页、分类页、标签页的文章条目保持简洁，默认关闭，
   * 新增调用点不会意外多出一行。
   */
  withExcerpt?: boolean
}

/** 去重比较：忽略空白差异，避免把同一句话渲染两遍 */
function collapse(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

/**
 * 列表行：左侧日期、右侧标题、官方摘要；开启 withExcerpt 时多一行正文概览。
 * 只显示后端真实提供的计数；readCount 为 null 时整项不渲染。
 */
export function ArticleRow({
  article,
  timeZone,
  compact = false,
  withExcerpt = false,
}: ArticleRowProps) {
  const href = articlePath(article.category?.slug, article.slug)

  const summary = article.summary ?? ''
  // `text` 是列表返回的截断正文，与官方 summary 是两份独立数据
  const excerpt = withExcerpt && !compact ? buildArticleExcerpt(article.text) : ''
  const showExcerpt = excerpt.length > 0 && collapse(excerpt) !== collapse(summary)

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
          /* 官方摘要：作者手填的独立数据，语义与样式都不因正文概览而改变。
             只占一行：summary 长度不可控，用 line-clamp-1 而不是 JS 截断。 */
          <p
            data-excerpt="summary"
            className="mt-2.5 line-clamp-1 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]"
          >
            {article.summary}
          </p>
        ) : null}

        {showExcerpt ? (
          /* 正文概览：来源是列表 `text`（后端 truncate=310），清理 Markdown 后
             只占一行；不是 AI 摘要，也不是 summary 的替身。长度交给
             CSS line-clamp-1，中英文与标点都由浏览器排版后省略。 */
          <p
            data-excerpt="text"
            className="mt-2.5 line-clamp-1 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]"
          >
            {excerpt}
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
