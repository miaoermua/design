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
import { ArticleCard, ArticleNeighbors } from '@/features/articles'
import {
  getArticle,
  getSiteTimezone,
  isNotFound,
  listArticles,
  type Article,
  type ArticleDetail,
} from '@/lib/api'
import { renderMarkdown } from '@/lib/content/markdown'
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
      <ReadingProgress targetId="article-content" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <article id="article-content">
        <div className="mx-auto grid max-w-[calc(var(--container-prose)+14rem)] gap-12 lg:grid-cols-[minmax(0,var(--container-prose))_12rem] lg:gap-14">
          <div className="min-w-0">
            <header className="pt-12 sm:pt-16">
              <p className="meta flex flex-wrap items-center gap-x-1">
                <Link href="/articles" className="link-quiet">
                  文章
                </Link>
                {article.category ? (
                  <>
                    <span aria-hidden="true">/</span>
                    <Link href={categoryPath(article.category.slug)} className="link-quiet">
                      {article.category.name}
                    </Link>
                  </>
                ) : null}
                <time className="meta-sep" dateTime={article.createdAt}>
                  {formatDate(article.createdAt, timeZone)}
                </time>
                {article.isPinned ? <span className="meta-sep">置顶</span> : null}
              </p>

              <h1 className="mt-4 font-serif text-[calc(var(--text-display)*0.62)] leading-[1.25] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[calc(var(--text-display)*0.82)] sm:leading-[1.2]">
                {article.title}
              </h1>

              {article.summary ? (
                <p className="mt-5 font-serif text-[1.0625rem] leading-[1.75] text-[var(--text-secondary)]">
                  {article.summary}
                </p>
              ) : null}

              <p className="meta mt-6 flex flex-wrap items-center gap-x-1">
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
              </p>

              {article.tags.length > 0 ? (
                <p className="meta mt-3 flex flex-wrap gap-x-2">
                  {article.tags.map((tag) => (
                    <Link key={tag} href={`/tags/${encodeURIComponent(tag)}`} className="link-quiet">
                      #{tag}
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
              <details className="mt-10 border-t border-dashed border-[var(--edge-strong)] pt-4 lg:hidden">
                <summary className="meta cursor-pointer select-none">目录</summary>
                <div className="mt-3">
                  <Toc items={rendered.toc} variant="inline" />
                </div>
              </details>
            ) : null}

            <div className="mt-12">
              {rendered ? (
                <Prose html={rendered.html} />
              ) : (
                <div className="border border-dashed border-[var(--edge)] px-5 py-6">
                  <p className="text-small text-[var(--text-primary)]">
                    这篇正文的 contentFormat 是「{article.contentFormat}」。
                  </p>
                  <p className="mt-2 text-caption text-[var(--text-secondary)]">
                    Folio 目前只渲染 Markdown。为避免把结构化 JSON 当成正文展示，这里不做降级渲染。
                  </p>
                </div>
              )}
            </div>

            <footer className="mt-16">
              {article.copyright ? (
                <p className="border-t border-dashed border-[var(--edge-strong)] pt-6 text-caption text-[var(--text-secondary)]">
                  本文版权归作者所有，转载请注明出处并保留原文链接。
                </p>
              ) : null}

              <ArticleNeighbors newer={neighbors.newer} older={neighbors.older} />

              <div className="mt-10 flex items-center justify-between">
                <Link href="/articles" className="link-quiet text-small">
                  ← 返回文章列表
                </Link>
                <BackToTop />
              </div>
            </footer>
          </div>

          <aside className="hidden lg:block">
            {rendered ? <Toc items={rendered.toc} /> : null}
          </aside>
        </div>
      </article>

      {article.related.length > 0 ? (
        <section className="mt-20 border-t border-dashed border-[var(--edge-strong)] pt-10">
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
