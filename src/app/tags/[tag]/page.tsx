import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { requireFeature } from '@/core/registry/guard'
import { ArticleRow } from '@/features/articles'
import { getSiteTimezone, listArticlesByTag } from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
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
  const locale = await getLocale()
  return {
    title: `#${decodeParam(tag)}`,
    description: tf(locale, 'tag.description', { tag: decodeParam(tag) }),
  }
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  requireFeature('taxonomy')

  const [{ tag: rawTag }, query] = await Promise.all([params, searchParams])
  const tag = decodeParam(rawTag)
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()
  const locale = await getLocale()

  // 标签没有独立详情接口，v2 的 /posts 也不支持按 tag 过滤：
  // 仓库层会翻文章列表自己筛，未知标签得到空列表而不是 404
  const { tagName, result } = await listArticlesByTag(tag, {
    page,
    size: 10,
    lang: toContentLang(locale),
  })
  const { items, pagination } = result

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'tags.kicker')}
        title={`#${tagName}`}
        description={
          pagination.total > 0
            ? tf(locale, 'tag.summary', { total: pagination.total })
            : t(locale, 'tag.empty')
        }
        meta={
          <Link href={tagPath(tagName)} className="meta link-quiet">
            {t(locale, 'tag.permalink')}
          </Link>
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
          title={page > 1 ? t(locale, 'articles.emptyTitle') : t(locale, 'tag.empty')}
          description={page > 1 ? t(locale, 'category.emptyOutOfRange') : t(locale, 'tag.empty')}
        />
      )}

      <Pagination
        pagination={pagination}
        locale={locale}
        buildHref={(target) => pageHref(tagPath(tagName), target)}
      />

      <Link href="/tags" className="link-quiet meta mt-10 inline-block">
        {t(locale, 'tag.backAll')}
      </Link>
    </Container>
  )
}
