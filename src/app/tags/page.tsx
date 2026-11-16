import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { TagNoteList } from '@/features/taxonomy'
import { listCategories, listTags } from '@/lib/api'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { categoryPath } from '@/lib/routes'

/**
 * /tags —— 兼容路由
 *
 * 「标签」已并入 /explore（作为第二个 Tab）。这里保留原路由与原有版式：
 * 它承载的是「按主题浏览」的独立落地页，比 Tab 面板更宽松，也更适合被外部引用。
 *
 * 数据模型没有合并：标签来自 `/categories?type=1`，分类来自 `?type=0`，
 * 与 /explore 的标签分区调用的是同一组接口，但职责仍是各自独立的。
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'tags.title'),
    description: t(locale, 'tags.description'),
  }
}

export default async function TagsPage() {
  requireFeature('taxonomy')

  const locale = await getLocale()
  const [tags, categories] = await Promise.all([listTags(), listCategories()])
  const sortedTags = [...tags].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'zh-CN'),
  )

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'tags.kicker')}
        title={t(locale, 'tags.heading')}
        description={t(locale, 'tags.description')}
        meta={
          <p className="meta">
            {tf(locale, 'tags.summary', {
              tags: sortedTags.length,
              categories: categories.length,
            })}
          </p>
        }
      />

      <section aria-labelledby="tag-list">
        <h2 id="tag-list" className="meta border-b border-[var(--edge)] pb-3">
          {t(locale, 'tags.sectionTags')}
        </h2>
        {sortedTags.length > 0 ? (
          <TagNoteList tags={sortedTags} className="mt-5" locale={locale} />
        ) : (
          <div className="mt-5">
            <EmptyState
              title={t(locale, 'tags.emptyTitle')}
              description={t(locale, 'tags.emptyHint')}
            />
          </div>
        )}
      </section>

      <section
        className="mt-16 border-t border-dashed border-[var(--edge-strong)] pt-8"
        aria-labelledby="category-list"
      >
        <h2 id="category-list" className="meta border-b border-[var(--edge)] pb-3">
          {t(locale, 'tags.sectionCategories')}
        </h2>
        {categories.length > 0 ? (
          <ul className="grid gap-x-12 sm:grid-cols-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={categoryPath(category.slug)}
                  className="group flex items-center gap-3 border-b border-dashed border-[var(--edge)] py-3"
                >
                  <span className="shrink-0 font-serif text-lead leading-[1.4] text-[var(--text-heading)] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--accent-strong)]">
                    {category.name}
                  </span>
                  {category.count !== null ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="mt-1 h-px flex-1 border-b border-dotted border-[var(--edge-strong)]"
                      />
                      <span className="text-meta tabular-nums text-[var(--text-secondary)]">
                        {tf(locale, 'categories.countArticles', { count: category.count })}
                      </span>
                    </>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5">
            <EmptyState
              title={t(locale, 'tags.categoriesEmptyTitle')}
              description={t(locale, 'tags.categoriesEmptyHint')}
            />
          </div>
        )}
      </section>
    </Container>
  )
}