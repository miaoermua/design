import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import type { Article, Diary } from '@/lib/api'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t, tf, type MessageKey } from '@/lib/i18n/dictionary'
import { articlePath, notePath } from '@/lib/routes'
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
  /** 存字典键而不是成品文案：语言在渲染处才确定 */
  kind: MessageKey
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
        kind: 'archive.kindPost' as const,
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
        kind: 'archive.kindNote' as const,
        title: diary.title,
        date: diary.publishedAt,
        // nid 缺失（适配器兜底为 0）时不产出链接：宁可条目不可点，
        // 也不要生成 /notes/0 这种注定 404 的地址
        href: Number.isInteger(diary.nid) && diary.nid > 0 ? notePath(diary.nid) : null,
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
  locale?: Locale
}

export function ArchiveSection({
  years,
  total,
  idPrefix = 'year',
  locale = DEFAULT_LOCALE,
}: ArchiveSectionProps) {
  if (years.length === 0) {
    return (
      <EmptyState
        title={t(locale, 'archive.emptyTitle')}
        description={t(locale, 'archive.emptyHint')}
      />
    )
  }

  return (
    <>
      <p className="meta">{tf(locale, 'archive.summary', { total, years: years.length })}</p>

      {years.length > 1 ? (
        <nav
          aria-label={t(locale, 'archive.yearIndex')}
          className="meta mt-4 flex flex-wrap gap-x-5 gap-y-2"
        >
          {years.map((group) => (
            <a key={group.year} href={`#${idPrefix}-${group.year}`} className="link-quiet">
              {group.year}（{group.count}）
            </a>
          ))}
        </nav>
      ) : null}

      {years.map((group, yearIndex) => (
        <section
          key={group.year}
          id={`${idPrefix}-${group.year}`}
          className={cn(
            'scroll-mt-28',
            yearIndex === 0
              ? 'pt-10'
              : 'mt-10 border-t border-dashed border-[var(--edge-strong)] pt-8',
          )}
        >
          <h3 className="font-serif text-[1.75rem] leading-none text-[var(--text-heading)]">
            {group.year}
          </h3>

          {group.months.map((month) => (
            <div key={month.key} className="mt-6 grid gap-3 sm:grid-cols-[5.5rem_1fr] sm:gap-7">
              <p className="meta">{month.label}</p>
              <ul className="flex flex-col gap-2.5">
                {month.entries.map((entry) => (
                  <li key={entry.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time className="meta tabular-nums" dateTime={entry.date}>
                      {entry.day}
                    </time>
                    <span className="text-meta text-[var(--text-secondary)]">
                      {t(locale, entry.kind)}
                    </span>
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        className="link-quiet text-body font-serif leading-[1.5]"
                      >
                        {entry.title}
                      </Link>
                    ) : (
                      <span className="text-body font-serif">{entry.title}</span>
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
              <span className="text-meta ml-1.5 align-middle text-[var(--text-secondary)] tabular-nums">
                {tag.count}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
