import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { requireFeature } from '@/core/registry/guard'
import { ArticleRow } from '@/features/articles'
import { getCategoryBySlug, getSiteTimezone, listArticles } from '@/lib/api'
import { categoryPath, pageHref } from '@/lib/routes'

interface CategoryPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(decodeParam(slug))
  // 404 要在 metadata 阶段抛：根布局是流式的，等正文再抛时状态码已是 200
  if (!category) notFound()
  return { title: category.name, description: `${category.name} 分类下的文章。` }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  requireFeature('taxonomy')

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  const category = await getCategoryBySlug(decodeParam(slug))
  if (!category) notFound()

  // 用 /posts?categoryIds= 分页，而不是 /categories/:slug 的 children：
  // 后者会把整分类的文章一次性吐回来，无法分页。
  const result = await listArticles({ categoryIds: [category.id], page, size: 10 })
  const { items, pagination } = result

  return (
    <Container>
      <PageHeader
        kicker="分类"
        title={category.name}
        description={
          pagination.total > 0
            ? `该分类下的文章，共 ${pagination.total} 篇。`
            : '这个分类下还没有文章。'
        }
        meta={
          category.count !== null && category.count !== pagination.total ? (
            <p className="meta">
              后端统计：{category.count} 篇；分页合计：{pagination.total} 篇
            </p>
          ) : null
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
          title={page > 1 ? '这一页没有文章' : '这个分类下还没有文章'}
          description={
            page > 1 ? '页码超出了结果范围，请回到第 1 页。' : '后端分页接口返回了空数组。'
          }
        />
      )}

      <Pagination
        pagination={pagination}
        buildHref={(target) => pageHref(categoryPath(category.slug), target)}
      />

      <div className="mt-10 flex gap-6">
        <Link href="/categories" className="link-quiet meta">
          ← 全部分类
        </Link>
        <Link href="/tags" className="link-quiet meta">
          所有标签 →
        </Link>
      </div>
    </Container>
  )
}
