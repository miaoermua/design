import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listCategories, listTags, type Tag } from '@/lib/api'
import { categoryPath, tagPath } from '@/lib/routes'

export const metadata: Metadata = {
  title: '标签',
  description: '按分类与标签浏览文章。',
}

/** 用相对频次决定字号，而不是凭感觉给每个标签写死大小 */
function tagSizeClass(tag: Tag, maxCount: number): string {
  if (tag.count === null || maxCount <= 0) return 'text-body'
  const ratio = tag.count / maxCount
  if (ratio > 0.6) return 'text-[1.375rem]'
  if (ratio > 0.3) return 'text-[1.125rem]'
  return 'text-small'
}

export default async function TagsPage() {
  requireFeature('taxonomy')

  const [tags, categories] = await Promise.all([listTags(), listCategories()])
  const sortedTags = [...tags].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'zh-CN'),
  )
  const maxCount = sortedTags.reduce((max, tag) => Math.max(max, tag.count ?? 0), 0)

  return (
    <Container>
      <PageHeader
        kicker="标签"
        title="按主题翻阅"
        description="标签按文章数从多到少排列，数字是该标签下的文章数。"
        meta={
          <p className="meta">
            {sortedTags.length} 个标签 · {categories.length} 个分类
          </p>
        }
      />

      <section aria-labelledby="tag-list">
        <h2 id="tag-list" className="meta">
          标签
        </h2>
        {sortedTags.length > 0 ? (
          <ul className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-4">
            {sortedTags.map((tag) => (
              <li key={tag.name} className="flex items-baseline gap-1.5">
                <Link
                  href={tagPath(tag.name)}
                  className={`link-quiet font-serif text-[var(--text-primary)] ${tagSizeClass(tag, maxCount)}`}
                >
                  #{tag.name}
                </Link>
                {tag.count !== null ? (
                  <span className="text-meta tabular-nums text-[var(--text-tertiary)]">
                    {tag.count} 篇
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5">
            <EmptyState title="还没有标签" description="文章还没打上任何标签。" />
          </div>
        )}
      </section>

      <section className="mt-16 border-t border-dashed border-[var(--edge-strong)] pt-8" aria-labelledby="category-list">
        <h2 id="category-list" className="meta">
          分类
        </h2>
        {categories.length > 0 ? (
          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {categories.map((category) => (
              <li key={category.id} className="flex items-baseline justify-between gap-4">
                <Link
                  href={categoryPath(category.slug)}
                  className="link-quiet font-serif text-h3 text-[var(--text-primary)]"
                >
                  {category.name}
                </Link>
                {category.count !== null ? (
                  <span className="meta tabular-nums">{category.count}</span>
                ) : null}
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
