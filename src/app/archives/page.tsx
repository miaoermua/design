import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { getSiteTimezone, getTimeline, type Article, type Diary } from '@/lib/api'
import { articlePath, diaryPath } from '@/lib/routes'
import { formatMonthLabel, toDateTimeAttr } from '@/lib/utils/date'

export const metadata: Metadata = {
  title: '归档',
  description: '文章与日记合并成的时间轴，按年月排列。',
}

interface ArchiveEntry {
  key: string
  kind: '文章' | '日记'
  title: string
  date: string
  href: string | null
  day: string
}

interface MonthGroup {
  key: string
  label: string
  entries: ArchiveEntry[]
}

interface YearGroup {
  year: string
  count: number
  months: MonthGroup[]
}

/**
 * timeline 接口按年份过滤，但没有分页。
 * 这里一次取全量（文章 + 日记的标题级数据），以便给出完整年份索引；
 * 正文不会进入归档页，因此没有 Markdown 渲染成本。
 */
function buildYears(articles: Article[], diaries: Diary[], timeZone: string): YearGroup[] {
  const entries: ArchiveEntry[] = [
    ...articles.map((article) => {
      const attr = toDateTimeAttr(article.createdAt, timeZone)
      return {
        key: `post-${article.id}`,
        kind: '文章' as const,
        title: article.title,
        date: article.createdAt,
        href: articlePath(article.category?.slug, article.slug),
        day: attr.slice(8, 10),
      }
    }),
    ...diaries.map((diary) => {
      const attr = toDateTimeAttr(diary.publishedAt, timeZone)
      return {
        key: `note-${diary.id}`,
        kind: '日记' as const,
        title: diary.title,
        date: diary.publishedAt,
        href: diaryPath(diary.id),
        day: attr.slice(8, 10),
      }
    }),
  ]

  entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

  const yearMap = new Map<string, Map<string, MonthGroup>>()

  for (const entry of entries) {
    const attr = toDateTimeAttr(entry.date, timeZone)
    const year = attr.slice(0, 4)
    const monthKey = attr.slice(0, 7)

    const months = yearMap.get(year) ?? new Map<string, MonthGroup>()
    const month = months.get(monthKey) ?? {
      key: monthKey,
      label: formatMonthLabel(entry.date, timeZone),
      entries: [],
    }
    month.entries.push(entry)
    months.set(monthKey, month)
    yearMap.set(year, months)
  }

  return [...yearMap.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, months]) => {
      const monthGroups = [...months.values()]
      return {
        year,
        count: monthGroups.reduce((sum, month) => sum + month.entries.length, 0),
        months: monthGroups,
      }
    })
}

export default async function ArchivesPage() {
  requireFeature('archives')

  const timeZone = getSiteTimezone()
  const timeline = await getTimeline()
  const years = buildYears(timeline.articles, timeline.diaries, timeZone)
  const total = timeline.articles.length + timeline.diaries.length

  return (
    <Container>
      <PageHeader
        kicker="归档"
        title="时间轴"
        description="文章与日记共用一条时间轴：最近的月份在最上面。"
        meta={<p className="meta">共 {total} 条记录 · {years.length} 个年份</p>}
      />

      {years.length === 0 ? (
        <EmptyState title="归档还是空的" description="还没有可归档的文章或日记。" />
      ) : (
        <>
          {years.length > 1 ? (
            <nav aria-label="年份索引" className="meta flex flex-wrap gap-x-5 gap-y-2">
              {years.map((group) => (
                <a key={group.year} href={`#year-${group.year}`} className="link-quiet">
                  {group.year}（{group.count}）
                </a>
              ))}
            </nav>
          ) : null}

          {years.map((group) => (
            <section key={group.year} id={`year-${group.year}`} className="scroll-mt-24 pt-10">
              <h2 className="font-serif text-[2rem] leading-none text-[var(--text-heading)]">
                {group.year}
              </h2>

              {group.months.map((month) => (
                <div
                  key={month.key}
                  className="mt-8 grid gap-4 border-t border-dashed border-[var(--edge-strong)] pt-6 sm:grid-cols-[6rem_1fr] sm:gap-8"
                >
                  <p className="meta">{month.label}</p>
                  <ul className="flex flex-col gap-3">
                    {month.entries.map((entry) => (
                      <li key={entry.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <time className="meta tabular-nums" dateTime={entry.date}>
                          {entry.day}
                        </time>
                        <span className="text-meta text-[var(--text-tertiary)]">
                          {entry.kind}
                        </span>
                        {entry.href ? (
                          <Link
                            href={entry.href}
                            className="link-quiet font-serif text-body leading-[1.5]"
                          >
                            {entry.title}
                          </Link>
                        ) : (
                          <span className="font-serif text-body">{entry.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </Container>
  )
}
