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
import {
  getDiaryByNid,
  getSiteTimezone,
  isNotFound,
  isPasswordRequired,
  type Diary,
} from '@/lib/api'
import { absoluteUrl, loadSiteContext } from '@/lib/site'
import { imageSizeIndex, inlineMediaSources } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { NOTE_LIST_PATH, notePath } from '@/lib/routes'
import { PasswordGate } from '@/features/diaries/components/password-gate'
import { cn } from '@/lib/utils/cn'
import { formatDate, formatTime, formatWeekday } from '@/lib/utils/date'
import { excerpt } from '@/lib/utils/text'

interface DiaryPageProps {
  params: Promise<{ nid: string }>
  /**
   * `password` 是上游 core 的既有参数形态（`NotePasswordQuerySchema`），
   * Shiro / Kami 也都用它；`wrong` 只用于区分「首次」与「刚被拒」。
   */
  searchParams: Promise<{ password?: string; wrong?: string }>
}

/**
 * nid 是后端自增序号：非正整数直接当 404，别把后端 400 make 成 500。
 * 不设上限——序号会一直长，没有「合法范围」可言。
 */
function isNoteNid(value: string): boolean {
  return /^[1-9]\d*$/.test(value)
}

export async function generateMetadata({
  params,
  searchParams,
}: DiaryPageProps): Promise<Metadata> {
  const { nid } = await params
  const { password } = await searchParams
  if (!isNoteNid(nid)) notFound()
  /*
   * 标题与摘要来自日记实体：metadata 与页面必须用同一个 `?lang=` 请求，
   * 才既拿到对应语言的标题，也共享同一份 fetch 缓存。
   * 语言与密码是两个正交参数，密码仍按上游形态走 `?password=`。
   */
  const locale = await getLocale()
  const contentLang = toContentLang(locale)
  try {
    const diary = await getDiaryByNid(Number(nid), password, { lang: contentLang })
    /*
     * canonical 与文章详情页走同一套：`absoluteUrl(identity, path)`。
     * 公开地址的解析优先级（env → 后端 `aggregate.url.webUrl`）也完全一致，
     * 不在这里另造一份。
     *
     * 之前这里没有 canonical，旧路由又是 307，两个问题叠在一起时搜索引擎
     * 无法得知 `/diaries/:id` 与 `/notes/:nid` 是同一个页面。现在旧路由改 308
     * 并补上 canonical，归一信号才完整。
     */
    const { identity } = await loadSiteContext()
    const canonical = absoluteUrl(identity, notePath(diary.nid))

    return {
      title: diary.title,
      description: excerpt(diary.content, 120) || undefined,
      ...(canonical ? { alternates: { canonical } } : {}),
      openGraph: {
        type: 'article',
        title: diary.title,
        description: excerpt(diary.content, 120) || undefined,
        url: canonical ?? undefined,
        publishedTime: diary.publishedAt,
        modifiedTime: diary.modifiedAt ?? undefined,
      },
    }
  } catch (error) {
    // 404 要在 metadata 阶段抛，否则流式布局会先发出 200（软 404）
    if (isNotFound(error)) notFound()
    return {
      title: isPasswordRequired(error)
        ? t(locale, 'diary.protectedTitle')
        : t(locale, 'diary.meta'),
    }
  }
}

export default async function DiaryPage({ params, searchParams }: DiaryPageProps) {
  requireFeature('diaries')

  const { nid } = await params
  const { password, wrong } = await searchParams
  if (!isNoteNid(nid)) notFound()

  const locale = await getLocale()
  // 标题、正文与 metadata 都由后端按 `?lang=` 返回；语言不影响密码校验
  const contentLang = toContentLang(locale)

  // 密码照上游的形态走查询参数，直接透传给 core
  let diary: Diary
  try {
    diary = await getDiaryByNid(Number(nid), password, { lang: contentLang })
  } catch (error) {
    if (isNotFound(error)) notFound()
    if (isPasswordRequired(error)) {
      return <PasswordGate wrong={Boolean(wrong) || Boolean(password)} locale={locale} />
    }
    throw error
  }

  const timeZone = getSiteTimezone()
  const isMarkdown = diary.contentFormat === 'markdown'
  const rendered =
    isMarkdown && diary.content.trim()
      ? await renderMarkdown(diary.content, locale, {
          imageSizes: imageSizeIndex(diary.images),
        })
      : null
  // core 的 `images` 是正文里抽出来的全部图片（`::: gallery` / `::: carousel`
  // 里的也在其中）。正文已经渲染过的不在文末再铺一遍，否则用相册的日记会把
  // 同一批图显示两次；这里只补正文里没出现过的附件。
  const inlineSources = rendered ? inlineMediaSources(rendered.html) : new Set<string>()
  const trailingImages = diary.images.filter((image) => !inlineSources.has(image.src))
  const chips = [diary.mood, diary.weather, diary.location, diary.topic?.name].filter(
    (chip): chip is string => Boolean(chip),
  )

  // 笔记同样只有 post/note 支持 AI 资源；受密码保护时正文为空，不请求
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
  const canonical = absoluteUrl(identity, notePath(diary.nid))

  return (
    <Container width="wide">
      <div className="mx-auto mt-10 grid max-w-[calc(var(--measure-note)+var(--pad-paper-inline)+var(--pad-paper-inline))] gap-10 sm:mt-14 xl:max-w-[var(--shell-note)] xl:grid-cols-[minmax(0,calc(var(--measure-note)+var(--pad-paper-inline)+var(--pad-paper-inline)))_var(--rail-toc)] xl:gap-x-[var(--gap-rail)]">
        <article
          id="diary-content"
          className="reading-sheet mx-auto w-full max-w-[calc(var(--measure-note)+var(--pad-paper-inline)+var(--pad-paper-inline))] min-w-0 xl:col-start-1 xl:row-start-1"
        >
          <header>
            <p className="meta flex flex-wrap items-center gap-x-1">
              <Link href={NOTE_LIST_PATH} className="link-quiet">
                {t(locale, 'diary.meta')}
              </Link>
              <time className="meta-sep" dateTime={diary.publishedAt}>
                {formatDate(diary.publishedAt, timeZone)}
              </time>
              <span className="meta-sep">{formatWeekday(diary.publishedAt, timeZone)}</span>
              <span className="meta-sep">{formatTime(diary.publishedAt, timeZone)}</span>
            </p>

            <h1 className="text-title mt-4 font-serif text-[var(--text-heading)]">{diary.title}</h1>

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
            <Link href={NOTE_LIST_PATH} className="link-quiet meta mt-5 inline-block">
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
