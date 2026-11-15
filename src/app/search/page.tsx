import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { requireFeature } from '@/core/registry/guard'
import { getSiteTimezone, searchArticles } from '@/lib/api'
import { sanitizeSnippet } from '@/lib/content/snippet'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { articlePath, diaryPath, pageHref } from '@/lib/routes'
import { formatCompact } from '@/lib/utils/date'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'search.title'),
    description: t(locale, 'search.pageDescription'),
    robots: { index: false, follow: true },
  }
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  requireFeature('search')

  const { q, page: pageParam } = await searchParams
  const locale = await getLocale()
  const keyword = (q ?? '').trim()
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  const result = keyword ? await searchArticles(keyword, { page, size: 10 }) : null

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'search.kicker')}
        title={t(locale, 'search.heading')}
        description={t(locale, 'search.pageIntro')}
      >
        <form
          action="/search"
          method="get"
          role="search"
          className="mt-8 flex max-w-[var(--container-prose)] items-center gap-3 border border-[var(--edge-strong)] bg-[var(--reading-surface)] px-4 py-2.5 transition-colors duration-[var(--duration-fast)] focus-within:border-[var(--accent)]"
        >
          <label htmlFor="q" className="sr-only">
            {t(locale, 'search.keyword')}
          </label>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-[1.15rem] shrink-0 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={keyword}
            autoComplete="off"
            placeholder={t(locale, 'search.placeholderLong')}
            className="min-w-0 flex-1 bg-transparent py-1 font-serif text-[1.125rem] leading-[1.6] text-[var(--text-heading)] outline-none placeholder:font-sans placeholder:text-[0.9375rem] placeholder:text-[var(--text-secondary)]"
          />
          <kbd className="meta hidden shrink-0 border border-[var(--edge)] px-1.5 py-0.5 text-[var(--text-secondary)] sm:block">
            Enter
          </kbd>
          <button
            type="submit"
            className="meta shrink-0 text-[var(--accent-strong)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-heading)]"
          >
            {t(locale, 'search.submit')}
          </button>
        </form>
      </PageHeader>

      {result ? (
        <>
          <p className="text-small text-[var(--text-secondary)]">
            {tf(locale, 'search.hitSummary', {
              keyword,
              total: result.pagination.total,
            })}
            {result.items.length > 0
              ? ` · ${tf(locale, 'pagination.position', {
                  page: result.pagination.page,
                  pages: result.pagination.totalPages,
                })}`
              : null}
          </p>

          {result.items.length > 0 ? (
            <ul className="mt-8 divide-y divide-dashed divide-[var(--edge)] border-t border-dashed border-[var(--edge-strong)]">
              {result.items.map((hit) => {
                // 搜索是文章 + 日记混合流：文章靠 category/slug，日记靠 id
                const href =
                  hit.kind === 'post'
                    ? articlePath(hit.categorySlug, hit.slug ?? '')
                    : diaryPath(hit.id)
                return (
                  <li key={hit.id} className="group py-6">
                    <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        {t(locale, hit.kind === 'post' ? 'search.kindPost' : 'search.kindNote')}
                      </span>
                      <time className="meta-sep" dateTime={hit.createdAt}>
                        {formatCompact(hit.createdAt, timeZone)}
                      </time>
                      {hit.categoryName || hit.categorySlug ? (
                        <span className="meta-sep text-[var(--accent-strong)]">
                          {hit.categoryName ?? hit.categorySlug}
                        </span>
                      ) : null}
                    </p>
                    <h2 className="mt-1.5 font-serif text-h3 leading-[1.4] text-[var(--text-heading)]">
                      {href ? (
                        <Link href={href} className="link-quiet">
                          {hit.title}
                        </Link>
                      ) : (
                        hit.title
                      )}
                    </h2>
                    {hit.snippet ? (
                      <p
                        className="search-snippet mt-2 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]"
                        // 只保留后端插入的 <mark>，其余标签在 sanitizeSnippet 中被剥离
                        dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippet) }}
                      />
                    ) : null}
                    {!href ? (
                      <p className="meta mt-2">{t(locale, 'search.missingCategory')}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={t(locale, 'search.noMatchTitle')}
                description={
                  result.pagination.total > 0
                    ? t(locale, 'search.outOfRange')
                    : t(locale, 'search.noMatchHint')
                }
              />
            </div>
          )}

          <Pagination
            pagination={result.pagination}
            locale={locale}
            buildHref={(target) => pageHref('/search', target, { q: keyword })}
          />
        </>
      ) : (
        <div className="mt-10 flex items-center gap-3 border-t border-dashed border-[var(--edge)] pt-6">
          <span aria-hidden="true" className="size-1.5 rotate-45 bg-[var(--accent-soft)]" />
          <p className="meta">{t(locale, 'search.prompt')}</p>
        </div>
      )}
    </Container>
  )
}
