import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import type { Article, Diary } from '@/lib/api'
import { articlePath, diaryPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'
import { formatMonthLabel, toDateTimeAttr } from '@/lib/utils/date'

/**
 * 归档区块
 *
 * 这是「探索」页的一个分区，不再自带页头与容器——
 * 因为它与标签区块共用同一个页面壳，容器由 /explore 提供。
 * 旧的 /archives 路由仍然渲染它，只是外面多套一层页头。
 */

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

export interface YearGroup {
  year: string
  count: number
  months: MonthGroup[]
}

/**
 * timeline 接口按年份过滤，但没有分页。
 * 这里一次取全量（文章 + 日记的标题级数据），以便给出完整年份索引；
 * 正文不会进入归档页，因此没有 Markdown 渲染成本。
 */
export function buildYears(articles: Article[], diaries: Diary[], timeZone: string): YearGroup[] {
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

interface ArchiveSectionProps {
  years: YearGroup[]
  total: number
  /** 年份锚点前缀：同一页面上有多个区块时避免 id 冲突 */
  idPrefix?: string
}

export function ArchiveSection({ years, total, idPrefix = 'year' }: ArchiveSectionProps) {
  if (years.length === 0) {
    return <EmptyState title="归档还是空的" description="还没有可归档的文章或日记。" />
  }

  return (
    <>
      <p className="meta">共 {total} 条记录 · {years.length} 个年份</p>

      {years.length > 1 ? (
        <nav aria-label="年份索引" className="meta mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {years.map((group) => (
            <a key={group.year} href={`#${idPrefix}-${group.year}`} className="link-quiet">
              {group.year}（{group.count}）
            </a>
          ))}
        </nav>
      ) : null}

      {years.map((group) => (
        <section key={group.year} id={`${idPrefix}-${group.year}`} className="scroll-mt-28 pt-10">
          <h3 className="font-serif text-[1.75rem] leading-none text-[var(--text-heading)]">
            {group.year}
          </h3>

          {group.months.map((month) => (
            <div
              key={month.key}
              className="mt-7 grid gap-3 border-t border-dashed border-[var(--edge-strong)] pt-5 sm:grid-cols-[5.5rem_1fr] sm:gap-7"
            >
              <p className="meta">{month.label}</p>
              <ul className="flex flex-col gap-2.5">
                {month.entries.map((entry) => (
                  <li key={entry.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time className="meta tabular-nums" dateTime={entry.date}>
                      {entry.day}
                    </time>
                    <span className="text-meta text-[var(--text-tertiary)]">{entry.kind}</span>
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
  )
}

/** 标签字号：按相对频次决定，避免给每个标签写死大小 */
export function tagSizeClass(count: number | null, maxCount: number): string {
  if (count === null || maxCount <= 0) return 'text-body'
  const ratio = count / maxCount
  if (ratio > 0.6) return 'text-h2'
  if (ratio > 0.3) return 'text-lead'
  return 'text-small'
}

interface TagClusterProps {
  tags: { name: string; count: number | null }[]
  className?: string
}

/** 标签云：只负责排布，链接与语义仍由页面决定 */
export function TagCluster({ tags, className }: TagClusterProps) {
  const maxCount = tags.reduce((max, tag) => Math.max(max, tag.count ?? 0), 0)

  return (
    <ul className={cn('flex flex-wrap items-baseline gap-x-5 gap-y-3', className)}>
      {tags.map((tag) => (
        <li key={tag.name}>
          <Link
            href={`/tags/${encodeURIComponent(tag.name)}`}
            className={cn(
              'link-quiet font-serif leading-[1.4] text-[var(--text-heading)]',
              tagSizeClass(tag.count, maxCount),
            )}
          >
            #{tag.name}
            {tag.count !== null ? (
              <span className="ml-1.5 align-middle text-meta tabular-nums text-[var(--text-tertiary)]">
                {tag.count}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}