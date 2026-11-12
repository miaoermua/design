import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { BackToTop } from '@/components/ui/back-to-top'
import { Prose } from '@/components/ui/prose'
import { ReadingProgress } from '@/components/ui/reading-progress'
import { SectionHeading } from '@/components/ui/page-header'
import { Toc } from '@/components/ui/toc'
import { requireFeature } from '@/core/registry/guard'
import { getThemeConfig } from '@/core/config/theme'
import { ArticleCard, ArticleNeighbors } from '@/features/articles'
import { LiveArticleUpdater } from '@/features/articles/live/live-updater'
import { DonateSlot } from '@/features/donate'
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
    const canonical = absoluteUrl(identity, articlePath(article.category?.slug, article.slug) ?? '/articles')

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
async function findNeighbors(article: ArticleDetail): Promise<{ newer: Article | null; older: Article | null }> {
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

  const isMarkdown = article.contentFormat === 'markdown'
  const rendered = isMarkdown && article.content.trim() ? await renderMarkdown(article.content) : null
  const estimate = isMarkdown && article.content.trim() ? readingMinutes(article.content) : null
  const neighbors = await findNeighbors(article)
  const canonical = absoluteUrl(identity, articlePath(article.category?.slug, article.slug) ?? '/articles')

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
      <ReadingProgress targetId="article-content" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <article id="article-content" className="pb-[var(--spacing-section)]">
        <div className="mx-auto grid max-w-[calc(var(--container-prose)+23.5rem)] gap-12 xl:grid-cols-[minmax(0,calc(var(--container-prose)+7rem))_13rem] xl:gap-14">
          <div className="reading-sheet mx-auto w-full min-w-0 max-w-[calc(var(--container-prose)+7rem)]">
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
                <p className="mt-4 font-serif text-[1.0625rem] leading-[1.8] text-[var(--text-secondary)] sm:mt-5 sm:text-lead sm:leading-[1.75]">
                  {article.summary}
                </p>
              ) : null}

              {/* 操作栏：阅读/喜欢等元信息与赞赏入口同一行。用 div 而非 p，
                  因为 DonateSlot 内部是块级浮层容器。 */}
              <div className="meta mt-7 flex flex-wrap items-center gap-x-1 border-t border-dashed border-[var(--edge)] pt-4">
                {estimate ? <span>约 {estimate} 分钟</span> : null}
                {article.readCount !== null ? (
                  <span className={estimate ? 'meta-sep' : undefined}>
                    {article.readCount.toLocaleString('zh-CN')} 次阅读
                  </span>
                ) : null}
                {article.likeCount !== null ? (
                  <span className="meta-sep">{article.likeCount.toLocaleString('zh-CN')} 次喜欢</span>
                ) : null}
                {article.modifiedAt && article.modifiedAt !== article.createdAt ? (
                  <span className="meta-sep">
                    更新于 {formatDate(article.modifiedAt, timeZone)}
                  </span>
                ) : null}
                <DonateSlot theme={theme} className="meta-sep" />
              </div>

              {article.tags.length > 0 ? (
                <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-meta">
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

            {rendered && rendered.toc.length >= 2 ? (
              <details className="mt-10 border-t border-dashed border-[var(--edge)] pt-4 xl:hidden">
                <summary className="toc-summary meta flex cursor-pointer items-center justify-between select-none">
                  目录
                  <span
                    aria-hidden="true"
                    className="toc-chevron text-[var(--text-tertiary)]"
                  >
                    ›
                  </span>
                </summary>
                <div className="mt-1">
                  <Toc items={rendered.toc} variant="inline" />
                </div>
              </details>
            ) : null}

            <div className="mt-10 sm:mt-12">
              {rendered ? (
                <Prose html={rendered.html} />
              ) : (
                <div className="border border-dashed border-[var(--edge)] px-5 py-6">
                  <p className="text-small text-[var(--text-heading)]">
                    这篇正文的 contentFormat 是「{article.contentFormat}」。
                  </p>
                  <p className="mt-2 text-caption text-[var(--text-secondary)]">
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
                <Link href="/articles" className="link-quiet text-small text-[var(--text-secondary)]">
                  ← 返回文章列表
                </Link>
                <BackToTop />
              </div>
            </footer>
          </div>

          <aside className="hidden xl:block">
            {rendered ? <Toc items={rendered.toc} /> : null}
          </aside>
        </div>
      </article>

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
