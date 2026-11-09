import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { Prose } from '@/components/ui/prose'
import { Rule } from '@/components/ui/rule'
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
    <Container width="prose">
      <header className="pt-14 sm:pt-20">
        <p className="meta">关于</p>
        <h1 className="mt-3 font-serif text-title leading-[1.24] text-[var(--text-primary)]">
          {page.title}
        </h1>
        {page.subtitle ? (
          <p className="mt-3 font-serif text-small text-[var(--text-secondary)]">
            {page.subtitle}
          </p>
        ) : null}
        {page.updatedAt ? (
          <p className="meta mt-3">
            <time dateTime={page.updatedAt}>更新于 {formatDate(page.updatedAt, 'Asia/Shanghai')}</time>
          </p>
        ) : null}
      </header>

      <Rule className="my-8" />

      {rendered ? (
        <Prose html={rendered.html} />
      ) : (
        <div className="border border-dashed border-[var(--edge)] px-5 py-6">
          <p className="text-small text-[var(--text-primary)]">
            这个页面的正文格式是「{page.contentFormat}」。
          </p>
          <p className="mt-2 text-caption text-[var(--text-secondary)]">
            Folio 目前只渲染 Markdown 正文。
          </p>
        </div>
      )}

      {owner?.name || socials.length > 0 ? (
        <section className="mt-16 border-t border-dashed border-[var(--edge-strong)] pt-8">
          <p className="meta">作者</p>
          <div className="mt-4 flex items-start gap-4">
            {owner?.avatar ? (
              <CoverImage
                src={owner.avatar}
                alt={owner.name ?? '作者头像'}
                width={64}
                height={64}
                className="size-16 shrink-0 border border-[var(--edge)] object-cover"
              />
            ) : null}
            <div>
              {owner?.name ? (
                <p className="font-serif text-h3 text-[var(--text-primary)]">
                  {owner.name}
                </p>
              ) : null}
              {owner?.introduce ? (
                <p className="mt-1 text-small text-[var(--text-secondary)]">
                  {owner.introduce}
                </p>
              ) : null}
              {socials.length > 0 ? (
                <ul className="meta mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {socials.map((link) => (
                    <li key={`${link.label}-${link.href}`}>
                      <a
                        href={link.href}
                        rel="me noopener noreferrer"
                        target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                        className="link-quiet"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </Container>
  )
}
