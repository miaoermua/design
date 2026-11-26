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
import { LiveArticleUpdater } from '@/features/articles/live/live-updater'
import { isDonateVisible, readDonateConfig } from '@/features/donate'
import { isInteractionEnabled, readSubscribeOptions } from '@/features/interactions'
import { getArticle, getSiteTimezone, isNotFound, type ArticleDetail } from '@/lib/api'
import { imageSizeIndex } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'
import { isRealtimeEnabled } from '@/lib/realtime/config'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { articlePath, categoryPath } from '@/lib/routes'
import { absoluteUrl, loadSiteContext } from '@/lib/site'
import { jsonLd } from '@/lib/seo'
import { formatDate } from '@/lib/utils/date'
import { readingMinutes } from '@/lib/utils/text'

interface ArticlePageProps {
  params: Promise<{ category: string; slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { category, slug } = await params
  /*
   * 标题与摘要来自正文实体，必须和页面同一个语言取：
   * metadata 与页面各自发一次 `getArticle`，同 URL 同参数才会命中同一份缓存，
   * 否则英文页面的 `<title>` 会是中文，而正文是英文。
   */
  const locale = await getLocale()
  const contentLang = toContentLang(locale)

  try {
    const article = await getArticle(category, slug, { lang: contentLang })
    const { identity } = await loadSiteContext()
    const canonical = absoluteUrl(
      identity,
      articlePath(article.category?.slug, article.slug) ?? '/articles',
    )

    return {
      title: article.title,
      description: article.summary ?? undefined,
      ...(canonical ? { alternates: { canonical } } : {}),
      openGraph: {
        type: 'article',
        title: article.title,
        description: article.summary ?? undefined,
        publishedTime: article.createdAt,
        modifiedTime: article.modifiedAt ?? undefined,
        tags: article.tags.length > 0 ? article.tags : undefined,
        images: article.cover ? [article.cover.src] : undefined,
      },
    }
  } catch (error) {
    // 在 metadata 阶段就抛 404：根布局是流式的（app/loading.tsx），
    // 等页面正文再 notFound() 时状态码已经以 200 发出去了（软 404）。
    if (isNotFound(error)) notFound()
    return { title: t(locale, 'article.breadcrumb') }
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  requireFeature('articles')

  const { category, slug } = await params
  const locale = await getLocale()
  // 详情标题、正文、分类名与相邻文章的标题都由后端按 `?lang=` 返回
  const contentLang = toContentLang(locale)

  let article: ArticleDetail
  try {
    article = await getArticle(category, slug, { lang: contentLang })
  } catch (error) {
    if (isNotFound(error)) notFound()
    throw error
  }

  const timeZone = getSiteTimezone()
  const { identity } = await loadSiteContext()
  // 赞赏入口的开关与二维码都来自 Theme Snippet；可见性在服务端判断
  const theme = await getThemeConfig()
  // 订阅入口是否出现取决于后端能力探测：失败一律视为「没有这个能力」
  const subscribe = await readSubscribeOptions(theme.social)
  const donateConfig = readDonateConfig(theme)
  const donate = isDonateVisible(donateConfig)
    ? { label: donateConfig.label, qrcodes: donateConfig.qrcodes }
    : null

  const isMarkdown = article.contentFormat === 'markdown'
  // 正文图尺寸来自 core 的附件元数据；命中才写 width/height，拿不到就不猜
  const rendered =
    isMarkdown && article.content.trim()
      ? await renderMarkdown(article.content, locale, {
          imageSizes: imageSizeIndex(article.images),
        })
      : null
  const estimate = isMarkdown && article.content.trim() ? readingMinutes(article.content) : null

  // AI 资源是附加信息：并行取，任一失败都只影响自己那一块
  const [summary, insights] = await Promise.all([
    readArticleSummary(article.id, contentLang),
    rendered
      ? readArticleInsights({
          id: article.id,
          lang: contentLang,
          source: article.content,
          toc: rendered.toc,
          locale,
        })
      : Promise.resolve(null),
  ])
  const canonical = absoluteUrl(
    identity,
    articlePath(article.category?.slug, article.slug) ?? '/articles',
  )

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    ...(article.summary ? { description: article.summary } : {}),
    datePublished: article.createdAt,
    ...(article.modifiedAt ? { dateModified: article.modifiedAt } : {}),
    ...(article.cover ? { image: article.cover.src } : {}),
    ...(article.tags.length > 0 ? { keywords: article.tags.join(', ') } : {}),
    ...(identity?.owner.name ? { author: { '@type': 'Person', name: identity.owner.name } } : {}),
    ...(canonical ? { mainEntityOfPage: canonical } : {}),
  }

  const heading = (
    <h1 className="text-headline font-serif text-[var(--text-heading)]">{article.title}</h1>
  )

  return (
    <Container>
      {/* 实时更新接线：桌面与移动端同一个组件，事件只影响当前这篇文章 */}
      <LiveArticleUpdater
        identity={{
          id: article.id,
          category: article.category?.slug ?? category,
          slug: article.slug,
          modifiedAt: article.modifiedAt,
        }}
        enabled={isRealtimeEnabled()}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <article id="article-content" className="pb-[var(--spacing-section)]">
        {/* 桌面：左操作栏 / 中间正文 / 右阅读辅助；移动：正文在前，操作栏跟在文末 */}
        <div className="mx-auto grid max-w-[var(--measure-post)] gap-10 xl:max-w-[var(--shell-post)] xl:grid-cols-[minmax(0,var(--measure-post))_var(--rail-toc)] xl:gap-x-[var(--gap-rail)]">
          <div className="mx-auto w-full max-w-[var(--measure-post)] min-w-0 xl:col-start-1 xl:row-start-1">
            <header className="pt-10 sm:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span aria-hidden="true" className="h-px w-7 shrink-0 bg-[var(--accent-line)]" />
                <nav
                  aria-label={t(locale, 'article.breadcrumb')}
                  className="meta flex items-center gap-2"
                >
                  <Link href="/articles" className="link-quiet">
                    {t(locale, 'article.breadcrumb')}
                  </Link>
                  {article.category ? (
                    <>
                      <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                        /
                      </span>
                      <Link href={categoryPath(article.category.slug)} className="link-quiet">
                        {article.category.name}
                      </Link>
                    </>
                  ) : null}
                </nav>
                {article.isPinned ? (
                  <span className="meta meta-sep text-[var(--accent-strong)]">
                    {t(locale, 'article.pinned')}
                  </span>
                ) : null}
              </div>

              {/* 封面与标题同格叠放：标题压在封面底部的淡出带上，
                  渐变区域由标题自身高度撑开，到标题结束处为止。
                  发布日期 / 阅读数据 / 标签全部落在渐变之后。 */}
              {article.cover ? (
                <div className="article-cover-stack">
                  <figure className="article-cover">
                    <CoverImage
                      src={article.cover.src}
                      alt={article.title}
                      width={article.cover.width}
                      height={article.cover.height}
                      priority
                      className="aspect-[16/9] w-full"
                    />
                  </figure>
                  <div className="article-hero">{heading}</div>
                </div>
              ) : (
                <div className="mt-5">{heading}</div>
              )}

              {article.summary ? (
                <p className="text-lead mt-4 font-serif text-[var(--text-secondary)] sm:mt-5">
                  {article.summary}
                </p>
              ) : null}

              {/* 元信息行：只留时间与阅读数据。喜欢 / 分享 / 订阅 / 赞赏在操作栏，
                  这里再放一个赞赏入口会让同一动作出现两次。 */}
              <div className="meta mt-7 flex flex-wrap items-center gap-x-1 border-t border-dashed border-[var(--edge)] pt-4">
                <time dateTime={article.createdAt}>{formatDate(article.createdAt, timeZone)}</time>
                {estimate ? (
                  <span className="meta-sep">
                    {tf(locale, 'article.readingMinutes', { count: estimate })}
                  </span>
                ) : null}
                {article.readCount !== null ? (
                  <span className="meta-sep">
                    {tf(locale, 'meta.readCount', {
                      count: article.readCount.toLocaleString('zh-CN'),
                    })}
                  </span>
                ) : null}
                {article.likeCount !== null ? (
                  <span className="meta-sep">
                    {tf(locale, 'meta.likeCount', {
                      count: article.likeCount.toLocaleString('zh-CN'),
                    })}
                  </span>
                ) : null}
                {article.modifiedAt && article.modifiedAt !== article.createdAt ? (
                  <span className="meta-sep">
                    {tf(locale, 'meta.updated', {
                      date: formatDate(article.modifiedAt, timeZone),
                    })}
                  </span>
                ) : null}
              </div>

              {article.tags.length > 0 ? (
                <p className="text-meta mt-4 flex flex-wrap gap-x-3 gap-y-1">
                  {article.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tags/${encodeURIComponent(tag)}`}
                      className="text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent-strong)]"
                    >
                      {`#${tag}`}
                    </Link>
                  ))}
                </p>
              ) : null}
            </header>

            {summary ? (
              <AISummaryCard key={article.id} summary={summary} insights={insights} />
            ) : null}

            <ReadingInline items={rendered?.toc ?? []} targetId="article-content" />

            <div className="mt-10 sm:mt-12">
              {rendered ? (
                <Prose html={rendered.html} />
              ) : (
                <div className="border border-dashed border-[var(--edge)] px-5 py-6">
                  <p className="text-small text-[var(--text-heading)]">
                    {tf(locale, 'article.unsupportedFormat', { format: article.contentFormat })}
                  </p>
                  <p className="text-caption mt-2 text-[var(--text-secondary)]">
                    {t(locale, 'article.unsupportedFormatHint')}
                  </p>
                </div>
              )}
            </div>

            {article.related.length > 0 ? (
              <aside data-hide-print className="mt-10 sm:mt-12">
                <h3 className="text-small flex items-center gap-2 font-medium text-[var(--text-heading)]">
                  <span
                    aria-hidden="true"
                    className="inline-block h-px w-5 bg-[var(--accent-line)]"
                  />
                  <span>{t(locale, 'article.related')}</span>
                </h3>
                <ul className="mt-3 list-none space-y-2 pl-0">
                  {article.related.map((item) => {
                    const href = articlePath(item.category?.slug, item.slug)
                    return (
                      <li key={item.id} className="text-body leading-relaxed">
                        {href ? (
                          <Link
                            href={href}
                            className="link-quiet text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent-strong)]"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-secondary)]">{item.title}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </aside>
            ) : null}

            <div aria-hidden="true" className="mt-16 flex items-center justify-center gap-3">
              <span className="h-px w-10 bg-[var(--edge)]" />
              <span className="size-1.5 rotate-45 bg-[var(--accent-soft)]" />
              <span className="h-px w-10 bg-[var(--edge)]" />
            </div>

            <AiDisclosure disclosure={article.aiDisclosure} locale={locale} />

            <footer className="mt-10">
              <ArticleInfo
                title={article.title}
                author={identity?.owner.name ?? null}
                url={canonical}
                publishedAt={article.createdAt}
                modifiedAt={article.modifiedAt}
                timeZone={timeZone}
                locale={locale}
                showLicense={article.copyright}
              />

              <div className="mt-10 flex items-center justify-between border-t border-dashed border-[var(--edge)] pt-6">
                <Link
                  href="/articles"
                  className="link-quiet text-small text-[var(--text-secondary)]"
                >
                  {t(locale, 'article.backToList')}
                </Link>
              </div>
            </footer>
          </div>

          {/* 移动端跟在文末，桌面端落在右侧目录列表下方 */}
          <ReadingAside
            items={rendered?.toc ?? []}
            targetId="article-content"
            actions={
              <ActionRail
                id={article.id}
                type="Post"
                shareUrl={canonical}
                like={isInteractionEnabled()}
                subscribe={subscribe}
                donate={donate}
              />
            }
          />
        </div>
      </article>

      {/*
        评论区在 `#article-content` 之外：阅读进度按正文章顶到文底计算，
        评论一旦进容器就会把进度条拖成「读完正文才走一半」。
        这里复用同一套栅格，让左列仍然与正文左边界对齐、右侧留出辅助栏空档。
      */}
      <div className="mx-auto grid max-w-[var(--measure-post)] gap-10 xl:max-w-[var(--shell-post)] xl:grid-cols-[minmax(0,var(--measure-post))_var(--rail-toc)] xl:gap-x-[var(--gap-rail)]">
        <div className="mx-auto w-full max-w-[var(--measure-post)] min-w-0 xl:col-start-1">
          <CommentsSection refId={article.id} timeZone={timeZone} />
        </div>
      </div>
    </Container>
  )
}
