import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listCategories } from '@/lib/api'
import { categoryPath } from '@/lib/routes'

export const metadata: Metadata = {
  title: '分类',
  description: '按分类浏览文章。',
}

export default async function CategoriesPage() {
  requireFeature('taxonomy')

  const categories = await listCategories()

  return (
    <Container>
      <PageHeader
        kicker="分类"
        title="全部分类"
        description="分类由作者在 Mix Space 后台维护，主题不做重命名或合并。"
        meta={<p className="meta">{categories.length} 个分类</p>}
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
                <span className="meta tabular-nums">{category.count} 篇</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="还没有分类" description="后端返回的分类列表为空。" />
      )}

      <Link href="/tags" className="link-quiet meta mt-10 inline-block">
        查看标签 →
      </Link>
    </Container>
  )
}
