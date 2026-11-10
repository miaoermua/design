import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { Prose } from '@/components/ui/prose'
import { Rule } from '@/components/ui/rule'
import { requireFeature } from '@/core/registry/guard'
import { getDiary, getSiteTimezone, isNotFound, isPasswordRequired, type Diary } from '@/lib/api'
import { renderMarkdown } from '@/lib/content/markdown'
import { diaryPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'
import { formatDate, formatTime, formatWeekday } from '@/lib/utils/date'
import { excerpt } from '@/lib/utils/text'

interface DiaryPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ password?: string }>
}

/** 日记 id 是雪花 ID：非数字直接当 404，别把后端 400 make 成 500 */
function isDiaryId(value: string): boolean {
  return /^\d+$/.test(value)
}

export async function generateMetadata({ params }: DiaryPageProps): Promise<Metadata> {
  const { id } = await params
  if (!isDiaryId(id)) notFound()
  try {
    const diary = await getDiary(id)
    return {
      title: diary.title,
      description: excerpt(diary.content, 120) || undefined,
      openGraph: { type: 'article', title: diary.title, publishedTime: diary.publishedAt },
    }
  } catch (error) {
    // 404 要在 metadata 阶段抛，否则流式布局会先发出 200（软 404）
    if (isNotFound(error)) notFound()
    return { title: isPasswordRequired(error) ? '受保护的日记' : '日记' }
  }
}

/** 密码门槛：不通过时不渲染任何正文，也不把 403 当成「内容不存在」 */
function PasswordGate({ id, wrong }: { id: string; wrong: boolean }) {
  return (
    <Container width="narrow">
      <div className="py-24">
        <p className="meta">日记</p>
        <h1 className="mt-3 font-serif text-title text-[var(--text-heading)]">
          这篇日记受密码保护
        </h1>
        <p className="mt-3 text-small text-[var(--text-secondary)]">
          {wrong ? '密码不正确，或后端仍未通过校验。' : '输入作者设置的密码后可以阅读。'}
        </p>

        <form action={diaryPath(id)} method="get" className="mt-8 flex gap-3">
          <label htmlFor="password" className="sr-only">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="off"
            className="min-w-0 flex-1 border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-2 text-small text-[var(--text-heading)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="border border-[var(--text-primary)] bg-[var(--text-primary)] px-4 py-2 text-small text-[var(--surface)]"
          >
            阅读
          </button>
        </form>

        <p className="meta mt-4">密码不会保存在主题侧，每次访问都需要重新带上。</p>
        <Link href="/diaries" className="link-quiet meta mt-8 inline-block">
          ← 全部日记
        </Link>
      </div>
    </Container>
  )
}

export default async function DiaryPage({ params, searchParams }: DiaryPageProps) {
  requireFeature('diaries')

  const { id } = await params
  const { password } = await searchParams
  if (!isDiaryId(id)) notFound()

  let diary: Diary
  try {
    diary = await getDiary(id, password)
  } catch (error) {
    if (isNotFound(error)) notFound()
    if (isPasswordRequired(error)) return <PasswordGate id={id} wrong={Boolean(password)} />
    throw error
  }

  const timeZone = getSiteTimezone()
  const isMarkdown = diary.contentFormat === 'markdown'
  const rendered = isMarkdown && diary.content.trim() ? await renderMarkdown(diary.content) : null
  const chips = [diary.mood, diary.weather, diary.location, diary.topic?.name].filter(
    (chip): chip is string => Boolean(chip),
  )

  return (
    <Container width="wide">
      <article className="reading-sheet mx-auto mt-10 w-full max-w-[calc(var(--container-prose)+7rem)] sm:mt-14">
        <header>
          <p className="meta flex flex-wrap items-center gap-x-1">
            <Link href="/diaries" className="link-quiet">
              日记
            </Link>
            <time className="meta-sep" dateTime={diary.publishedAt}>
              {formatDate(diary.publishedAt, timeZone)}
            </time>
            <span className="meta-sep">{formatWeekday(diary.publishedAt, timeZone)}</span>
            <span className="meta-sep">{formatTime(diary.publishedAt, timeZone)}</span>
          </p>

          <h1 className="mt-4 font-serif text-title leading-[1.28] text-[var(--text-heading)]">
            {diary.title}
          </h1>

          <p className="meta mt-3 flex flex-wrap items-center gap-x-1">
            {chips.length > 0 ? <span>{chips.join(' · ')}</span> : null}
            {diary.bookmark ? <span className="meta-sep">收藏</span> : null}
          </p>
        </header>

        <Rule className="my-8" />

        {rendered ? (
          <Prose html={rendered.html} />
        ) : (
          <div className="border border-dashed border-[var(--edge)] px-5 py-6">
            <p className="text-small text-[var(--text-heading)]">
              这篇日记的正文格式是「{diary.contentFormat}」。
            </p>
            <p className="mt-2 text-caption text-[var(--text-secondary)]">
              Folio 目前只渲染 Markdown，因此不展示结构化 JSON 原文。
            </p>
          </div>
        )}

        {diary.images.length > 0 ? (
          <div
            className={cn(
              'mt-8 grid gap-2',
              diary.images.length === 1
                ? 'max-w-[26rem] grid-cols-1'
                : 'grid-cols-2 sm:grid-cols-3',
            )}
          >
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

        <footer className="mt-14 border-t border-dashed border-[var(--edge-strong)] pt-6">
          <p className="meta flex flex-wrap items-center gap-x-1">
            {diary.readCount !== null ? (
              <span>{diary.readCount.toLocaleString('zh-CN')} 次阅读</span>
            ) : null}
            {diary.likeCount !== null ? (
              <span className="meta-sep">{diary.likeCount.toLocaleString('zh-CN')} 次喜欢</span>
            ) : null}
            {diary.modifiedAt && diary.modifiedAt !== diary.publishedAt ? (
              <span className="meta-sep">更新于 {formatDate(diary.modifiedAt, timeZone)}</span>
            ) : null}
          </p>
          <Link href="/diaries" className="link-quiet meta mt-5 inline-block">
            ← 全部日记
          </Link>
        </footer>
      </article>
    </Container>
  )
}
