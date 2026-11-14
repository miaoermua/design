import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { LIST_PAGE_SIZE } from '@/core/config/site'
import { requireFeature } from '@/core/registry/guard'
import { ArticleRow } from '@/features/articles'
import { getSiteTimezone, listArticles } from '@/lib/api'
import { pageHref } from '@/lib/routes'

export const metadata: Metadata = {
  title: '文章',
  description: '按发布时间排列的全部文章。',
}

interface ArticlesPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  requireFeature('articles')

  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  const result = await listArticles({
    page,
    size: LIST_PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: -1,
  })

  return (
    <Container>
      <PageHeader
        kicker="文章"
        title="全部文章"
        description="长文与笔记，按发布时间从新到旧排列。"
        meta={
          <p className="meta">
            共 {result.pagination.total} 篇 · 第 {result.pagination.page} /{' '}
            {result.pagination.totalPages} 页
          </p>
        }
      />

      {result.items.length > 0 ? (
        <div className="border-t border-dashed border-[var(--edge-strong)]">
          <div className="divide-y divide-dashed divide-[var(--edge)]">
            {result.items.map((article) => (
              <ArticleRow key={article.id} article={article} timeZone={timeZone} withExcerpt />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="这一页没有文章"
          description={
            result.pagination.total > 0
              ? '请求的页码超出了范围，请回到第 1 页。'
              : '还没有发布任何文章。'
          }
        />
      )}

      <Pagination pagination={result.pagination} buildHref={(target) => pageHref('/articles', target)} />
    </Container>
  )
}
