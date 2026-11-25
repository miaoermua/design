import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { LIST_PAGE_SIZE } from '@/core/config/site'
import { requireFeature } from '@/core/registry/guard'
import { ArticleRow } from '@/features/articles'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { getSiteTimezone, listArticles } from '@/lib/api'
import { pageHref } from '@/lib/routes'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'articles.title'),
    description: t(locale, 'articles.description'),
  }
}

interface ArticlesPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  requireFeature('articles')

  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()
  const locale = await getLocale()

  const result = await listArticles({
    page,
    size: LIST_PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: -1,
  })

  return (
    <Container>
      <PageHeader
        title={t(locale, 'articles.title')}
        meta={
          <p className="meta">
            {tf(locale, 'meta.listSummary', {
              total: result.pagination.total,
              page: result.pagination.page,
              pages: result.pagination.totalPages,
            })}
          </p>
        }
      />

      {result.items.length > 0 ? (
        <div className="flex flex-col gap-4">
          {result.items.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              timeZone={timeZone}
              withExcerpt
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t(locale, 'articles.emptyTitle')}
          description={
            result.pagination.total > 0
              ? t(locale, 'articles.emptyOutOfRange')
              : t(locale, 'articles.emptyNone')
          }
        />
      )}

      <Pagination
        pagination={result.pagination}
        locale={locale}
        buildHref={(target) => pageHref('/articles', target)}
      />
    </Container>
  )
}
