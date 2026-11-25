import Link from 'next/link'
import type { Article } from '@/lib/api'
import { buildArticleExcerpt } from '@/lib/content/excerpt'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { articlePath, categoryPath, tagPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'
import { formatCompact } from '@/lib/utils/date'

interface ArticleRowProps {
  article: Article
  timeZone: string
  /** 无日期栏的紧凑行（首页侧栏） */
  compact?: boolean
  /**
   * 首页单列索引行：只留标题 + 日期，去掉分类/标签/阅读数/摘要。
   * ≥sm 日期贴右缘、与标题同基线（账目式索引）；<sm 日期落到标题下方。
   * 行间距交给首页列表的 gap 统一节奏。
   */
  minimal?: boolean
  /**
   * 一行正文概览的显式开关：只有 /articles（含分页）开启。
   * 首页、探索页、分类页、标签页的文章条目保持简洁，默认关闭，
   * 新增调用点不会意外多出一行。
   */
  withExcerpt?: boolean
  locale?: Locale
}

/** 去重比较：忽略空白差异，避免把同一句话渲染两遍 */
function collapse(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

/**
 * 列表行：标题在上，摘要在下，日期与分类 / 标签 / 阅读数同处一条元信息行。
 * 只显示后端真实提供的计数；readCount 为 null 时整项不渲染。
 *
 * 桌面端**不再给日期留独立栏位**：日期文本实测只有 65px，却要占掉 152px 的
 * 横向空间（`sm:grid-cols-[7.5rem_1fr]` 的 120px 栏 + `sm:gap-8` 的 32px），
 * 标题与摘要因此被挤窄。日期并入元信息行后，文本直接用满整行宽度；
 * 首页 `minimal` 索引行（日期贴右、与标题同基线）是另一套设计，不受影响。
 */
export function ArticleRow({
  article,
  timeZone,
  compact = false,
  minimal = false,
  withExcerpt = false,
  locale = DEFAULT_LOCALE,
}: ArticleRowProps) {
  const href = articlePath(article.category?.slug, article.slug)

  /* ── minimal 模式：首页单列索引行，只有标题 + 日期 ────────────── */
  if (minimal) {
    return (
      <article className="group flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h3 className="text-rowtitle min-w-0 font-serif text-[var(--text-heading)]">
          {href ? (
            <Link href={href} className="link-quiet">
              {article.title}
            </Link>
          ) : (
            <span>{article.title}</span>
          )}
        </h3>
        <p className="meta shrink-0 transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--text-secondary)]">
          <time dateTime={article.createdAt}>{formatCompact(article.createdAt, timeZone)}</time>
        </p>
      </article>
    )
  }

  const summary = article.summary ?? ''
  // `text` 是列表返回的截断正文，与官方 summary 是两份独立数据
  const excerpt = withExcerpt && !compact ? buildArticleExcerpt(article.text) : ''
  const showExcerpt = excerpt.length > 0 && collapse(excerpt) !== collapse(summary)

  return (
    <article className={cn('group', compact ? 'py-5 first:pt-0 last:pb-0' : 'py-6')}>
      <div className="min-w-0">
        <h3
          className={cn(
            'font-serif text-[var(--text-heading)]',
            compact ? 'text-h3 leading-[1.45]' : 'text-rowtitle',
          )}
        >
          {href ? (
            <Link href={href} className="link-quiet">
              {article.title}
            </Link>
          ) : (
            <span title={t(locale, 'article.noCategory')}>{article.title}</span>
          )}
        </h3>

        {article.summary && !compact ? (
          /* 官方摘要：作者手填的独立数据，语义与样式都不因正文概览而改变。
             只占一行：summary 长度不可控，用 line-clamp-1 而不是 JS 截断。 */
          <p
            data-excerpt="summary"
            className="mt-2.5 line-clamp-1 max-w-[var(--measure-copy)] text-small text-[var(--text-secondary)]"
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
            className="mt-2.5 line-clamp-1 max-w-[var(--measure-copy)] text-small text-[var(--text-secondary)]"
          >
            {excerpt}
          </p>
        ) : null}

        {/* 元信息行：日期 → 分类 → 标签 → 阅读数。
            桌面用 `·` 把四类信息分开（点打在分类、首个标签、阅读数上）；
            窄屏由 `article-row.css` 撤掉点、改用更宽的栏距，避免换行后
            `·` 落在行首像列表符号。 */}
        <div className="meta article-row-meta mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-2.5">
          <time dateTime={article.createdAt}>{formatCompact(article.createdAt, timeZone)}</time>
          {article.category ? (
            <Link
              href={categoryPath(article.category.slug)}
              className="meta-sep text-[var(--accent-strong)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-heading)]"
            >
              {article.category.name}
            </Link>
          ) : null}
          {!compact
            ? article.tags.map((tag, index) => (
                /* 标签平铺成一个个独立的 flex 项，不套一层会内部换行的容器：
                   窄屏时容器一旦自成一行，第二行会从容器左缘重新排，
                   `#跨平台` 那种段落式断口就是这么来的。平铺后只在标签之间换行。 */
                <Link
                  key={tag}
                  href={tagPath(tag)}
                  className={cn(
                    'text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-heading)]',
                    index === 0 && 'meta-sep',
                  )}
                >
                  {`#${tag}`}
                </Link>
              ))
            : null}
          {article.readCount !== null ? (
            <span className="meta-sep text-[var(--text-secondary)]">
              {tf(locale, 'meta.readCount', {
                count: article.readCount.toLocaleString(locale),
              })}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
