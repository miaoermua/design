import type { DiaryDayGroup } from '@/lib/api'
import { formatDate } from '@/lib/utils/date'
import { DiaryEntry } from './diary-entry'

interface DiaryDayGroupViewProps {
  group: DiaryDayGroup
  timeZone: string
}

/**
 * 一天 = 一节。
 *
 * 这一节在视觉上不再有自己的标题：日期已经下放到每条的元信息行（参考稿就是
 * 「日期 · 分类 → 标题 → 摘要」的单行结构）。这里保留 `<section>` 与 `sr-only`
 * 的 h2，是为了不让分组在无障碍树里消失——读屏用户仍然能按天跳读，
 * 而视觉上得到一条连续的纵向时间流。
 *
 * 竖线由列表容器统一画（见 `/notes/list`），这里不自己画：每组各画一段会在
 * 组间距处断开，时间线就退化成一排短横线。
 */
export function DiaryDayGroupView({ group, timeZone }: DiaryDayGroupViewProps) {
  const first = group.items[0]
  const headingId = `diary-day-${group.date}`

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {first ? formatDate(first.publishedAt, timeZone) : group.date}
      </h2>

      <div className="flex flex-col gap-10">
        {group.items.map((diary) => (
          <DiaryEntry key={diary.id} diary={diary} timeZone={timeZone} />
        ))}
      </div>
    </section>
  )
}
