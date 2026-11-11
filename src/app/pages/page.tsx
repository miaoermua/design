import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listPages } from '@/lib/api'
import { t } from '@/lib/i18n/dictionary'
import { toContentLang } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/server'
import { pagePath } from '@/lib/routes'
import { formatDate } from '@/lib/utils/date'

export const metadata: Metadata = {
  title: '页面',
  description: '不进入时间轴的常驻页面。',
}

/**
 * Pages 列表
 *
 * Pages 是 Mix Space 的独立页面（`/pages`），与 Blogs / Notes 并列而不同：
 * 没有分类、没有标签、不进入归档时间轴、通常长期不变（关于、站点说明、赞助等）。
 * 因此它有自己的导航入口，而不是塞进文章列表或页脚。
 */
export default async function PagesListPage() {
  requireFeature('pages')

  const locale = await getLocale()
  const result = await listPages({ lang: toContentLang(locale) })

  // 后端按 order 给出排序权重；没有 order 的排到末尾，再按更新时间倒序
  const pages = [...result.items].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  })

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'pages.kicker')}
        title={t(locale, 'pages.title')}
        description={t(locale, 'pages.description')}
        meta={pages.length > 0 ? <p className="meta">共 {pages.length} 个页面</p> : null}
      />

      {pages.length > 0 ? (
        <ul className="border-t border-dashed border-[var(--edge-strong)]">
          {pages.map((page) => (
            <li key={page.id} className="border-b border-dashed border-[var(--edge)]">
              <Link
                href={pagePath(page.slug)}
                className="group flex flex-col gap-1.5 py-6 sm:flex-row sm:items-baseline sm:gap-8"
              >
                <span className="meta shrink-0 tabular-nums sm:w-[7.5rem]">
                  {page.updatedAt ? formatDate(page.updatedAt, 'Asia/Shanghai') : '—'}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-h3 leading-[1.4] text-[var(--text-heading)] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--accent-strong)]">
                    {page.title}
                  </span>
                  {page.subtitle ? (
                    <span className="mt-1.5 block max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]">
                      {page.subtitle}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t(locale, 'pages.empty')}
          description="后端 /pages 返回了空列表（不是加载失败）。"
        />
      )}
    </Container>
  )
}