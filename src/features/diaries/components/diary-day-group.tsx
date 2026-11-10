import type { DiaryDayGroup } from '@/lib/api'
import { formatWeekday } from '@/lib/utils/date'
import { DiaryEntry } from './diary-entry'

interface DiaryDayGroupViewProps {
  group: DiaryDayGroup
  timeZone: string
}

/** 一天 = 一节：左侧为大号日期，右侧为该天的所有片段 */
export function DiaryDayGroupView({ group, timeZone }: DiaryDayGroupViewProps) {
  const [year = '', month = '', day = ''] = group.date.split('-')
  const first = group.items[0]
  const headingId = `diary-day-${group.date}`

  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-5 border-t border-dashed border-[var(--edge-strong)] py-10 sm:grid-cols-[7rem_1fr] sm:gap-10"
    >
      <header className="sm:sticky sm:top-24 sm:self-start">
        <h2
          id={headingId}
          className="font-serif text-[2.5rem] leading-none tabular-nums text-[var(--text-heading)]"
        >
          {Number(day)}
        </h2>
        <p className="meta mt-2 tabular-nums">
          {year}.{month}
        </p>
        {first ? (
          <p className="meta text-[var(--text-tertiary)]">
            {formatWeekday(first.publishedAt, timeZone)}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-9">
        {group.items.map((diary) => (
          <DiaryEntry key={diary.id} diary={diary} timeZone={timeZone} />
        ))}
      </div>
    </section>
  )
}
