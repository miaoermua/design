import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SectionHeading } from '@/components/ui/page-header'
import { HeroSection } from '@/components/home/hero'
import { HomeMore } from '@/components/home/home-more'
import { getThemeConfig } from '@/core/config/theme'
import { isFeatureEnabled } from '@/core/registry/features'
import { ArticleRow } from '@/features/articles'
import { DiaryCard } from '@/features/diaries'
import { readSubscribeOptions } from '@/features/interactions'
import {
  ConfigurationError,
  getSiteLikeCount,
  getSiteTimezone,
  isApiConfigured,
  listArticles,
  listDiaries,
} from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { loadSiteContext, siteDescription, siteTitle } from '@/lib/site'
import { toSocialItems } from '@/lib/social'
import { cn } from '@/lib/utils/cn'

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
 *
 * Personal Brand 区块有两种布局，由 theme config 的 `homepage.hero` 决定：
 *   - 不配置（默认）：经典横排「头像 + 文字」，刻意不做整屏 Hero
 *   - 配置了 hero：兼容 Shiro 的 `config.hero` 格式，整屏居中模板化标题
 *
 * 刻意不做的事情：没有首篇「头条」大卡片、没有封面图强制位、
 * 没有把所有内容都堆在首页——归档、标签、页面各有自己的入口。
 */
export default async function HomePage() {
  const locale = await getLocale()

  if (!isApiConfigured()) {
    return (
      <Container>
        <div className="py-20">
          <ErrorState
            title={t(locale, 'state.backendMissingTitle')}
            error={new ConfigurationError('缺少环境变量 MX_SERVER_URL')}
            hint={t(locale, 'state.backendMissingHint')}
            locale={locale}
          />
        </div>
      </Container>
    )
  }

  const lang = toContentLang(locale)
  const timeZone = getSiteTimezone()
  const [{ identity }, theme] = await Promise.all([loadSiteContext(), getThemeConfig()])

  // 区块开关与条数都来自 Theme Snippet。
  // 关键点：**请求数量必须与最终生效的配置一致**——区块关闭时不发请求，
  // 条数改了请求 size 也要跟着改，否则会多取数据或显示条数对不上。
  const showArticles = isFeatureEnabled('articles') && theme.homepage.articles.enabled
  const showNotes = isFeatureEnabled('diaries') && theme.homepage.notes.enabled
  const showProfile = theme.homepage.profile.enabled

  const [articles, diaries] = await Promise.all([
    // 「最近写的」必须按发布时间倒序：v2 的 /posts 默认会把置顶文章排在最前
    // （实测线上第 1 条是 2023 年的置顶文），不显式传排序会让首页看起来错乱。
    showArticles
      ? listArticles({
          size: theme.homepage.articles.limit,
          lang,
          sortBy: 'createdAt',
          sortOrder: -1,
        })
      : null,
    showNotes
      ? listDiaries({
          size: theme.homepage.notes.limit,
          lang,
          sortBy: 'createdAt',
          sortOrder: -1,
        })
      : null,
  ])

  const owner = identity?.owner
  const socials = theme.social.enabled
    ? toSocialItems(owner?.socialIds, { theme: theme.social })
    : []
  const name = owner?.name ?? siteTitle(identity)

  // 「更多」区块里只要出现 `like` 入口，才去读站点总赞数：
  // 入口被配置删掉时这次请求就是白花的，而首页每条请求都在首屏关键路径上。
  const showMore = theme.homepage.more.enabled && theme.homepage.more.items.length > 0
  const needsLikeCount =
    showMore &&
    isFeatureEnabled('interactions') &&
    theme.homepage.more.items.some((item) => item.type === 'like')
  const siteLikeCount = needsLikeCount ? await getSiteLikeCount() : null

  // 订阅弹窗需要完整的订阅选项（邮件类型 + 频道），与 More 区块的 subscribe 入口共享
  const needsSubscribe =
    showMore &&
    isFeatureEnabled('interactions') &&
    theme.homepage.more.items.some((item) => item.type === 'subscribe')
  const subscribeOptions = needsSubscribe ? await readSubscribeOptions(theme.social) : null

  return (
    <Container>
      {/* ── Personal Brand ─────────────────────────────────────── */}
      {showProfile ? (
        <HeroSection
          name={name}
          avatar={owner?.avatar ?? null}
          introduce={owner?.introduce ?? identity?.description ?? null}
          socials={socials}
          stats={{
            articles: articles
              ? {
                  total: articles.pagination.total,
                  href: '/articles',
                  label: tf(locale, 'home.countArticles', { count: articles.pagination.total }),
                }
              : null,
            diaries: diaries
              ? {
                  total: diaries.pagination.total,
                  href: '/diaries',
                  label: tf(locale, 'home.countDiaries', { count: diaries.pagination.total }),
                }
              : null,
            showArticlesSep: !!articles,
          }}
          hero={theme.homepage.hero}
        />
      ) : null}

      {/* ── Latest Blogs ───────────────────────────────────────── */}
      {articles ? (
        <section
          className={cn(
            'motion-fade-in pt-10',
            showProfile && 'motion-delay-1',
            // profile 关闭时这一块是首页第一段，不需要额外的虚线分隔与上边距
            showProfile && 'border-t border-dashed border-[var(--edge-strong)]',
          )}
        >
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
                <ArticleRow
                  key={article.id}
                  article={article}
                  timeZone={timeZone}
                  locale={locale}
                />
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
        <section
          className={cn(
            'motion-fade-in mt-[var(--spacing-section)] border-t border-dashed border-[var(--edge-strong)] pt-10',
            showProfile && articles
              ? 'motion-delay-2'
              : (showProfile || articles) && 'motion-delay-1',
            // 文章区关闭时，日记区紧跟品牌区，不需要再叠一层大间距
            !articles && 'mt-0',
          )}
        >
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

      {/* ── More ───────────────────────────────────────────────── */}
      {showMore ? (
        <section
          className={cn(
            'motion-fade-in mt-[var(--spacing-section)] border-t border-dashed border-[var(--edge-strong)] pt-10 pb-4',
            // 延迟：根据前面有几个区块递增
            showProfile && articles && diaries
              ? 'motion-delay-3'
              : (showProfile && articles) || (showProfile && diaries) || (articles && diaries)
                ? 'motion-delay-2'
                : (showProfile || articles || diaries) && 'motion-delay-1',
          )}
        >
          <SectionHeading title={t(locale, 'home.more')} />
          <div className="mt-6">
            <HomeMore
              items={theme.homepage.more.items}
              siteLikeCount={siteLikeCount}
              subscribeOptions={subscribeOptions}
            />
          </div>
        </section>
      ) : null}
    </Container>
  )
}
