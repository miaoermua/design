import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { Prose } from '@/components/ui/prose'
import { ActionRail } from '@/components/reading/action-rail'
import { AiDisclosure } from '@/components/reading/ai-disclosure'
import { ArticleInfo } from '@/components/reading/article-info'
import { ReadingAside, ReadingInline } from '@/components/reading/reading-tools'
import { requireFeature } from '@/core/registry/guard'
import { getThemeConfig } from '@/core/config/theme'
import { readArticleInsights } from '@/features/ai-insights'
import { AISummaryCard, readArticleSummary } from '@/features/ai-summary'
import { CommentsSection } from '@/features/comments'
import { isDonateVisible, readDonateConfig } from '@/features/donate'
import { isInteractionEnabled, readSubscribeOptions } from '@/features/interactions'
import { getDiary, getSiteTimezone, isNotFound, isPasswordRequired, type Diary } from '@/lib/api'
import { absoluteUrl, loadSiteContext } from '@/lib/site'
import { inlineMediaSources } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'
import { toContentLang, type Locale } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
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
    const locale = await getLocale()
    return {
      title: isPasswordRequired(error)
        ? t(locale, 'diary.protectedTitle')
        : t(locale, 'diary.meta'),
    }
  }
}

/** 密码门槛：不通过时不渲染任何正文，也不把 403 当成「内容不存在」 */
function PasswordGate({ id, wrong, locale }: { id: string; wrong: boolean; locale: Locale }) {
  return (
    <Container width="narrow">
      <div className="py-24">
        <p className="meta">{t(locale, 'diary.meta')}</p>
        <h1 className="text-title mt-3 font-serif text-[var(--text-heading)]">
          {t(locale, 'diary.protectedHeading')}
        </h1>
        <p className="text-small mt-3 text-[var(--text-secondary)]">
          {wrong ? t(locale, 'diary.wrongPassword') : t(locale, 'diary.passwordHint')}
        </p>

        <form action={diaryPath(id)} method="get" className="mt-8 flex gap-3">
          <label htmlFor="password" className="sr-only">
            {t(locale, 'diary.password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="off"
            className="text-small min-w-0 flex-1 border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-2 text-[var(--text-heading)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="text-small border border-[var(--text-primary)] bg-[var(--text-primary)] px-4 py-2 text-[var(--surface)]"
          >
            {t(locale, 'diary.read')}
          </button>
        </form>

        <p className="meta mt-4">{t(locale, 'diary.passwordNote')}</p>
        <Link href="/diaries" className="link-quiet meta mt-8 inline-block">
          {t(locale, 'diary.backAll')}
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

  const locale = await getLocale()

  let diary: Diary
  try {
    diary = await getDiary(id, password)
  } catch (error) {
    if (isNotFound(error)) notFound()
    if (isPasswordRequired(error)) {
      return <PasswordGate id={id} wrong={Boolean(password)} locale={locale} />
    }
    throw error
  }

  const timeZone = getSiteTimezone()
  const isMarkdown = diary.contentFormat === 'markdown'
  const rendered =
    isMarkdown && diary.content.trim() ? await renderMarkdown(diary.content, locale) : null
  // core 的 `images` 是正文里抽出来的全部图片（`::: gallery` / `::: carousel`
  // 里的也在其中）。正文已经渲染过的不在文末再铺一遍，否则用相册的日记会把
  // 同一批图显示两次；这里只补正文里没出现过的附件。
  const inlineSources = rendered ? inlineMediaSources(rendered.html) : new Set<string>()
  const trailingImages = diary.images.filter((image) => !inlineSources.has(image.src))
  const chips = [diary.mood, diary.weather, diary.location, diary.topic?.name].filter(
    (chip): chip is string => Boolean(chip),
  )

  // 笔记同样只有 post/note 支持 AI 资源；受密码保护时正文为空，不请求
  const contentLang = toContentLang(locale)
  const [summary, insights] = await Promise.all([
    rendered ? readArticleSummary(diary.id, contentLang) : Promise.resolve(null),
    rendered
      ? readArticleInsights({
          id: diary.id,
          lang: contentLang,
          source: diary.content,
          toc: rendered.toc,
          locale,
        })
      : Promise.resolve(null),
  ])

  const { identity } = await loadSiteContext()
  const theme = await getThemeConfig()
  const subscribe = await readSubscribeOptions(theme.social)
  const donateConfig = readDonateConfig(theme)
  const donate = isDonateVisible(donateConfig)
    ? { label: donateConfig.label, qrcodes: donateConfig.qrcodes }
    : null
  const canonical = absoluteUrl(identity, diaryPath(diary.id))

  return (
    <Container width="wide">
      <div className="mx-auto mt-10 grid max-w-[calc(var(--container-diary)+7rem)] gap-10 sm:mt-14 xl:max-w-[var(--container-wide)] xl:grid-cols-[minmax(0,calc(var(--container-diary)+7rem))_13rem] xl:gap-x-9">
        <article
          id="diary-content"
          className="reading-sheet mx-auto w-full max-w-[calc(var(--container-diary)+7rem)] min-w-0 xl:col-start-1 xl:row-start-1"
        >
          <header>
            <p className="meta flex flex-wrap items-center gap-x-1">
              <Link href="/diaries" className="link-quiet">
                {t(locale, 'diary.meta')}
              </Link>
              <time className="meta-sep" dateTime={diary.publishedAt}>
                {formatDate(diary.publishedAt, timeZone)}
              </time>
              <span className="meta-sep">{formatWeekday(diary.publishedAt, timeZone)}</span>
              <span className="meta-sep">{formatTime(diary.publishedAt, timeZone)}</span>
            </p>

            <h1 className="text-title mt-4 font-serif leading-[1.28] text-[var(--text-heading)]">
              {diary.title}
            </h1>

            <p className="meta mt-3 flex flex-wrap items-center gap-x-1">
              {chips.length > 0 ? <span>{chips.join(' · ')}</span> : null}
              {diary.bookmark ? (
                <span className="meta-sep">{t(locale, 'diary.bookmark')}</span>
              ) : null}
            </p>
          </header>

          {summary ? <AISummaryCard key={diary.id} summary={summary} insights={insights} /> : null}

          <ReadingInline items={rendered?.toc ?? []} targetId="diary-content" />

          <div className="mt-8">
            {rendered ? (
              <Prose html={rendered.html} />
            ) : (
              <div className="border border-dashed border-[var(--edge)] px-5 py-6">
                <p className="text-small text-[var(--text-heading)]">
                  {tf(locale, 'diary.unsupportedFormat', { format: diary.contentFormat })}
                </p>
                <p className="text-caption mt-2 text-[var(--text-secondary)]">
                  {t(locale, 'diary.unsupportedFormatHint')}
                </p>
              </div>
            )}
          </div>

          {trailingImages.length > 0 ? (
            <div
              className={cn(
                'mt-8 grid gap-2',
                trailingImages.length === 1
                  ? 'max-w-[26rem] grid-cols-1'
                  : 'grid-cols-2 sm:grid-cols-3',
              )}
            >
              {trailingImages.map((image) =>
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
                    alt={tf(locale, 'diary.coverAlt', { title: diary.title })}
                    width={image.width}
                    height={image.height}
                    className="aspect-[4/3] w-full border border-[var(--edge)]"
                  />
                ),
              )}
            </div>
          ) : null}

          <AiDisclosure disclosure={diary.aiDisclosure} locale={locale} />

          <footer className="mt-14 border-t border-dashed border-[var(--edge-strong)] pt-6">
            <ArticleInfo
              title={diary.title}
              author={identity?.owner.name ?? null}
              url={canonical}
              publishedAt={diary.publishedAt}
              modifiedAt={diary.modifiedAt}
              timeZone={timeZone}
              locale={locale}
            />

            <p className="meta mt-6 flex flex-wrap items-center gap-x-1">
              {diary.readCount !== null ? (
                <span>
                  {tf(locale, 'meta.readCount', {
                    count: diary.readCount.toLocaleString('zh-CN'),
                  })}
                </span>
              ) : null}
              {diary.likeCount !== null ? (
                <span className="meta-sep">
                  {tf(locale, 'meta.likeCount', {
                    count: diary.likeCount.toLocaleString('zh-CN'),
                  })}
                </span>
              ) : null}
            </p>
            <Link href="/diaries" className="link-quiet meta mt-5 inline-block">
              {t(locale, 'diary.backAll')}
            </Link>
          </footer>
        </article>

        {/* 移动端跟在文末，桌面端落在右侧目录列表下方 */}
        <ReadingAside
          items={rendered?.toc ?? []}
          targetId="diary-content"
          actions={
            <ActionRail
              id={diary.id}
              type="Note"
              shareUrl={canonical}
              like={isInteractionEnabled()}
              subscribe={subscribe}
              donate={donate}
            />
          }
        />

        {/* 评论区在 grid 内左列：侧栏空间自然延伸至旁边 */}
        <div className="xl:col-start-1">
          <CommentsSection refId={diary.id} timeZone={timeZone} />
        </div>
      </div>
    </Container>
  )
}
