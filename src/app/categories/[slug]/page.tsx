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
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
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
  const [category, locale] = await Promise.all([getCategoryBySlug(decodeParam(slug)), getLocale()])
  // 404 要在 metadata 阶段抛：根布局是流式的，等正文再抛时状态码已是 200
  if (!category) notFound()
  return {
    title: category.name,
    description: tf(locale, 'category.description', { name: category.name }),
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  requireFeature('taxonomy')

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()
  const locale = await getLocale()

  const category = await getCategoryBySlug(decodeParam(slug))
  if (!category) notFound()

  // 用 /posts?categoryIds= 分页，而不是 /categories/:slug 的 children：
  // 后者会把整分类的文章一次性吐回来，无法分页。
  const result = await listArticles({
    categoryIds: [category.id],
    page,
    size: 10,
    lang: toContentLang(locale),
  })
  const { items, pagination } = result

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'categories.kicker')}
        title={category.name}
        description={
          pagination.total > 0
            ? tf(locale, 'category.summary', { total: pagination.total })
            : t(locale, 'category.empty')
        }
        meta={
          category.count !== null && category.count !== pagination.total ? (
            <p className="meta">
              {tf(locale, 'category.stats', {
                count: category.count,
                total: pagination.total,
              })}
            </p>
          ) : null
        }
      />

      {items.length > 0 ? (
        <div className="divide-y divide-dashed divide-[var(--edge)] border-t border-dashed border-[var(--edge-strong)]">
          {items.map((article) => (
            <ArticleRow key={article.id} article={article} timeZone={timeZone} locale={locale} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={page > 1 ? t(locale, 'category.emptyPage') : t(locale, 'category.empty')}
          description={
            page > 1 ? t(locale, 'category.emptyOutOfRange') : t(locale, 'category.emptyBackend')
          }
        />
      )}

      <Pagination
        pagination={pagination}
        locale={locale}
        buildHref={(target) => pageHref(categoryPath(category.slug), target)}
      />

      <div className="mt-10 flex gap-6">
        <Link href="/categories" className="link-quiet meta">
          {t(locale, 'category.backAll')}
        </Link>
        <Link href="/tags" className="link-quiet meta">
          {t(locale, 'category.allTags')}
        </Link>
      </div>
    </Container>
  )
}
