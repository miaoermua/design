import Link from 'next/link'
import type { Diary } from '@/lib/api'
import { CoverImage } from '@/components/ui/cover-image'
import { Prose } from '@/components/ui/prose'
import { renderMarkdown } from '@/lib/content/markdown'
import { diaryPath } from '@/lib/routes'
import { formatTime } from '@/lib/utils/date'

interface DiaryEntryProps {
  diary: Diary
  timeZone: string
}

/** 日记条目：以时间为轴，正文沿用同一套排版（紧凑变体） */
export async function DiaryEntry({ diary, timeZone }: DiaryEntryProps) {
  const rendered = !diary.hasPassword && diary.content.trim() ? await renderMarkdown(diary.content) : null
  const chips = [diary.mood, diary.weather, diary.location, diary.topic?.name].filter(
    (chip): chip is string => Boolean(chip),
  )

  return (
    <article className="grid gap-2 sm:grid-cols-[3.75rem_1fr] sm:gap-5">
      <time className="meta leading-[1.9]" dateTime={diary.publishedAt}>
        {formatTime(diary.publishedAt, timeZone)}
      </time>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-serif text-h3 text-[var(--text-primary)]">
            <Link href={diaryPath(diary.id)} className="link-quiet">
              {diary.title}
            </Link>
          </h3>
          {chips.length > 0 ? <p className="meta">{chips.join(' · ')}</p> : null}
          {diary.bookmark ? <p className="meta">收藏</p> : null}
        </div>

        {diary.hasPassword ? (
          <p className="mt-2 text-small text-[var(--text-secondary)]">
            这篇日记受密码保护。
            <Link
              href={diaryPath(diary.id)}
              className="link-quiet underline decoration-[var(--color-accent-soft)] decoration-1 underline-offset-[0.25em]"
            >
              输入密码阅读 →
            </Link>
          </p>
        ) : rendered ? (
          <Prose html={rendered.html} className="prose--compact mt-3" />
        ) : null}

        {diary.images.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {diary.images.map((image) =>
              image.kind === 'video' ? (
                <video
                  key={image.src}
                  src={image.src}
                  controls
                  preload="metadata"
                  className="aspect-[4/3] w-full bg-[var(--surface-sunk)] object-cover"
                />
              ) : (
                <CoverImage
                  key={image.src}
                  src={image.src}
                  alt={`${diary.title} 配图`}
                  width={image.width}
                  height={image.height}
                  className="aspect-[4/3] w-full border border-[var(--edge)]"
                />
              ),
            )}
          </div>
        ) : null}

        <p className="meta mt-3">
          <Link href={diaryPath(diary.id)} className="link-quiet">
            永久链接
          </Link>
          {diary.readCount !== null ? (
            <span className="meta-sep">{diary.readCount.toLocaleString('zh-CN')} 次阅读</span>
          ) : null}
        </p>
      </div>
    </article>
  )
}
