import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SectionHeading } from '@/components/ui/page-header'
import { SocialIcon, socialLabel } from '@/components/ui/social-icon'
import { HOME_RECENT_ARTICLES, HOME_RECENT_DIARIES } from '@/core/config/site'
import { isFeatureEnabled } from '@/core/registry/features'
import { ArticleRow } from '@/features/articles'
import { DiaryCard } from '@/features/diaries'
import {
  ConfigurationError,
  getSiteTimezone,
  isApiConfigured,
  listArticles,
  listDiaries,
} from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { diaryPath } from '@/lib/routes'
import { loadSiteContext, siteDescription, siteTitle } from '@/lib/site'
import { toSocialLinks } from '@/lib/social'

export async function generateMetadata(): Promise<Metadata> {
  const { identity } = await loadSiteContext()
  return {
    title: { absolute: siteTitle(identity) },
    description: siteDescription(identity),
  }
}

/**
 * 首页
 *
 * 结构是纵向的个人数字空间，而不是编辑杂志封面：
 *
 *   Personal Brand → Latest Blogs → Latest Notes → Footer
 *
 * 每一段都只回答一个问题：「这是谁」「最近写了什么」「最近在想什么」。
 * 刻意不做的事情：没有整屏 Hero、没有首篇「头条」大卡片、没有封面图强制位、
 * 没有把所有内容都堆在首页——归档、标签、页面各有自己的入口。
 */
export default async function HomePage() {
  if (!isApiConfigured()) {
    return (
      <Container>
        <div className="py-20">
          <ErrorState
            title="尚未连接 Mix Space 后端"
            error={new ConfigurationError('缺少环境变量 MX_SERVER_URL')}
            hint="在 .env.local 中设置 MX_SERVER_URL，或设置 MX_MOCK=1 用内置数据离线预览。"
          />
        </div>
      </Container>
    )
  }

  const locale = await getLocale()
  const lang = toContentLang(locale)
  const timeZone = getSiteTimezone()
  const { identity } = await loadSiteContext()

  const [articles, diaries] = await Promise.all([
    // 「最近写的」必须按发布时间倒序：v2 的 /posts 默认会把置顶文章排在最前
    // （实测线上第 1 条是 2023 年的置顶文），不显式传排序会让首页看起来错乱。
    isFeatureEnabled('articles')
      ? listArticles({
          size: HOME_RECENT_ARTICLES,
          lang,
          sortBy: 'createdAt',
          sortOrder: -1,
        })
      : null,
    isFeatureEnabled('diaries')
      ? listDiaries({ size: HOME_RECENT_DIARIES, lang, sortBy: 'createdAt', sortOrder: -1 })
      : null,
  ])

  const owner = identity?.owner
  const socials = toSocialLinks(owner?.socialIds)
  const name = owner?.name ?? siteTitle(identity)

  return (
    <Container>
      {/* ── Personal Brand ─────────────────────────────────────── */}
      <section className="pt-[calc(var(--spacing-section)*1.05)] pb-[var(--spacing-stack)]">
        <div className="flex items-start gap-5 sm:gap-6">
          {owner?.avatar ? (
            <CoverImage
              src={owner.avatar}
              alt={name}
              width={72}
              height={72}
              priority
              // 圆形头像，尺寸克制：它是身份的一部分，不是首屏主视觉
              className="size-14 shrink-0 rounded-full border border-[var(--edge)] sm:size-[4.5rem]"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            {/* 作者名是首页最大的字：它是这个空间的身份标识，
                用 display 级而不是把每一段都做大——只有一处需要这个重量。 */}
            <h1 className="max-w-[22ch] text-balance font-serif text-display leading-[1.2] text-[var(--text-heading)]">
              {name}
            </h1>
            {owner?.introduce ?? identity?.description ? (
              <p className="mt-2 max-w-[34rem] text-pretty text-lead leading-[1.7] text-[var(--text-secondary)]">
                {owner?.introduce ?? identity?.description}
              </p>
            ) : null}

            {socials.length > 0 ? (
              <ul className="mt-4 flex flex-wrap items-center gap-1.5">
                {socials.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <a
                      href={link.href}
                      rel="me noopener noreferrer"
                      target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                      title={socialLabel(link)}
                      aria-label={socialLabel(link)}
                      className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)] hover:text-[var(--accent-strong)]"
                    >
                      <SocialIcon name={link.label} className="size-[1.05rem]" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="meta mt-7 flex flex-wrap items-center gap-x-1 gap-y-2">
          {articles ? (
            <Link href="/articles" className="link-quiet">
              {tf(locale, 'home.countArticles', { count: articles.pagination.total })}
            </Link>
          ) : null}
          {diaries ? (
            <Link href="/diaries" className="link-quiet">
              <span className={articles ? 'meta-sep' : undefined}>
                {tf(locale, 'home.countDiaries', { count: diaries.pagination.total })}
              </span>
            </Link>
          ) : null}
          {identity?.latestDiaryId ? (
            <Link href={diaryPath(identity.latestDiaryId)} className="link-quiet">
              <span className="meta-sep">{t(locale, 'home.latestDiary')}</span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* ── Latest Blogs ───────────────────────────────────────── */}
      {articles ? (
        <section className="border-t border-dashed border-[var(--edge-strong)] pt-10">
          <SectionHeading
            title={t(locale, 'home.latestBlogs')}
            action={
              <Link href="/articles" className="link-quiet meta">
                {t(locale, 'home.allArticles')} →
              </Link>
            }
          />

          {articles.items.length > 0 ? (
            <div className="mt-2 divide-y divide-dashed divide-[var(--edge)]">
              {articles.items.map((article) => (
                <ArticleRow key={article.id} article={article} timeZone={timeZone} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={t(locale, 'home.emptyArticles')}
                description={t(locale, 'home.emptyArticlesHint')}
              />
            </div>
          )}
        </section>
      ) : null}

      {/* ── Latest Notes ───────────────────────────────────────── */}
      {diaries ? (
        <section className="mt-[var(--spacing-section)] border-t border-dashed border-[var(--edge-strong)] pt-10">
          <SectionHeading
            title={t(locale, 'home.latestNotes')}
            action={
              <Link href="/diaries" className="link-quiet meta">
                {t(locale, 'home.allDiaries')} →
              </Link>
            }
          />

          {diaries.items.length > 0 ? (
            <div className="mt-7 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {diaries.items.map((diary) => (
                <DiaryCard key={diary.id} diary={diary} timeZone={timeZone} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={t(locale, 'home.emptyNotes')}
                description={t(locale, 'home.emptyNotesHint')}
              />
            </div>
          )}
        </section>
      ) : null}
    </Container>
  )
}