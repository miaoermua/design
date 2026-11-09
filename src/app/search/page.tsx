import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { requireFeature } from '@/core/registry/guard'
import { getSiteTimezone, searchArticles } from '@/lib/api'
import { sanitizeSnippet } from '@/lib/content/snippet'
import { articlePath, diaryPath, pageHref } from '@/lib/routes'
import { formatCompact } from '@/lib/utils/date'

export const metadata: Metadata = {
  title: '搜索',
  description: '按关键词搜索站内文章。',
  robots: { index: false, follow: true },
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  requireFeature('search')

  const { q, page: pageParam } = await searchParams
  const keyword = (q ?? '').trim()
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  const result = keyword ? await searchArticles(keyword, { page, size: 10 }) : null

  return (
    <Container>
      <PageHeader
        kicker="搜索"
        title="找一篇文章"
        description="一次搜索同时覆盖文章与日记。"
      >
        <form action="/search" method="get" role="search" className="mt-8 flex items-end gap-3 border-b border-[var(--text-primary)] pb-2">
          <label htmlFor="q" className="sr-only">
            关键词
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={keyword}
            autoComplete="off"
            placeholder="输入关键词，回车搜索"
            className="min-w-0 flex-1 bg-transparent py-2 font-serif text-h3 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <button type="submit" className="meta shrink-0 pb-2">
            搜索
          </button>
        </form>
      </PageHeader>

      {result ? (
        <>
          <p className="meta">
            “{keyword}” 命中 {result.pagination.total} 条
            {result.items.length > 0
              ? ` · 第 ${result.pagination.page} / ${result.pagination.totalPages} 页`
              : null}
          </p>

          {result.items.length > 0 ? (
            <ul className="mt-8 divide-y divide-dashed divide-[var(--edge)] border-t border-dashed border-[var(--edge-strong)]">
              {result.items.map((hit) => {
                // 搜索是文章 + 日记混合流：文章靠 category/slug，日记靠 id
                const href =
                  hit.kind === 'post'
                    ? articlePath(hit.categorySlug, hit.slug ?? '')
                    : diaryPath(hit.id)
                return (
                  <li key={hit.id} className="py-6">
                    <p className="meta">
                      <time dateTime={hit.createdAt}>{formatCompact(hit.createdAt, timeZone)}</time>
                      {hit.categoryName || hit.categorySlug ? (
                        <span className="meta-sep">{hit.categoryName ?? hit.categorySlug}</span>
                      ) : null}
                    </p>
                    <h2 className="mt-1.5 font-serif text-h3 leading-[1.4] text-[var(--text-primary)]">
                      {href ? (
                        <Link href={href} className="link-quiet">
                          {hit.title}
                        </Link>
                      ) : (
                        hit.title
                      )}
                    </h2>
                    {hit.snippet ? (
                      <p
                        className="search-snippet mt-2 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]"
                        // 只保留后端插入的 <mark>，其余标签在 sanitizeSnippet 中被剥离
                        dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippet) }}
                      />
                    ) : null}
                    {!href ? (
                      <p className="meta mt-2">这条结果缺少 category/slug，无法生成详情链接。</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-8">
              <EmptyState
                title="没有匹配的文章"
                description={
                  result.pagination.total > 0
                    ? '这一页超出了结果范围，请回到第 1 页。'
                    : '没有匹配的内容，换个关键词试试。'
                }
              />
            </div>
          )}

          <Pagination
            pagination={result.pagination}
            buildHref={(target) => pageHref('/search', target, { q: keyword })}
          />
        </>
      ) : (
        <p className="meta">输入关键词后回车开始搜索。</p>
      )}
    </Container>
  )
}
