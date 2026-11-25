import type { DiaryDayGroup } from '@/lib/api'
import { formatWeekday } from '@/lib/utils/date'
import { DiaryEntry } from './diary-entry'

interface DiaryDayGroupViewProps {
  group: DiaryDayGroup
  timeZone: string
}

/**
 * 一天 = 一节：左侧为大号日期，右侧为该天的所有片段。
 *
 * 日期栏宽度按内容定：日号最大两位（40px 字号下约 44px）、`2026.10` 约 56px，
 * 6rem 已经留足余量；原来是 7rem，再加上 2.5rem 栏间距，光左轨就吃掉 152px。
 * 栏间距收到 2rem 后，这一节的正文区比原来宽 24px，而日号与条目时间的视觉
 * 关系没变——日号仍贴着页面左缘，时间仍在同一列上逐条对齐。
 */
export function DiaryDayGroupView({ group, timeZone }: DiaryDayGroupViewProps) {
  const [year = '', month = '', day = ''] = group.date.split('-')
  const first = group.items[0]
  const headingId = `diary-day-${group.date}`

  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-5 border-t border-dashed border-[var(--edge-strong)] py-10 sm:grid-cols-[6rem_1fr] sm:gap-8"
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
          <p className="meta text-[var(--text-secondary)]">
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
