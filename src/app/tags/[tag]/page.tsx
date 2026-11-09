import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { requireFeature } from '@/core/registry/guard'
import { ArticleRow } from '@/features/articles'
import { getSiteTimezone, listArticlesByTag } from '@/lib/api'
import { pageHref, tagPath } from '@/lib/routes'

interface TagPageProps {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ page?: string }>
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params
  return {
    title: `#${decodeParam(tag)}`,
    description: `带有 ${decodeParam(tag)} 标签的文章。`,
  }
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  requireFeature('taxonomy')

  const [{ tag: rawTag }, query] = await Promise.all([params, searchParams])
  const tag = decodeParam(rawTag)
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  // 标签没有独立详情接口，v2 的 /posts 也不支持按 tag 过滤：
  // 仓库层会翻文章列表自己筛，未知标签得到空列表而不是 404
  const { tagName, result } = await listArticlesByTag(tag, { page, size: 10 })
  const { items, pagination } = result

  return (
    <Container>
      <PageHeader
        kicker="标签"
        title={`#${tagName}`}
        description={
          pagination.total > 0
            ? `带有该标签的文章，共 ${pagination.total} 篇。`
            : '这个标签下还没有文章。'
        }
        meta={
          <Link href={tagPath(tagName)} className="meta link-quiet">
            这个标签的固定链接
          </Link>
        }
      />

      {items.length > 0 ? (
        <div className="divide-y divide-dashed divide-[var(--edge)] border-t border-dashed border-[var(--edge-strong)]">
          {items.map((article) => (
            <ArticleRow key={article.id} article={article} timeZone={timeZone} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={page > 1 ? '这一页没有文章' : '这个标签下还没有文章'}
          description={
            page > 1 ? '页码超出了结果范围，请回到第 1 页。' : '这个标签下还没有文章。'
          }
        />
      )}

      <Pagination
        pagination={pagination}
        buildHref={(target) => pageHref(tagPath(tagName), target)}
      />

      <Link href="/tags" className="link-quiet meta mt-10 inline-block">
        ← 所有标签
      </Link>
    </Container>
  )
}
