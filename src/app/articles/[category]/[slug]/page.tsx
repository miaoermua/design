import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { Prose } from '@/components/ui/prose'
import { SectionHeading } from '@/components/ui/page-header'
import { ActionRail } from '@/components/reading/action-rail'
import { ReadingAside, ReadingInline } from '@/components/reading/reading-tools'
import { requireFeature } from '@/core/registry/guard'
import { getThemeConfig } from '@/core/config/theme'
import { readArticleInsights } from '@/features/ai-insights'
import { AISummaryCard, readArticleSummary } from '@/features/ai-summary'
import { ArticleCard, ArticleNeighbors } from '@/features/articles'
import { CommentsSection } from '@/features/comments'
import { LiveArticleUpdater } from '@/features/articles/live/live-updater'
import { isDonateVisible, readDonateConfig } from '@/features/donate'
import { isInteractionEnabled, readSubscribeOptions } from '@/features/interactions'
import {
  getArticle,
  getSiteTimezone,
  isNotFound,
  listArticles,
  type Article,
  type ArticleDetail,
} from '@/lib/api'
import { renderMarkdown } from '@/lib/content/markdown'
import { isRealtimeEnabled } from '@/lib/realtime/config'
import { toContentLang } from '@/lib/i18n/config'
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

  try {
    const article = await getArticle(category, slug)
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
    return { title: '文章' }
  }
}

/** 相邻文章来自列表窗口；查询失败属于附加信息缺失，不阻断正文 */
async function findNeighbors(
  article: ArticleDetail,
): Promise<{ newer: Article | null; older: Article | null }> {
  try {
    const list = await listArticles({
      page: 1,
      size: 50,
      sortBy: 'createdAt',
      sortOrder: -1,
    })
    const index = list.items.findIndex((item) => item.id === article.id)
    if (index < 0) return { newer: null, older: null }
    return {
      newer: index > 0 ? (list.items[index - 1] ?? null) : null,
      older: index < list.items.length - 1 ? (list.items[index + 1] ?? null) : null,
    }
  } catch {
    return { newer: null, older: null }
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  requireFeature('articles')

  const { category, slug } = await params

  let article: ArticleDetail
  try {
    article = await getArticle(category, slug)
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
  const rendered =
    isMarkdown && article.content.trim() ? await renderMarkdown(article.content) : null
  const estimate = isMarkdown && article.content.trim() ? readingMinutes(article.content) : null

  // AI 资源与相邻文章都是附加信息：并行取，任一失败都只影响自己那一块
  const locale = await getLocale()
  const contentLang = toContentLang(locale)
  const [neighbors, summary, insights] = await Promise.all([
    findNeighbors(article),
    readArticleSummary(article.id, contentLang),
    rendered
      ? readArticleInsights({
          id: article.id,
          lang: contentLang,
          source: article.content,
          toc: rendered.toc,
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
        <div className="mx-auto grid max-w-[calc(var(--container-prose)+7rem)] gap-10 xl:max-w-[var(--container-wide)] xl:grid-cols-[minmax(0,calc(var(--container-prose)+7rem))_13rem] xl:gap-x-9">
          <div className="reading-sheet mx-auto w-full max-w-[calc(var(--container-prose)+7rem)] min-w-0 xl:col-start-1 xl:row-start-1">
            <header className="pt-10 sm:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span aria-hidden="true" className="h-px w-7 shrink-0 bg-[var(--accent-line)]" />
                <nav aria-label="面包屑" className="meta flex items-center gap-2">
                  <Link href="/articles" className="link-quiet">
                    文章
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
                <time className="meta meta-sep" dateTime={article.createdAt}>
                  {formatDate(article.createdAt, timeZone)}
                </time>
                {article.isPinned ? (
                  <span className="meta meta-sep text-[var(--accent-strong)]">置顶</span>
                ) : null}
              </div>

              <h1 className="mt-5 font-serif text-[calc(var(--text-display)*0.78)] leading-[1.25] tracking-[-0.022em] text-[var(--text-heading)] sm:text-[calc(var(--text-display)*0.82)] sm:leading-[1.2]">
                {article.title}
              </h1>

              {article.summary ? (
                <p className="sm:text-lead mt-4 font-serif text-[1.0625rem] leading-[1.8] text-[var(--text-secondary)] sm:mt-5 sm:leading-[1.75]">
                  {article.summary}
                </p>
              ) : null}

              {/* 元信息行：只留阅读数据。喜欢 / 分享 / 订阅 / 赞赏在操作栏，
                  这里再放一个赞赏入口会让同一动作出现两次。 */}
              <div className="meta mt-7 flex flex-wrap items-center gap-x-1 border-t border-dashed border-[var(--edge)] pt-4">
                {estimate ? <span>约 {estimate} 分钟</span> : null}
                {article.readCount !== null ? (
                  <span className={estimate ? 'meta-sep' : undefined}>
                    {article.readCount.toLocaleString('zh-CN')} 次阅读
                  </span>
                ) : null}
                {article.likeCount !== null ? (
                  <span className="meta-sep">
                    {article.likeCount.toLocaleString('zh-CN')} 次喜欢
                  </span>
                ) : null}
                {article.modifiedAt && article.modifiedAt !== article.createdAt ? (
                  <span className="meta-sep">
                    更新于 {formatDate(article.modifiedAt, timeZone)}
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

              {article.cover ? (
                <figure className="mt-8">
                  <CoverImage
                    src={article.cover.src}
                    alt={article.title}
                    width={article.cover.width}
                    height={article.cover.height}
                    priority
                    className="aspect-[16/9] w-full"
                  />
                </figure>
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
                    这篇正文的 contentFormat 是「{article.contentFormat}」。
                  </p>
                  <p className="text-caption mt-2 text-[var(--text-secondary)]">
                    Folio 目前只渲染 Markdown。为避免把结构化 JSON 当成正文展示，这里不做降级渲染。
                  </p>
                </div>
              )}
            </div>

            <div aria-hidden="true" className="mt-16 flex items-center justify-center gap-3">
              <span className="h-px w-10 bg-[var(--edge)]" />
              <span className="size-1.5 rotate-45 bg-[var(--accent-soft)]" />
              <span className="h-px w-10 bg-[var(--edge)]" />
            </div>

            <footer className="mt-10">
              {article.copyright ? (
                <p className="text-caption text-[var(--text-secondary)]">
                  本文版权归作者所有，转载请注明出处并保留原文链接。
                </p>
              ) : null}

              <ArticleNeighbors newer={neighbors.newer} older={neighbors.older} />

              <div className="mt-10 flex items-center justify-between border-t border-dashed border-[var(--edge)] pt-6">
                <Link
                  href="/articles"
                  className="link-quiet text-small text-[var(--text-secondary)]"
                >
                  ← 返回文章列表
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

      {/* 评论区在 #article-content 之外：阅读进度的口径是正文，不该把评论算进去 */}
      <CommentsSection refId={article.id} timeZone={timeZone} />

      {article.related.length > 0 ? (
        <section className="border-t border-dashed border-[var(--edge-strong)] pt-10">
          <SectionHeading title="相关阅读" />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {article.related.map((item) => (
              <ArticleCard key={item.id} article={item} timeZone={timeZone} />
            ))}
          </div>
        </section>
      ) : null}
    </Container>
  )
}
