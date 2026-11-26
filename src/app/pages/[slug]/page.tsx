import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { ArticleRoomJoin } from '@/components/realtime/article-room-join'
import { PageHeader } from '@/components/ui/page-header'
import { Prose } from '@/components/ui/prose'
import { requireFeature } from '@/core/registry/guard'
import { CommentsSection } from '@/features/comments'
import { getPageBySlug, isNotFound } from '@/lib/api'
import { imageSizeIndex } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { isRealtimeEnabled } from '@/lib/realtime/config'
import { formatDate } from '@/lib/utils/date'

interface PageDetailProps {
  params: Promise<{ slug: string }>
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function generateMetadata({ params }: PageDetailProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const page = await getPageBySlug(decodeParam(slug))
    return {
      title: page.title,
      description: page.subtitle ?? undefined,
    }
  } catch {
    // metadata 失败不应让页面整体报错：交给页面本身去决定 404
    const locale = await getLocale()
    return { title: t(locale, 'page.meta') }
  }
}

/**
 * Pages 详情
 *
 * 与 About 的区别：About 有身份卡侧栏（它是「关于作者」），
 * 这里是一般性的独立页面，因此只用正文版心 + 页头。
 * Markdown 渲染与安全处理走与文章完全相同的管线，不另起一套。
 */
export default async function PageDetailPage({ params }: PageDetailProps) {
  requireFeature('pages')

  const [{ slug: rawSlug }, locale] = await Promise.all([params, getLocale()])
  const slug = decodeParam(rawSlug)

  // about 有专属的 /about 页面，这里重定向语义的入口不应重复渲染
  if (slug === 'about') notFound()

  let page: Awaited<ReturnType<typeof getPageBySlug>>
  try {
    page = await getPageBySlug(slug, { lang: toContentLang(locale) })
  } catch (error) {
    if (isNotFound(error)) notFound()
    throw error
  }

  const isMarkdown = page.contentFormat === 'markdown'
  const rendered =
    isMarkdown && page.content.trim()
      ? await renderMarkdown(page.content, locale, {
          imageSizes: imageSizeIndex(page.images),
        })
      : null

  return (
    <Container width="prose">
      {/* 只加入房间、不订阅事件：独立页面也要能被页脚的「谁在读」统计到 */}
      {isRealtimeEnabled() ? <ArticleRoomJoin articleId={page.id} /> : null}
      <PageHeader
        kicker={t(locale, 'page.kicker')}
        title={page.title}
        description={page.subtitle}
        meta={
          page.updatedAt ? (
            <p className="meta">
              <time dateTime={page.updatedAt}>
                {tf(locale, 'meta.updated', {
                  date: formatDate(page.updatedAt, 'Asia/Shanghai'),
                })}
              </time>
            </p>
          ) : null
        }
      />

      <div className="border-t border-dashed border-[var(--edge-strong)] pt-10">
        {rendered ? (
          <Prose html={rendered.html} />
        ) : (
          <div className="border border-dashed border-[var(--edge)] px-5 py-6">
            <p className="text-small text-[var(--text-heading)]">
              {tf(locale, 'page.unsupportedFormat', { format: page.contentFormat })}
            </p>
            <p className="text-caption mt-2 text-[var(--text-secondary)]">
              {t(locale, 'page.unsupportedFormatHint')}
            </p>
          </div>
        )}
      </div>

      <CommentsSection refId={page.id} />
    </Container>
  )
}
