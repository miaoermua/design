import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listCategories, listTags, type Tag } from '@/lib/api'
import { categoryPath, tagPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: '标签',
  description: '按分类与标签浏览文章。',
}

/** 用相对频次决定字号，而不是凭感觉给每个标签写死大小 */
function tagSizeClass(tag: Tag, maxCount: number): string {
  if (tag.count === null || maxCount <= 0) return 'text-[1rem]'
  const ratio = tag.count / maxCount
  if (ratio > 0.6) return 'text-[1.25rem]'
  if (ratio > 0.3) return 'text-[1.0625rem]'
  return 'text-[0.9375rem]'
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
        description="标签按文章数从多到少排列，右侧数字是该标签下的文章数。"
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
          <ul className="grid gap-x-12 sm:grid-cols-2">
            {sortedTags.map((tag) => (
              <li key={tag.name}>
                <Link
                  href={tagPath(tag.name)}
                  className="group flex items-center gap-3 border-b border-dashed border-[var(--edge)] py-3"
                >
                  <span
                    className={cn(
                      'shrink-0 font-serif leading-[1.4] text-[var(--text-heading)] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--accent-strong)]',
                      tagSizeClass(tag, maxCount),
                    )}
                  >
                    #{tag.name}
                  </span>
                  {tag.count !== null ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="mt-1 h-px flex-1 border-b border-dotted border-[var(--edge-strong)]"
                      />
                      <span className="text-meta tabular-nums text-[var(--text-secondary)]">
                        {tag.count} 篇
                      </span>
                    </>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
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
                  <span className="shrink-0 font-serif text-[1.125rem] leading-[1.4] text-[var(--text-heading)] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--accent-strong)]">
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
