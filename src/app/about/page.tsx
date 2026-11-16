import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { PageHeader } from '@/components/ui/page-header'
import { Prose } from '@/components/ui/prose'
import { requireFeature } from '@/core/registry/guard'
import { getPageBySlug, isNotFound } from '@/lib/api'
import { imageSizeIndex } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { loadSiteContext } from '@/lib/site'
import { getThemeConfig } from '@/core/config/theme'
import { toSocialItems } from '@/lib/social'
import { formatDate } from '@/lib/utils/date'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'about.title'),
    description: t(locale, 'about.description'),
  }
}

export default async function AboutPage() {
  requireFeature('about')

  const locale = await getLocale()

  let page: Awaited<ReturnType<typeof getPageBySlug>>
  try {
    page = await getPageBySlug('about', { lang: toContentLang(locale) })
  } catch (error) {
    if (isNotFound(error)) notFound()
    throw error
  }

  const [{ identity }, theme] = await Promise.all([loadSiteContext(), getThemeConfig()])
  const owner = identity?.owner
  // 与首页/页脚共用同一套合并规则：自定义项目补在 API 账号前面，
  // 否则「关于」页会和站点其它位置展示出不同的社交列表。
  const socials = theme.social.enabled
    ? toSocialItems(owner?.socialIds, { theme: theme.social })
    : []
  const isMarkdown = page.contentFormat === 'markdown'
  const rendered =
    isMarkdown && page.content.trim()
      ? await renderMarkdown(page.content, locale, { imageSizes: imageSizeIndex(page.images) })
      : null

  return (
    <Container width="wide">
      <PageHeader
        kicker={t(locale, 'about.kicker')}
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

      {/*
        1104px = `--shell-page`（17rem 侧栏 + 4rem 间距 + 44rem 正文 = 65rem = 1040px）
        **加双侧 gutter**（2 × 2rem）。所以这个断点不是随手取的值：它恰好是「两栏刚好放得下」
        的那一点。低于它侧栏收起、正文单列。
        `min-[69rem]` 是 Tailwind 任意值断点——`@media` 里不能用 `var()`，断点值无法 Token 化，
        因此这里保留字面量，但用 `max-w-[var(--shell-page)]` 让**宽度**仍然来自 Token。
      */}
      <div className="grid max-w-[var(--shell-page)] gap-10 border-t border-dashed border-[var(--edge-strong)] pt-10 min-[69rem]:grid-cols-[var(--rail-side)_minmax(0,1fr)] min-[69rem]:gap-[var(--gap-side)]">
        {/* 身份卡靠左、随页面滚动停留，正文保持在阅读宽度内 */}
        <aside className="min-[69rem]:sticky min-[69rem]:top-28 min-[69rem]:self-start">
          {owner ? (
            <div className="flex items-start gap-4 min-[69rem]:flex-col min-[69rem]:items-start min-[69rem]:gap-5">
              {owner.avatar ? (
                <CoverImage
                  src={owner.avatar}
                  alt={owner.name ?? t(locale, 'about.avatarAlt')}
                  width={96}
                  height={96}
                  className="size-16 shrink-0 border border-[var(--edge)] object-cover min-[69rem]:size-24"
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
              {socials.map((item) => (
                <li key={item.id} className="group">
                  <a
                    href={item.url}
                    rel="me noopener noreferrer"
                    target={item.url.startsWith('mailto:') ? undefined : '_blank'}
                    style={item.color ? { color: item.color } : undefined}
                    className="inline-flex items-center gap-1.5 py-1 text-small text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent-strong)]"
                  >
                    {item.title}
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

        <div className="min-w-0 max-w-[var(--measure-page)]">
          {rendered ? (
            <Prose html={rendered.html} />
          ) : (
            <div className="border border-dashed border-[var(--edge)] px-5 py-6">
              <p className="text-small text-[var(--text-heading)]">
                {tf(locale, 'page.unsupportedFormat', { format: page.contentFormat })}
              </p>
              <p className="mt-2 text-caption text-[var(--text-secondary)]">
                {t(locale, 'page.unsupportedFormatHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
