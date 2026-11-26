import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { ArchiveSection, ExploreTabs, buildYears, type ExploreTab } from '@/features/explore'
import { ArchiveFilter, type ArchiveFilterType } from '@/features/explore/components/archive-filter'
import { TagNoteList } from '@/features/taxonomy'
import { getSiteTimezone, getTimeline, listCategories, listTags } from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { categoryPath } from '@/lib/routes'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'explore.title'),
    description: t(locale, 'explore.pageDescription'),
  }
}

interface ExplorePageProps {
  searchParams: Promise<{ tab?: string; type?: string; memory?: string }>
}

/** 归一化 Tab 参数：未知值一律回到归档，避免出现空白面板 */
function toTab(value: string | undefined): ExploreTab {
  return value === 'tags' ? 'tags' : 'archives'
}

/** 归一化类型筛选参数 */
function toFilter(type?: string, memory?: string): ArchiveFilterType {
  if (memory === '1') return 'memory'
  if (type === 'post') return 'post'
  if (type === 'note') return 'note'
  return 'all'
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  requireFeature('archives')

  const [params, locale] = await Promise.all([searchParams, getLocale()])
  const active = toTab(params.tab)
  const filter = toFilter(params.type, params.memory)

  const timeZone = getSiteTimezone()

  // 两个分区的数据都在服务端取：切换 Tab 不再是「再请求一次」
  // 时间线只回标题，但标题也是内容，`?lang=` 必须跟着走
  const [timeline, tags, categories] = await Promise.all([
    getTimeline({ lang: toContentLang(locale) }),
    listTags(),
    listCategories(),
  ])

  // 按筛选类型过滤时间线数据
  const filteredArticles = filter === 'note' || filter === 'memory' ? [] : timeline.articles
  const filteredDiaries =
    filter === 'post'
      ? []
      : filter === 'memory'
        ? timeline.diaries.filter((d) => d.bookmark)
        : timeline.diaries

  const years = buildYears(filteredArticles, filteredDiaries, timeZone)
  const total = filteredArticles.length + filteredDiaries.length
  const sortedTags = [...tags].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'zh-CN'),
  )

  return (
    <Container>
      <PageHeader title={t(locale, 'explore.heading')} />

      <ExploreTabs
        active={active}
        label={t(locale, 'explore.modes')}
        labels={{
          archives: t(locale, 'explore.tabArchives'),
          tags: t(locale, 'explore.tabTags'),
        }}
        archives={
          <section aria-labelledby="explore-archives-heading">
            <h2 id="explore-archives-heading" className="sr-only">
              {t(locale, 'explore.archivesTitle')}
            </h2>
            <ArchiveFilter
              active={filter}
              label={t(locale, 'explore.filterLabel')}
              labels={{
                all: t(locale, 'explore.filterAll'),
                post: t(locale, 'explore.filterPosts'),
                note: t(locale, 'explore.filterNotes'),
                memory: t(locale, 'explore.filterMemories'),
              }}
            />
            <ArchiveSection years={years} total={total} idPrefix="explore-year" locale={locale} />
          </section>
        }
        tags={
          <div className="space-y-12">
            <section aria-labelledby="explore-tags-heading">
              <h2 id="explore-tags-heading" className="meta border-b border-[var(--edge)] pb-3">
                {t(locale, 'explore.tags')}
              </h2>
              {sortedTags.length > 0 ? (
                <TagNoteList tags={sortedTags} className="mt-4" locale={locale} />
              ) : (
                <div className="mt-5">
                  <EmptyState
                    title={t(locale, 'explore.noTags')}
                    description={t(locale, 'explore.noTagsHint')}
                  />
                </div>
              )}
            </section>

            <section aria-labelledby="explore-categories-heading">
              <h2
                id="explore-categories-heading"
                className="meta border-b border-[var(--edge)] pb-3"
              >
                {t(locale, 'explore.categories')}
              </h2>
              {categories.length > 0 ? (
                <ul className="mt-1 grid gap-x-12 sm:grid-cols-2">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={categoryPath(category.slug)}
                        className="group flex items-center gap-3 border-b border-dashed border-[var(--edge)] py-3"
                      >
                        <span className="text-lead shrink-0 font-serif leading-[1.4] text-[var(--text-heading)] transition-colors duration-[var(--duration-fast)] group-hover:text-[var(--accent-strong)]">
                          {category.name}
                        </span>
                        {category.count !== null ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="mt-1 h-px flex-1 border-b border-dotted border-[var(--edge-strong)]"
                            />
                            <span className="text-meta text-[var(--text-secondary)] tabular-nums">
                              {tf(locale, 'explore.countArticles', { count: category.count })}
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
                    title={t(locale, 'explore.noCategories')}
                    description={t(locale, 'explore.noCategoriesHint')}
                  />
                </div>
              )}
            </section>
          </div>
        }
      />
    </Container>
  )
}
