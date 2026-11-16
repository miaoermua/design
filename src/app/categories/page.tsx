import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listCategories } from '@/lib/api'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { categoryPath } from '@/lib/routes'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'categories.title'),
    description: t(locale, 'categories.description'),
  }
}

export default async function CategoriesPage() {
  requireFeature('taxonomy')

  const locale = await getLocale()
  const categories = await listCategories()

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'categories.kicker')}
        title={t(locale, 'categories.heading')}
        description={t(locale, 'categories.description')}
        meta={<p className="meta">{tf(locale, 'categories.count', { count: categories.length })}</p>}
      />

      {categories.length > 0 ? (
        <ul className="divide-y divide-dashed divide-[var(--edge)] border-t border-dashed border-[var(--edge-strong)]">
          {categories.map((category) => (
            <li key={category.id} className="flex items-baseline justify-between gap-4 py-5">
              <Link
                href={categoryPath(category.slug)}
                className="link-quiet font-serif text-title text-[var(--text-heading)]"
              >
                {category.name}
              </Link>
              {category.count !== null ? (
                <span className="meta tabular-nums">
                  {tf(locale, 'categories.countArticles', { count: category.count })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t(locale, 'categories.emptyTitle')}
          description={t(locale, 'categories.emptyHint')}
        />
      )}

      <Link href="/tags" className="link-quiet meta mt-10 inline-block">
        {t(locale, 'categories.viewTags')}
      </Link>
    </Container>
  )
}
