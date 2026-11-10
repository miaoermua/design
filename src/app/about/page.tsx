import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { PageHeader } from '@/components/ui/page-header'
import { Prose } from '@/components/ui/prose'
import { requireFeature } from '@/core/registry/guard'
import { getPageBySlug, isNotFound } from '@/lib/api'
import { renderMarkdown } from '@/lib/content/markdown'
import { loadSiteContext } from '@/lib/site'
import { toSocialLinks } from '@/lib/social'
import { formatDate } from '@/lib/utils/date'

export const metadata: Metadata = {
  title: '关于',
  description: '关于这个站点与它的作者。',
}

export default async function AboutPage() {
  requireFeature('about')

  let page: Awaited<ReturnType<typeof getPageBySlug>>
  try {
    page = await getPageBySlug('about')
  } catch (error) {
    if (isNotFound(error)) notFound()
    throw error
  }

  const { identity } = await loadSiteContext()
  const owner = identity?.owner
  const socials = toSocialLinks(owner?.socialIds)
  const isMarkdown = page.contentFormat === 'markdown'
  const rendered = isMarkdown && page.content.trim() ? await renderMarkdown(page.content) : null

  return (
    <Container width="wide">
      <PageHeader
        kicker="关于"
        title={page.title}
        description={page.subtitle}
        meta={
          page.updatedAt ? (
            <p className="meta">
              <time dateTime={page.updatedAt}>更新于 {formatDate(page.updatedAt, 'Asia/Shanghai')}</time>
            </p>
          ) : null
        }
      />

      <div className="grid gap-10 border-t border-dashed border-[var(--edge-strong)] pt-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
        {/* 身份卡靠左、随页面滚动停留，正文保持在阅读宽度内 */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          {owner ? (
            <div className="flex items-start gap-4 lg:flex-col lg:items-start lg:gap-5">
              {owner.avatar ? (
                <CoverImage
                  src={owner.avatar}
                  alt={owner.name ?? '作者头像'}
                  width={96}
                  height={96}
                  className="size-16 shrink-0 border border-[var(--edge)] object-cover lg:size-24"
                />
              ) : null}
              <div className="min-w-0">
                {owner.name ? (
                  <p className="font-serif text-h3 text-[var(--text-heading)]">{owner.name}</p>
                ) : null}
                {owner.introduce ? (
                  <p className="mt-2 text-pretty text-small leading-[1.8] text-[var(--text-secondary)]">
                    {owner.introduce}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {socials.length > 0 ? (
            <ul className="mt-6 space-y-1.5 border-t border-[var(--edge)] pt-4">
              {socials.map((link) => (
                <li key={`${link.label}-${link.href}`} className="group">
                  <a
                    href={link.href}
                    rel="me noopener noreferrer"
                    target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                    className="inline-flex items-center gap-1.5 py-1 text-small text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent-strong)]"
                  >
                    {link.label}
                    <span
                      aria-hidden="true"
                      className="text-[var(--text-tertiary)] transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>

        <div className="min-w-0 max-w-[var(--container-prose)]">
          {rendered ? (
            <Prose html={rendered.html} />
          ) : (
            <div className="border border-dashed border-[var(--edge)] px-5 py-6">
              <p className="text-small text-[var(--text-heading)]">
                这个页面的正文格式是「{page.contentFormat}」。
              </p>
              <p className="mt-2 text-caption text-[var(--text-secondary)]">
                Folio 目前只渲染 Markdown 正文。
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
