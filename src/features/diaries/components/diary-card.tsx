import Link from 'next/link'
import type { Diary } from '@/lib/api'
import { t } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { diaryPath } from '@/lib/routes'
import { formatCompact } from '@/lib/utils/date'
import { excerpt } from '@/lib/utils/text'

interface DiaryCardProps {
  diary: Diary
  timeZone: string
}

/** 首页用的轻量摘要：不渲染完整 Markdown，只取纯文本前两行 */
export async function DiaryCard({ diary, timeZone }: DiaryCardProps) {
  const locale = await getLocale()
  const preview = diary.hasPassword ? null : excerpt(diary.content, 80)
  const chips = [diary.mood, diary.weather].filter((chip): chip is string => Boolean(chip))

  return (
    <article className="flex h-full flex-col">
      <p className="meta">
        <time dateTime={diary.publishedAt}>{formatCompact(diary.publishedAt, timeZone)}</time>
        {chips.length > 0 ? <span className="meta-sep">{chips.join(' · ')}</span> : null}
      </p>
      <h3 className="mt-2 font-serif text-h3 leading-[1.4] text-[var(--text-heading)]">
        <Link href={diaryPath(diary.id)} className="link-quiet">
          {diary.title}
        </Link>
      </h3>
      {diary.hasPassword ? (
        <p className="meta mt-2">{t(locale, 'diary.protectedTitle')}</p>
      ) : preview ? (
        <p className="text-small mt-2 line-clamp-2 max-w-[var(--measure-note)] text-[var(--text-secondary)]">
          {preview}
        </p>
      ) : null}
    </article>
  )
}
