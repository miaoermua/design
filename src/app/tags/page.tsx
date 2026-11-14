import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { TagNoteList } from '@/features/taxonomy'
import { listCategories, listTags } from '@/lib/api'
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
export const metadata: Metadata = {
  title: '标签',
  description: '按分类与标签浏览文章。',
}

export default async function TagsPage() {
  requireFeature('taxonomy')

  const [tags, categories] = await Promise.all([listTags(), listCategories()])
  const sortedTags = [...tags].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'zh-CN'),
  )

  return (
    <Container>
      <PageHeader
        kicker="标签"
        title="按主题翻阅"
        description="标签按文章数从多到少排列，名字后面的数字是该标签下的文章数。"
        meta={
          <p className="meta">
            {sortedTags.length} 个标签 · {categories.length} 个分类
          </p>
        }
      />

      <section aria-labelledby="tag-list">
        <h2 id="tag-list" className="meta border-b border-[var(--edge)] pb-3">
          标签
        </h2>
        {sortedTags.length > 0 ? (
          <TagNoteList tags={sortedTags} className="mt-5" />
        ) : (
          <div className="mt-5">
            <EmptyState title="还没有标签" description="文章还没打上任何标签。" />
          </div>
        )}
      </section>

      <section
        className="mt-16 border-t border-dashed border-[var(--edge-strong)] pt-8"
        aria-labelledby="category-list"
      >
        <h2 id="category-list" className="meta border-b border-[var(--edge)] pb-3">
          分类
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
                        {category.count} 篇
                      </span>
                    </>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5">
            <EmptyState title="还没有分类" description="文章还没有归入任何分类。" />
          </div>
        )}
      </section>
    </Container>
  )
}